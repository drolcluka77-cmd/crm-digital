import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import {
  GEO_ACTIVE_STATUSES,
  GEO_OPEN_TASK_STATUSES,
  GEO_PLATFORM_LABEL,
  GEO_STATUS_LABEL,
  missingCardFields,
  missingHandoverFields,
  type GeoCard,
} from "@/lib/geo-labels";

export * from "@/lib/geo-labels";

const DAY = 86_400_000;

// ─── Default task templates (from the delivery spec) ──────────────────────

type Tpl = {
  key?: string;
  packages: string[];
  title: string;
  description?: string;
  phase: string;
  recurrence?: "ONCE" | "MONTHLY" | "QUARTERLY";
  dueDay: number;
  needsApproval?: boolean;
  technical?: boolean;
};
const ALL = ["VISIBLE", "RECOMMENDED", "CONCIERGE"];
const RC = ["RECOMMENDED", "CONCIERGE"];

export const DEFAULT_GEO_TEMPLATES: Tpl[] = [
  // Visible (base for every package)
  {
    key: "kickoff-card",
    packages: ALL,
    title: "Uvodni klic in izpolnjena kartica podjetja",
    description:
      "Pokliči kontaktno osebo in se predstavi.\nIzpolni kartico podjetja (delovni čas, storitve s cenami, opis, pogosta vprašanja, profili).\nDogovori se za fotografije (najmanj 10) in jih shrani v mapo.\nSestavi 10 ključnih iskanj in AI vprašanja.",
    phase: "START",
    dueDay: 3,
  },
  {
    key: "access",
    packages: ALL,
    title: "Zahtevaj dostope: Google profil, spletna stran, Bing, Apple, Facebook",
    description:
      "Stranko prosi, da nas doda kot upravitelja (info@mrpicked.eu). Gesel ne sprejemamo.\nVsak dostop zabeleži v zavihku Dostopi.",
    phase: "START",
    dueDay: 3,
  },
  {
    key: "baseline",
    packages: ALL,
    title: "Izhodiščna meritev: AI vprašanja + 10 iskanj na Zemljevidih (mesec 0)",
    description: "Postavi vsa AI vprašanja v ChatGPT, Gemini, Perplexity in Googlove AI odgovore.\nZapiši omembe, konkurente in napačne podatke.\nVnesi meritev za mesec 0.",
    phase: "START",
    dueDay: 5,
  },
  {
    packages: ALL,
    title: "Pregled Google profila in podatkov na drugih platformah (neskladja, podvojeni vpisi)",
    phase: "START",
    dueDay: 7,
  },
  {
    packages: ALL,
    title: "Google profil: kategorije, opis, storitve oz. meni, atributi, delovni čas s prazniki, fotografije, povezava",
    phase: "FIX",
    dueDay: 14,
    needsApproval: true,
  },
  {
    packages: ALL,
    title: "Vpisi na 15+ platformah: enaki podatki, odstranjeni podvojeni vpisi",
    phase: "FIX",
    dueDay: 30,
  },
  {
    key: "website-code",
    packages: ALL,
    title: "Spletna stran: schema.org, llms.txt, robots.txt, enaki podatki v nogi, storitve in cene berljive",
    description:
      "Kodo dobiš v zavihku Koda (sestavljena iz kartice).\nWordPress / Wix / Squarespace: vstavi po navodilih v zavihku Koda.\nStran po meri s programerjem: pošlji mu e-mail iz zavihka Koda.\nStran po meri brez programerja: naloga gre našemu programerju.\nNa koncu klikni »Preveri stran«.",
    phase: "FIX",
    dueDay: 21,
    needsApproval: true,
    technical: true,
  },
  {
    packages: ALL,
    title: "Google Search Console in Bing Webmaster Tools, oddaja sitemapa",
    phase: "FIX",
    dueDay: 21,
    technical: true,
  },
  { packages: ALL, title: "Objava na Google profilu (1/4)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 7, needsApproval: true },
  { packages: ALL, title: "Objava na Google profilu (2/4)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 14, needsApproval: true },
  { packages: ALL, title: "Objava na Google profilu (3/4)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 21, needsApproval: true },
  { packages: ALL, title: "Objava na Google profilu (4/4)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 28, needsApproval: true },
  {
    packages: ALL,
    title: "Kontrola profila: prazniki, nove fotografije, predlagane spremembe drugih uporabnikov",
    phase: "MONTHLY",
    recurrence: "MONTHLY",
    dueDay: 25,
  },
  { packages: ALL, title: "Preverjanje vpisov", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 25 },
  {
    key: "measurement",
    packages: ALL,
    title: "Meritev: ista AI vprašanja + 10 iskanj",
    phase: "MONTHLY",
    recurrence: "MONTHLY",
    dueDay: 28,
  },
  {
    key: "report",
    packages: ALL,
    title: "Mesečno poročilo z oceno vidnosti",
    phase: "MONTHLY",
    recurrence: "MONTHLY",
    dueDay: 0,
    needsApproval: true,
  },
  {
    key: "day90",
    packages: ALL,
    title: "Primerjava z izhodiščem in preverjanje obljube 90 dni",
    phase: "DAY90",
    dueDay: 90,
    needsApproval: true,
  },
  // Recommended adds
  { packages: RC, title: "Razširi AI vprašanja na 50 in dodaj 3 konkurente", phase: "START", dueDay: 7 },
  {
    packages: [...RC, "ADDON_REVIEWS"],
    title: "Postavi zbiranje ocen: povezava ali QR koda, po možnosti samodejen SMS ali e-mail po obisku",
    phase: "FIX",
    dueDay: 21,
  },
  { packages: ["RECOMMENDED"], title: "2 AI videa", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 15, needsApproval: true },
  {
    packages: [...RC, "ADDON_REVIEWS"],
    title: "Odgovori na nove Google ocene v 48 urah (sproti)",
    phase: "MONTHLY",
    recurrence: "MONTHLY",
    dueDay: 0,
    needsApproval: true,
  },
  { packages: RC, title: "2 strani z vprašanji strank", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 20, needsApproval: true },
  { packages: RC, title: "Četrtletni pregled rezultatov s stranko", phase: "QUARTERLY", recurrence: "QUARTERLY", dueDay: 10 },
  // Concierge adds
  {
    packages: ["CONCIERGE", "ADDON_WHATSAPP"],
    title: "Postavitev WhatsApp conciergea: pogosta vprašanja, cenik, pravila predaje lastniku, test",
    phase: "FIX",
    dueDay: 21,
    needsApproval: true,
    technical: true,
  },
  { packages: ["CONCIERGE", "ADDON_WHATSAPP"], title: "Opomniki za termine in sledenje neprihodom", phase: "FIX", dueDay: 30 },
  { packages: ["CONCIERGE"], title: "Storitve in cenik na spletu (6 jezikov)", phase: "FIX", dueDay: 30, needsApproval: true },
  { packages: ["CONCIERGE"], title: "4 AI videi", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 15, needsApproval: true },
  { packages: ["CONCIERGE"], title: "Sezonska kampanja", phase: "QUARTERLY", recurrence: "QUARTERLY", dueDay: 15, needsApproval: true },
  { packages: ["CONCIERGE"], title: "Mesečni strateški sestanek", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 5 },
  // Add-ons
  { packages: ["ADDON_VIDEOS"], title: "3 dodatni AI videi (dodatek)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 15, needsApproval: true },
  {
    packages: ["ADDON_WEBSITE"],
    title: "Spletna stran za AI: projekt (administrator doda seznam nalog)",
    phase: "FIX",
    dueDay: 30,
    technical: true,
  },
];

/** Creates the default templates once (when the table is empty). */
export async function ensureGeoTemplates() {
  if ((await prisma.geoTaskTemplate.count()) > 0) return;
  await prisma.geoTaskTemplate.createMany({
    data: DEFAULT_GEO_TEMPLATES.map((t, i) => ({
      key: t.key ?? null,
      packages: t.packages,
      title: t.title,
      description: t.description ?? null,
      phase: t.phase,
      recurrence: t.recurrence ?? "ONCE",
      dueDay: t.dueDay,
      needsApproval: !!t.needsApproval,
      technical: !!t.technical,
      sortOrder: i,
    })),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function asCard(v: unknown): GeoCard {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as GeoCard) : {};
}
export function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

/** Template groups that apply to a client: its package plus add-ons. */
export function clientGroups(c: { package: string | null; addons: unknown }): string[] {
  return [c.package || "VISIBLE", ...asStrings(c.addons).map((a) => `ADDON_${a}`)];
}

export async function geoLog(clientId: string, user: { id: string; name: string } | null, action: string, detail?: string | null) {
  await prisma.geoLog.create({
    data: { clientId, userId: user?.id ?? null, userName: user?.name ?? "CRM", action, detail: detail ?? null },
  });
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function dayInMonth(year: number, month: number, day: number) {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const d = day <= 0 || day > last ? last : day;
  return new Date(Date.UTC(year, month, d, 9, 0, 0));
}
function monthsBetween(a: Date, b: Date) {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

// ─── Task generation ──────────────────────────────────────────────────────

/** One-time tasks from the package templates. Run once, when the assistant is assigned. */
export async function createOnceTasks(clientId: string) {
  await ensureGeoTemplates();
  const c = await prisma.geoClient.findUnique({ where: { id: clientId } });
  if (!c || !c.startDate) return 0;
  const groups = clientGroups(c);
  const card = asCard(c.card);
  const templates = await prisma.geoTaskTemplate.findMany({ where: { active: true, recurrence: "ONCE" }, orderBy: { sortOrder: "asc" } });
  let n = 0;
  for (const t of templates) {
    if (!asStrings(t.packages).some((g) => groups.includes(g))) continue;
    const exists = await prisma.geoTask.findFirst({ where: { clientId, templateId: t.id }, select: { id: true } });
    if (exists) continue;
    await prisma.geoTask.create({
      data: {
        clientId,
        templateId: t.id,
        key: t.key,
        title: t.title,
        description: t.description,
        phase: t.phase,
        dueDate: new Date(c.startDate.getTime() + t.dueDay * DAY),
        assigneeId: c.assistantId,
        needsApproval: t.needsApproval,
        technical: t.technical,
        note: t.key === "website-code" && card.sitePlatform === "NONE" ? "Stranka nima spletne strani." : null,
      },
    });
    n++;
  }
  return n;
}

/** Monthly and quarterly tasks for every month from the start up to now (idempotent). */
export async function createRecurringTasks(clientId: string, now = new Date()) {
  await ensureGeoTemplates();
  const c = await prisma.geoClient.findUnique({ where: { id: clientId } });
  if (!c || !c.startDate || !GEO_ACTIVE_STATUSES.includes(c.status)) return 0;
  const groups = clientGroups(c);
  const templates = await prisma.geoTaskTemplate.findMany({
    where: { active: true, recurrence: { in: ["MONTHLY", "QUARTERLY"] } },
    orderBy: { sortOrder: "asc" },
  });
  const start = c.startDate;
  const months = Math.max(0, monthsBetween(start, now));
  let n = 0;
  // Only the current month and the previous one (so a late run still catches up), never the whole history.
  for (let k = Math.max(0, months - 1); k <= months; k++) {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth() + k;
    const first = new Date(Date.UTC(y, m, 1));
    const period = monthKey(first);
    for (const t of templates) {
      if (!asStrings(t.packages).some((g) => groups.includes(g))) continue;
      if (t.recurrence === "QUARTERLY" && (k === 0 || k % 3 !== 0)) continue;
      const due = dayInMonth(first.getUTCFullYear(), first.getUTCMonth(), t.dueDay);
      if (due < start) continue; // the first month only gets what's still ahead
      if (c.endsAt && due > c.endsAt) continue; // cancelled: nothing after the notice period
      const exists = await prisma.geoTask.findFirst({ where: { clientId, templateId: t.id, period }, select: { id: true } });
      if (exists) continue;
      await prisma.geoTask.create({
        data: {
          clientId,
          templateId: t.id,
          key: t.key,
          period,
          title: t.title,
          description: t.description,
          phase: t.phase,
          dueDate: due,
          assigneeId: c.assistantId,
          needsApproval: t.needsApproval,
          technical: t.technical,
        },
      });
      n++;
    }
  }
  return n;
}

const DEFAULT_ACCESS = ["GOOGLE", "WEBSITE", "BING", "APPLE", "FACEBOOK", "INSTAGRAM"];

export async function ensureAccessRows(clientId: string, industry: string | null) {
  const have = await prisma.geoAccess.findMany({ where: { clientId }, select: { platform: true } });
  const want = [...DEFAULT_ACCESS, ...(industry === "RESTAURANT" || industry === "LODGING" || industry === "ACTIVITIES" ? ["TRIPADVISOR"] : [])];
  const missing = want.filter((p) => !have.some((h) => h.platform === p));
  if (missing.length) await prisma.geoAccess.createMany({ data: missing.map((platform) => ({ clientId, platform })) });
}

// ─── Status machine ───────────────────────────────────────────────────────

async function setStatus(clientId: string, from: string, to: string, by: { id: string; name: string } | null, why?: string) {
  await prisma.geoClient.update({ where: { id: clientId }, data: { status: to, statusAt: new Date() } });
  await geoLog(clientId, by, "STATUS", `${GEO_STATUS_LABEL[from] || from} → ${GEO_STATUS_LABEL[to] || to}${why ? ` (${why})` : ""}`);
}

/** Moves the client forward as far as its conditions allow. Returns the new status. */
export async function advanceGeoClient(clientId: string, by: { id: string; name: string } | null = null): Promise<string> {
  for (let guard = 0; guard < 8; guard++) {
    const c = await prisma.geoClient.findUnique({
      where: { id: clientId },
      include: { accesses: true, measurements: { select: { month: true } } },
    });
    if (!c) return "";
    let next: string | null = null;
    switch (c.status) {
      case "HANDED_OVER":
        if (c.assistantId && missingHandoverFields(c).length === 0) next = "KICKOFF";
        break;
      case "KICKOFF":
        if (missingCardFields(asCard(c.card), c.package).length === 0) next = "ACCESS";
        break;
      case "ACCESS":
        if (c.accesses.some((a) => a.platform === "GOOGLE" && a.status === "APPROVED")) next = "BASELINE";
        break;
      case "BASELINE":
        if (c.measurements.some((m) => m.month === 0)) next = "FIX";
        break;
      case "FIX": {
        const open = await prisma.geoTask.count({
          where: { clientId, phase: "FIX", status: { notIn: ["DONE", "NOT_POSSIBLE"] } },
        });
        const any = await prisma.geoTask.count({ where: { clientId, phase: "FIX" } });
        if (any > 0 && open === 0) next = "MAINTENANCE";
        break;
      }
      case "MAINTENANCE":
        if (!c.day90DoneAt && c.startDate && Date.now() >= c.startDate.getTime() + 90 * DAY) next = "DAY90";
        break;
    }
    if (!next) return c.status;
    await setStatus(clientId, c.status, next, by);
    if (next === "DAY90") await notifyAdmins({ type: "GEO", title: `Dan 90: ${c.company}`, body: "Primerjaj z izhodiščem in potrdi.", link: `/izvedba/stranke/${clientId}?tab=meritve` });
  }
  return "";
}

export async function geoAdmins() {
  const rows = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  return rows.map((r) => r.id);
}
async function notifyAdmins(n: { type: string; title: string; body?: string; link?: string }) {
  await notify(await geoAdmins(), n);
}

// ─── Card changes → update tasks on every platform ───────────────────────

const NAP_KEYS: (keyof GeoCard)[] = ["legalName", "address", "postalCode", "city", "phone", "website", "hours", "open24h", "holidays"];

export function napChanged(before: GeoCard, after: GeoCard) {
  return NAP_KEYS.filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
}

export async function createUpdateTasksForChange(clientId: string, changed: string[]) {
  const c = await prisma.geoClient.findUnique({ where: { id: clientId }, include: { accesses: true } });
  if (!c || !GEO_ACTIVE_STATUSES.includes(c.status)) return 0;
  // Before the fix phase everything is still being set up for the first time.
  if (["KICKOFF", "ACCESS", "BASELINE"].includes(c.status)) return 0;
  const what = changed.join(", ");
  const due = new Date(Date.now() + 3 * DAY);
  let n = 0;
  for (const a of c.accesses.filter((x) => x.status === "APPROVED")) {
    const isSite = a.platform === "WEBSITE";
    await prisma.geoTask.create({
      data: {
        clientId,
        key: isSite ? "website-code" : "card-update",
        title: isSite
          ? "Posodobi kodo na spletni strani (schema, llms.txt, noga) — podatki so se spremenili"
          : `Posodobi podatke: ${GEO_PLATFORM_LABEL[a.platform] || a.platform}`,
        description: `Spremenjeno v kartici: ${what}.`,
        phase: "MONTHLY",
        dueDate: due,
        assigneeId: c.assistantId,
        technical: isSite,
      },
    });
    n++;
  }
  return n;
}

// ─── Daily job ────────────────────────────────────────────────────────────

export async function geoDailyJob(now = new Date()) {
  const out = { tasks: 0, advanced: 0, reminders: 0 };
  const clients = await prisma.geoClient.findMany({ where: { status: { in: GEO_ACTIVE_STATUSES } }, select: { id: true, status: true, endsAt: true } });
  for (const c of clients) {
    out.tasks += await createRecurringTasks(c.id, now);
    const s = await advanceGeoClient(c.id);
    if (s !== c.status) out.advanced++;
  }
  // Cancelled clients: drop open tasks after the notice period.
  await prisma.geoTask.deleteMany({
    where: { status: { in: GEO_OPEN_TASK_STATUSES }, client: { status: "CANCELLED", endsAt: { lt: now } } },
  });

  // "Waiting for the client" for more than ~5 working days → remind the assistant once.
  const stale = await prisma.geoTask.findMany({
    where: { status: "WAITING_CLIENT", remindedAt: null, waitingSince: { lt: new Date(now.getTime() - 7 * DAY) } },
    include: { client: { select: { company: true } } },
  });
  for (const t of stale) {
    await notify([t.assigneeId], {
      type: "GEO",
      title: `Pokliči stranko: ${t.client.company}`,
      body: `Naloga »${t.title}« že več kot teden dni čaka stranko.`,
      link: `/izvedba/stranke/${t.clientId}?tab=naloge`,
    });
    await prisma.geoTask.update({ where: { id: t.id }, data: { remindedAt: now } });
    out.reminders++;
  }

  // Mondays: each assistant gets this week's list; admins get overdue counts.
  if (now.getUTCDay() === 1) {
    const weekEnd = new Date(now.getTime() + 7 * DAY);
    const assistants = await prisma.user.findMany({ where: { role: "GEO", active: true }, select: { id: true } });
    for (const a of assistants) {
      const [due, late] = await Promise.all([
        prisma.geoTask.count({ where: { assigneeId: a.id, status: { in: GEO_OPEN_TASK_STATUSES }, dueDate: { gte: now, lte: weekEnd } } }),
        prisma.geoTask.count({ where: { assigneeId: a.id, status: { in: GEO_OPEN_TASK_STATUSES }, dueDate: { lt: now } } }),
      ]);
      if (due + late > 0)
        await notify([a.id], { type: "GEO", title: `Ta teden: ${due} nalog${late ? `, ${late} zamujenih` : ""}`, link: "/izvedba" });
    }
    const overdue = await prisma.geoTask.count({ where: { status: { in: GEO_OPEN_TASK_STATUSES }, dueDate: { lt: now } } });
    const approvals = await prisma.geoTask.count({ where: { status: "WAITING_APPROVAL" } });
    if (overdue + approvals > 0)
      await notifyAdmins({ type: "GEO", title: `GEO izvedba: ${overdue} zamujenih nalog, ${approvals} čaka potrditev`, link: "/admin/geo" });
  }
  return out;
}
