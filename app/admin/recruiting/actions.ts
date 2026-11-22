"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { generateTempPassword, hashPassword } from "@/lib/auth";
import { sendEmail } from "@/lib/mailer";
import { getBaseUrl } from "@/lib/url";
import { escapeHtml } from "@/lib/format";
import { deletePrivateFile } from "@/lib/upload";
import { CANDIDATE_STAGES, sendInvite, firstName } from "@/lib/recruiting";

export type ActionResult = { error?: string; success?: string; tempPassword?: string } | void;

function revalidate(id?: string) {
  revalidatePath("/admin/recruiting");
  if (id) revalidatePath(`/admin/recruiting/${id}`);
}

export async function saveRecruitingSettings(fd: FormData): Promise<ActionResult> {
  await requireStaff();
  const url = String(fd.get("calendly") || "").trim();
  if (url && !/^https:\/\//.test(url)) return { error: "The booking link must start with https://" };
  const months = Math.max(1, Math.min(36, Math.round(Number(fd.get("retention")) || 6)));
  await prisma.settings.update({
    where: { id: 1 },
    data: {
      recruitingCalendlyUrl: url || null,
      recruitingAutoInvite: fd.get("autoInvite") === "on",
      recruitingInviteSubject: String(fd.get("subject") || "").trim() || null,
      recruitingInviteBody: String(fd.get("body") || "").trim() || null,
      recruitingRetentionMonths: months,
    },
  });
  revalidate();
  return { success: "Saved." };
}

export async function updateCandidate(id: string, data: { stage?: string; rating?: number | null; notes?: string }): Promise<ActionResult> {
  await requireStaff();
  const patch: any = {};
  if (data.stage) {
    if (!CANDIDATE_STAGES.includes(data.stage as any)) return { error: "Unknown stage." };
    patch.stage = data.stage;
    patch.closedAt = ["HIRED", "REJECTED"].includes(data.stage) ? new Date() : null;
  }
  if (data.rating !== undefined) patch.rating = data.rating && data.rating >= 1 && data.rating <= 5 ? data.rating : null;
  if (data.notes !== undefined) patch.notes = data.notes.slice(0, 5000) || null;
  await prisma.candidate.update({ where: { id }, data: patch });
  revalidate(id);
  return { success: "Saved." };
}

export async function resendInvite(id: string): Promise<ActionResult> {
  await requireStaff();
  try {
    await sendInvite(id);
  } catch (e: any) {
    return { error: e?.message || "Couldn't send the invitation." };
  }
  revalidate(id);
  return { success: "Invitation sent." };
}

/** Bulk: invite every selected candidate who hasn't been invited yet. */
export async function inviteMany(ids: string[]): Promise<ActionResult> {
  await requireStaff();
  let sent = 0;
  const errors: string[] = [];
  for (const id of ids) {
    try {
      await sendInvite(id);
      sent++;
    } catch (e: any) {
      errors.push(e?.message || String(e));
    }
  }
  revalidate();
  return errors.length ? { error: `${sent} sent, ${errors.length} failed: ${errors[0]}` } : { success: `${sent} invitation${sent === 1 ? "" : "s"} sent.` };
}

export async function rejectCandidate(id: string, sendNote: boolean): Promise<ActionResult> {
  await requireStaff();
  const c = await prisma.candidate.findUnique({ where: { id } });
  if (!c) return { error: "Not found." };
  if (sendNote) {
    const text = `Pozdravljeni ${firstName(c.name)},\n\nhvala za vaš čas in zanimanje za delo pri nas. Tokrat smo se odločili za druge kandidate. Želimo vam veliko uspeha in vas lepo pozdravljamo.\n\nAURELIA GROUP d.o.o.`;
    try {
      await sendEmail({ to: c.email, subject: "Vaša prijava", text, html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55">${escapeHtml(text).replace(/\n/g, "<br>")}</div>` });
    } catch (e: any) {
      return { error: `Couldn't send the e-mail: ${e?.message || e}` };
    }
  }
  await prisma.candidate.update({ where: { id }, data: { stage: "REJECTED", closedAt: new Date() } });
  revalidate(id);
  return { success: sendNote ? "Marked as not selected and the candidate was told." : "Marked as not selected." };
}

/** GDPR: erase a candidate (on request). */
export async function deleteCandidate(id: string): Promise<ActionResult> {
  await requireStaff();
  const c = await prisma.candidate.findUnique({ where: { id } });
  if (!c) return { error: "Not found." };
  await deletePrivateFile(c.cvKey);
  await prisma.candidate.delete({ where: { id } });
  revalidate();
  return { success: "Candidate and CV deleted." };
}

/** Creates the seller account, gives products, e-mails the login details. */
export async function hireCandidate(id: string, fd: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const c = await prisma.candidate.findUnique({ where: { id } });
  if (!c) return { error: "Not found." };
  if (c.hiredUserId) return { error: "Already hired." };
  if (await prisma.user.findUnique({ where: { email: c.email } })) {
    return { error: "An account with this e-mail already exists (Team)." };
  }

  let managerId: string | null = actor.role === "MANAGER" ? actor.id : String(fd.get("managerId") || "") || null;
  if (managerId && actor.role === "ADMIN") {
    const m = await prisma.user.findUnique({ where: { id: managerId } });
    if (!m || m.role !== "MANAGER") managerId = null;
  }

  const tempPassword = generateTempPassword();
  const user = await prisma.user.create({
    data: { name: c.name, email: c.email, phone: c.phone, role: "SALES", managerId, passwordHash: await hashPassword(tempPassword), active: true },
  });
  const productIds = fd.getAll("productIds").map(String).filter(Boolean);
  if (productIds.length) {
    const valid = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
    await prisma.productAccess.createMany({ data: valid.map((p) => ({ userId: user.id, productId: p.id, grantedById: actor.id })) });
  }
  await prisma.candidate.update({ where: { id }, data: { stage: "HIRED", hiredUserId: user.id, closedAt: new Date() } });

  let mailed = true;
  if (fd.get("sendLogin") === "on") {
    const login = `${getBaseUrl()}/login`;
    const text = `Pozdravljeni ${firstName(c.name)},\n\ndobrodošli v ekipi AURELIA GROUP!\n\nVaš račun v našem prodajnem CRM-ju je pripravljen:\n${login}\nE-pošta: ${c.email}\nZačasno geslo: ${tempPassword}\n\nPo prvi prijavi geslo zamenjajte pod Account. V CRM-ju najdete svoje produkte, prodajne liste in priporočene kontakte za klice.\n\nLep pozdrav,\nAURELIA GROUP d.o.o.`;
    try {
      await sendEmail({ to: c.email, subject: "Dobrodošli — vaš dostop do CRM", text, html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.55">${escapeHtml(text).replace(/\n/g, "<br>")}</div>` });
    } catch {
      mailed = false;
    }
  }
  revalidate(id);
  revalidatePath("/admin/team");
  return {
    success: mailed && fd.get("sendLogin") === "on" ? "Seller account created and login details e-mailed." : "Seller account created.",
    tempPassword,
  };
}
