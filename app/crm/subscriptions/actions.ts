"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, type CurrentUser } from "@/lib/session";
import { canManageSeller } from "@/lib/access";
import { logActivity } from "@/lib/activity";
import { formatMoney } from "@/lib/format";

export type ActionResult = { error?: string; success?: string } | void;

async function loadAllowed(user: CurrentUser, id: string) {
  const sub = await prisma.subscription.findUnique({ where: { id } });
  if (!sub) return null;
  if (user.role === "SALES") return sub.userId === user.id ? sub : null;
  if (user.role === "ADMIN") return sub;
  return sub.userId && (await canManageSeller(user, sub.userId)) ? sub : null;
}

function revalidateSubs(customerId: string) {
  revalidatePath("/crm/subscriptions");
  revalidatePath("/admin/subscriptions");
  revalidatePath("/crm/commission");
  revalidatePath("/admin/commissions");
  revalidatePath(`/crm/customers/${customerId}`);
  revalidatePath("/crm");
}

/**
 * The client renewed for another term: records the renewal (with the
 * seller's renewal commission) and moves the renewal date forward.
 * The yearly value can be updated if the price changed.
 */
export async function renewSubscription(id: string, annualValueRaw?: number): Promise<ActionResult> {
  const user = await requireUser();
  const sub = await loadAllowed(user, id);
  if (!sub) return { error: "Subscription not found." };
  if (sub.status !== "ACTIVE") return { error: "Only active subscriptions can be renewed." };

  const annualValue = annualValueRaw && annualValueRaw > 0 ? annualValueRaw : sub.annualValue;
  // Keep the same commission % if the value changed.
  const rate = sub.annualValue > 0 ? sub.renewalCommission / sub.annualValue : 0;
  const commission = annualValue * rate;

  const next = new Date(sub.renewalDate);
  next.setMonth(next.getMonth() + sub.termMonths);

  await prisma.$transaction([
    prisma.subscriptionRenewal.create({
      data: { subscriptionId: id, userId: sub.userId, annualValue, commission },
    }),
    prisma.subscription.update({
      where: { id },
      data: {
        renewalDate: next,
        annualValue,
        monthlyValue: annualValue / 12,
        renewalCommission: commission,
      },
    }),
  ]);
  await logActivity(sub.customerId, user.id, "SUBSCRIPTION", `Renewed for ${sub.termMonths} months (${formatMoney(annualValue)} / year)`);
  revalidateSubs(sub.customerId);
  return { success: "Renewal recorded." };
}

export async function cancelSubscription(id: string, reason: string): Promise<ActionResult> {
  const user = await requireUser();
  const sub = await loadAllowed(user, id);
  if (!sub) return { error: "Subscription not found." };
  await prisma.subscription.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason.trim() || null },
  });
  await logActivity(sub.customerId, user.id, "SUBSCRIPTION", `Subscription cancelled${reason.trim() ? `: ${reason.trim()}` : ""}`);
  revalidateSubs(sub.customerId);
  return { success: "Marked as cancelled." };
}

export async function reactivateSubscription(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const sub = await loadAllowed(user, id);
  if (!sub) return { error: "Subscription not found." };
  await prisma.subscription.update({
    where: { id },
    data: { status: "ACTIVE", cancelledAt: null, cancelReason: null },
  });
  revalidateSubs(sub.customerId);
}
