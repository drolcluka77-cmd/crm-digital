"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { isValidPeriod, periodLabel } from "@/lib/commission";
import { notify } from "@/lib/notify";
import { formatMoney } from "@/lib/format";

export type ActionResult = { error?: string; success?: string } | void;

/** Admin records a commission payment to a seller for a period. */
export async function recordPayout(userId: string, period: string, amount: number, note: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!isValidPeriod(period)) return { error: "Invalid period." };
  if (!Number.isFinite(amount) || amount === 0) return { error: "Enter the amount paid." };
  const seller = await prisma.user.findUnique({ where: { id: userId } });
  if (!seller || seller.role !== "SALES") return { error: "Seller not found." };

  await prisma.commissionPayout.create({
    data: { userId, period, amount, note: note.trim() || null, createdById: admin.id },
  });
  await notify([userId], {
    type: "PAYOUT",
    title: `Commission paid: ${formatMoney(amount)}`,
    body: `For ${periodLabel(period)}.${note.trim() ? ` ${note.trim()}` : ""}`,
    link: `/crm/commission?period=${period}`,
  });
  revalidatePath("/admin/commissions");
  revalidatePath("/crm/commission");
  return { success: "Payout recorded." };
}

export async function deletePayout(id: string): Promise<ActionResult> {
  await requireAdmin();
  await prisma.commissionPayout.delete({ where: { id } });
  revalidatePath("/admin/commissions");
  revalidatePath("/crm/commission");
}
