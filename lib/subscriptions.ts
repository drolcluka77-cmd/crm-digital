import { prisma } from "@/lib/prisma";

export async function loadSubscriptions(userIds: string[] | "ALL") {
  const subs = await prisma.subscription.findMany({
    where: userIds === "ALL" ? {} : { userId: { in: userIds } },
    include: {
      customer: { select: { id: true, name: true, company: true } },
      quote: { select: { id: true, number: true } },
      user: { select: { name: true } },
      renewals: { select: { id: true } },
    },
    orderBy: [{ status: "asc" }, { renewalDate: "asc" }],
  });
  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 86_400_000;
  const active = subs.filter((s) => s.status === "ACTIVE");
  const churned = subs.filter((s) => s.status === "CANCELLED" && s.cancelledAt && s.cancelledAt.getTime() >= ninetyDaysAgo);
  const mrr = active.reduce((sum, s) => sum + s.monthlyValue, 0);
  const churnedMrr = churned.reduce((sum, s) => sum + s.monthlyValue, 0);
  const dueSoon = active.filter((s) => s.renewalDate.getTime() - now < 30 * 86_400_000);

  return {
    stats: {
      active: active.length,
      mrr,
      arr: mrr * 12,
      dueSoon: dueSoon.length,
      churned90: churned.length,
      churnRate90: mrr + churnedMrr > 0 ? (churnedMrr / (mrr + churnedMrr)) * 100 : 0,
    },
    rows: subs.map((s) => ({
      id: s.id,
      customerId: s.customer.id,
      customer: s.customer.company || s.customer.name,
      quoteId: s.quote.id,
      quoteNumber: s.quote.number,
      seller: s.user?.name ?? "—",
      status: s.status,
      startDate: s.startDate.toISOString(),
      renewalDate: s.renewalDate.toISOString(),
      termMonths: s.termMonths,
      monthlyValue: s.monthlyValue,
      annualValue: s.annualValue,
      renewalCommission: s.renewalCommission,
      renewals: s.renewals.length,
      cancelReason: s.cancelReason,
      cancelledAt: s.cancelledAt?.toISOString() ?? null,
    })),
  };
}

export type SubscriptionData = Awaited<ReturnType<typeof loadSubscriptions>>;
