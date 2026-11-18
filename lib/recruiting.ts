import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/mailer";
import { getBaseUrl } from "@/lib/url";
import { escapeHtml } from "@/lib/format";
import { notify } from "@/lib/notify";
import { deletePrivateFile } from "@/lib/upload";

export { CANDIDATE_STAGES, CANDIDATE_STAGE_LABEL, OPEN_CANDIDATE_STAGES } from "@/lib/recruiting-labels";

export const DEFAULT_INVITE_SUBJECT = "Povabilo na uvodni pogovor — prodaja digitalnih produktov";
export const DEFAULT_INVITE_BODY = `Pozdravljeni {{firstName}},

hvala za vašo prijavo na delo pri AURELIA DISTRIBUCIJA.

Smo distribucijski center za digitalne produkte. Podjetjem v Sloveniji predstavljamo in prodajamo sodobne digitalne rešitve, med njimi:
• Unbusyness — aplikacije, ki hotelom, upravnikom stavb, Airbnb gostiteljem in obrtnikom prihranijo čas,
• Picked — storitev, s katero podjetja postanejo vidna in priporočena v AI asistentih, kot je ChatGPT.

Kaj boste delali: klicali podjetja, jim predstavili produkte in jih vodili do nakupa. Dobite pripravljene prodajne liste, scenarije klicev in naš CRM s priporočenimi kontakti, zato lahko začnete hitro, tudi brez izkušenj s prodajo. Delo je možno od doma ali v Ljubljani.

Naslednji korak je kratek, 30-minutni uvodni pogovor. Predstavimo vam delo, plačilo in provizijo ter odgovorimo na vaša vprašanja. Termin, ki vam ustreza, izberite tukaj:
{{calendlyLink}}
Termini so prikazani po slovenskem času (CET). Pri izbiri termina preverite, da je spodaj izbran časovni pas »Central European Time«.

Če imate vprašanja, preprosto odgovorite na to sporočilo.

Lep pozdrav,
Luka Drolc
AURELIA DISTRIBUCIJA d.o.o.`;

const REMINDER_SUBJECT = "Vas delo pri nas še zanima?";
const REMINDER_BODY = `Pozdravljeni {{firstName}},

pred nekaj dnevi smo vam poslali povabilo na kratek uvodni pogovor o delu pri prodaji digitalnih produktov. Če vas delo še zanima, si termin izberite tukaj:
{{calendlyLink}}
Termini so prikazani po slovenskem času (CET). Pri izbiri termina preverite, da je spodaj izbran časovni pas »Central European Time«.

Če vam noben termin ne ustreza ali vas delo ne zanima več, nam preprosto odgovorite na to sporočilo.

Lep pozdrav,
AURELIA DISTRIBUCIJA d.o.o.`;

export function newCandidateToken() {
  return randomBytes(12).toString("base64url");
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

/** The tracked Calendly link for one candidate. */
export function candidateBookingLink(token: string) {
  return `${getBaseUrl()}/prijava/termin/${token}`;
}

function fill(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => vars[k] ?? "");
}

function toHtml(text: string, link: string) {
  const esc = escapeHtml(text).replace(/\n/g, "<br>");
  const l = escapeHtml(link);
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2430">${esc.replace(
    l,
    `<a href="${l}" style="display:inline-block;margin:6px 0;padding:10px 18px;background:#4f46e5;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold">Izberite termin za uvodni pogovor</a>`
  )}</div>`;
}

async function sendCandidateEmail(c: { name: string; email: string; token: string }, subject: string, body: string) {
  const link = candidateBookingLink(c.token);
  const text = fill(body, { firstName: firstName(c.name), name: c.name, calendlyLink: link });
  await sendEmail({ to: c.email, subject, text, html: toHtml(text, link) });
}

export async function sendInvite(candidateId: string) {
  const [settings, c] = await Promise.all([getSettings(), prisma.candidate.findUnique({ where: { id: candidateId } })]);
  if (!c) throw new Error("Candidate not found");
  if (!settings.recruitingCalendlyUrl) throw new Error("Add your Calendly link under Recruiting → Settings first.");
  await sendCandidateEmail(
    c,
    settings.recruitingInviteSubject || DEFAULT_INVITE_SUBJECT,
    settings.recruitingInviteBody || DEFAULT_INVITE_BODY
  );
  await prisma.candidate.update({
    where: { id: c.id },
    data: { invitedAt: new Date(), reminderAt: null, stage: c.stage === "NEW" ? "INVITED" : c.stage },
  });
}

/** Admins and managers — who hear about new applications. */
export async function recruiters() {
  const staff = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] }, active: true }, select: { id: true } });
  return staff.map((s) => s.id);
}

export async function notifyNewCandidate(c: { id: string; name: string; source: string | null }) {
  await notify(await recruiters(), {
    type: "NEW_CANDIDATE",
    title: `New application: ${c.name}`,
    body: c.source ? `Source: ${c.source}` : null,
    link: `/admin/recruiting/${c.id}`,
  });
}

/**
 * Daily job: one reminder to candidates who were invited 3+ days ago and
 * haven't booked; GDPR clean-up of closed applications past retention.
 */
export async function recruitingDailyJob() {
  const settings = await getSettings();
  const out = { reminders: 0, deleted: 0, errors: [] as string[] };
  if (settings.recruitingCalendlyUrl) {
    const due = await prisma.candidate.findMany({
      where: { stage: "INVITED", reminderAt: null, bookedAt: null, invitedAt: { lt: new Date(Date.now() - 3 * 86_400_000) } },
    });
    for (const c of due) {
      try {
        await sendCandidateEmail(c, REMINDER_SUBJECT, REMINDER_BODY);
        await prisma.candidate.update({ where: { id: c.id }, data: { reminderAt: new Date() } });
        out.reminders++;
      } catch (e: any) {
        out.errors.push(`${c.email}: ${e?.message || e}`);
      }
    }
  }
  const cutoff = new Date(Date.now() - settings.recruitingRetentionMonths * 30 * 86_400_000);
  const old = await prisma.candidate.findMany({
    where: {
      OR: [
        { stage: "REJECTED", closedAt: { lt: cutoff } },
        // Never answered: also cleaned up after the retention period.
        { stage: { in: ["NEW", "INVITED"] }, createdAt: { lt: cutoff } },
      ],
    },
    select: { id: true, cvKey: true },
  });
  for (const c of old) {
    await deletePrivateFile(c.cvKey);
    await prisma.candidate.delete({ where: { id: c.id } });
    out.deleted++;
  }
  return out;
}

/** Booking webhook: a candidate booked the intro meeting. Returns true if matched. */
export async function markCandidateBooked(email: string, when: Date | null) {
  const c = await prisma.candidate.findUnique({ where: { email } });
  if (!c) return false;
  await prisma.candidate.update({
    where: { id: c.id },
    data: { bookedAt: when ?? new Date(), stage: ["NEW", "INVITED"].includes(c.stage) ? "BOOKED" : c.stage },
  });
  const label = when ? when.toLocaleString("sl-SI", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Ljubljana" }) : "a time";
  await notify(await recruiters(), {
    type: "CANDIDATE_BOOKED",
    title: `📅 ${c.name} booked an intro meeting`,
    body: `For ${label}.`,
    link: `/admin/recruiting/${c.id}`,
  });
  return true;
}
