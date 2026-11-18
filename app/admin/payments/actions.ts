"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { recordPayment } from "@/lib/payments";

export type ActionResult = { error?: string; success?: string } | void;

function done() {
  revalidatePath("/admin/payments");
  revalidatePath("/admin/commissions");
  revalidatePath("/crm/commission");
}

export async function addPayment(quoteId: string, amountRaw: string, dateRaw: string, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const amount = Number(String(amountRaw).replace(/\s/g, "").replace(",", "."));
  const paidAt = new Date(`${dateRaw}T12:00:00`);
  const r = await recordPayment({ quoteId, amount, paidAt, note: note.trim() || null, createdById: admin.id });
  if (r.error) return { error: r.error };
  done();
  return { success: `Payment recorded. Seller's commission: ${(r.commission || 0).toLocaleString("sl-SI", { style: "currency", currency: "EUR" })}.` };
}

export async function deletePayment(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.payment.delete({ where: { id } });
  done();
  return { success: "Payment deleted." };
}

export async function saveCommissionRules(ownRateRaw: string, monthsRaw: string): Promise<ActionResult> {
  await requireAdmin();
  const own = Number(ownRateRaw.replace(",", "."));
  const months = Math.round(Number(monthsRaw));
  if (!Number.isFinite(own) || own < 0 || own > 100) return { error: "Own-lead rate: 0–100 %." };
  if (!Number.isFinite(months) || months < 1 || months > 120) return { error: "Months: 1–120." };
  await prisma.settings.update({ where: { id: 1 }, data: { ownLeadCommissionRate: own, commissionMonths: months } });
  done();
  return { success: "Saved. Applies to payments recorded from now on." };
}
