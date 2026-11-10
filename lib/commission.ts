import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { computeQuoteBreakdown } from "@/lib/format";

/** "2026-11" for a date. */
export function periodOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function periodRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
}

export function periodLabel(period: string): string {
  const { start } = periodRange(period);
  return start.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function isValidPeriod(p: string | undefined | null): p is string {
  return !!p && /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
}

/** The last n periods, newest first. */
export function recentPeriods(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(periodOf(d));
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export type Tier = { min: number; rate: number };

/** Parses "10000:2, 25000:4" into tiers (ignores anything malformed). */
export function parseTiers(raw: string | null | undefined): Tier[] {
  return (raw || "")
    .split(/[,;\n]/)
    .map((part) => part.trim().split(":").map((x) => Number(x.trim().replace(/[€\s]/g, ""))))
    .filter(([min, rate]) => Number.isFinite(min) && Number.isFinite(rate) && min >= 0 && rate > 0)
    .map(([min, rate]) => ({ min, rate }))
    .sort((a, b) => a.min - b.min);
}

export function bonusRateFor(tiers: Tier[], wonValue: number): number {
  let rate = 0;
  for (const t of tiers) if (wonValue >= t.min) rate = t.rate;
  return rate;
}

export type Statement = {
  userId: string;
  period: string;
  wonValue: number;
  quoteCommission: number;
  renewalValue: number;
  renewalCommission: number;
  bonusRate: number;
  bonus: number;
  earned: number;
  paid: number;
  balance: number;
  deals: {
    quoteId: string;
    number: string;
    customer: string;
    decidedAt: Date;
    annualNet: number;
    commission: number;
  }[];
  renewals: { id: string; customer: string; renewedAt: Date; annualValue: number; commission: number }[];
  payouts: { id: string; amount: number; paidAt: Date; note: string | null }[];
};

/**
 * Monthly commission statement for several sellers:
 *   commission on quotes accepted that month (first-year value × line rate)
 * + commission on subscription renewals that month
 * + tier bonus on the month's won first-year value (Settings → tiers)
 * − payouts recorded for that period.
 */
export async function computeStatements(userIds: string[], period: string): Promise<Statement[]> {
  const { start, end } = periodRange(period);
  const settings = await getSettings();
  const tiers = parseTiers(settings.commissionTiers);

  const [quotes, renewals, payouts] = await Promise.all([
    prisma.quote.findMany({
      where: { userId: { in: userIds }, status: "ACCEPTED", decidedAt: { gte: start, lt: end } },
      include: { items: true, customer: { select: { name: true, company: true } } },
      orderBy: { decidedAt: "asc" },
    }),
    prisma.subscriptionRenewal.findMany({
      where: { userId: { in: userIds }, renewedAt: { gte: start, lt: end } },
      include: { subscription: { include: { customer: { select: { name: true, company: true } } } } },
      orderBy: { renewedAt: "asc" },
    }),
    prisma.commissionPayout.findMany({
      where: { userId: { in: userIds }, period },
      orderBy: { paidAt: "asc" },
    }),
  ]);

  return userIds.map((userId) => {
    const deals = quotes
      .filter((q) => q.userId === userId)
      .map((q) => {
        const b = computeQuoteBreakdown(q.items, q.discount, q.vatRate);
        return {
          quoteId: q.id,
          number: q.number,
          customer: q.customer.company || q.customer.name,
          decidedAt: q.decidedAt!,
          annualNet: b.annualNet,
          commission: b.commission,
        };
      });
    const rens = renewals
      .filter((r) => r.userId === userId)
      .map((r) => ({
        id: r.id,
        customer: r.subscription.customer.company || r.subscription.customer.name,
        renewedAt: r.renewedAt,
        annualValue: r.annualValue,
        commission: r.commission,
      }));
    const pays = payouts
      .filter((p) => p.userId === userId)
      .map((p) => ({ id: p.id, amount: p.amount, paidAt: p.paidAt, note: p.note }));

    const wonValue = deals.reduce((s, d) => s + d.annualNet, 0);
    const quoteCommission = deals.reduce((s, d) => s + d.commission, 0);
    const renewalValue = rens.reduce((s, r) => s + r.annualValue, 0);
    const renewalCommission = rens.reduce((s, r) => s + r.commission, 0);
    const bonusRate = bonusRateFor(tiers, wonValue);
    const bonus = wonValue * (bonusRate / 100);
    const earned = quoteCommission + renewalCommission + bonus;
    const paid = pays.reduce((s, p) => s + p.amount, 0);
    return {
      userId,
      period,
      wonValue,
      quoteCommission,
      renewalValue,
      renewalCommission,
      bonusRate,
      bonus,
      earned,
      paid,
      balance: earned - paid,
      deals,
      renewals: rens,
      payouts: pays,
    };
  });
}

export async function computeStatement(userId: string, period: string): Promise<Statement> {
  return (await computeStatements([userId], period))[0];
}
