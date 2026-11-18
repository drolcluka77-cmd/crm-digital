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
  /** First-year value of quotes accepted this month (for information). */
  wonValue: number;
  wonCount: number;
  /** Money customers actually paid this month (net) and the commission on it. */
  paidValue: number;
  paymentCommission: number;
  /** UGC: pay for videos published this month + view bonuses entered this month. */
  ugcPay: number;
  bonusRate: number;
  bonus: number;
  earned: number;
  paid: number;
  balance: number;
  payments: {
    id: string;
    quoteId: string;
    number: string;
    customer: string;
    paidAt: Date;
    amount: number;
    rate: number;
    commission: number;
  }[];
  ugc: { id: string; title: string; kind: "VIDEO" | "BONUS"; date: Date; amount: number; views: number | null }[];
  payouts: { id: string; amount: number; paidAt: Date; note: string | null }[];
};

/**
 * Monthly statement for several sellers:
 *   commission on customer payments received that month (lib/payments.ts)
 * + UGC pay (videos published that month, view bonuses entered that month)
 * + tier bonus on the month's paid value (Settings → tiers)
 * − payouts recorded for that period.
 */
export async function computeStatements(userIds: string[], period: string): Promise<Statement[]> {
  const { start, end } = periodRange(period);
  const settings = await getSettings();
  const tiers = parseTiers(settings.commissionTiers);

  const [quotes, payments, videos, bonuses, payouts] = await Promise.all([
    prisma.quote.findMany({
      where: { userId: { in: userIds }, status: "ACCEPTED", decidedAt: { gte: start, lt: end } },
      include: { items: true },
    }),
    prisma.payment.findMany({
      where: { userId: { in: userIds }, paidAt: { gte: start, lt: end } },
      include: { quote: { select: { number: true } }, customer: { select: { name: true, company: true } } },
      orderBy: { paidAt: "asc" },
    }),
    prisma.ugcVideo.findMany({
      where: { creatorId: { in: userIds }, status: "PUBLISHED", publishedAt: { gte: start, lt: end }, basePay: { not: 0 } },
      select: { id: true, creatorId: true, title: true, publishedAt: true, basePay: true },
    }),
    prisma.ugcVideo.findMany({
      where: { creatorId: { in: userIds }, viewsAt: { gte: start, lt: end }, bonus: { not: 0 } },
      select: { id: true, creatorId: true, title: true, viewsAt: true, bonus: true, views: true },
    }),
    prisma.commissionPayout.findMany({
      where: { userId: { in: userIds }, period },
      orderBy: { paidAt: "asc" },
    }),
  ]);

  return userIds.map((userId) => {
    const won = quotes.filter((q) => q.userId === userId);
    const wonValue = won.reduce((s, q) => s + computeQuoteBreakdown(q.items, q.discount, q.vatRate).annualNet, 0);
    const pays = payments
      .filter((p) => p.userId === userId)
      .map((p) => ({
        id: p.id,
        quoteId: p.quoteId,
        number: p.quote.number,
        customer: p.customer.company || p.customer.name,
        paidAt: p.paidAt,
        amount: p.amount,
        rate: p.rate,
        commission: p.commission,
      }));
    const ugc = [
      ...videos
        .filter((v) => v.creatorId === userId)
        .map((v) => ({ id: `v-${v.id}`, title: v.title, kind: "VIDEO" as const, date: v.publishedAt!, amount: v.basePay, views: null })),
      ...bonuses
        .filter((v) => v.creatorId === userId)
        .map((v) => ({ id: `b-${v.id}`, title: v.title, kind: "BONUS" as const, date: v.viewsAt!, amount: v.bonus, views: v.views })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());
    const outs = payouts
      .filter((p) => p.userId === userId)
      .map((p) => ({ id: p.id, amount: p.amount, paidAt: p.paidAt, note: p.note }));

    const paidValue = pays.reduce((s, p) => s + p.amount, 0);
    const paymentCommission = pays.reduce((s, p) => s + p.commission, 0);
    const ugcPay = ugc.reduce((s, u) => s + u.amount, 0);
    const bonusRate = bonusRateFor(tiers, paidValue);
    const bonus = paidValue * (bonusRate / 100);
    const earned = paymentCommission + ugcPay + bonus;
    const paid = outs.reduce((s, p) => s + p.amount, 0);
    return {
      userId,
      period,
      wonValue,
      wonCount: won.length,
      paidValue,
      paymentCommission,
      ugcPay,
      bonusRate,
      bonus,
      earned,
      paid,
      balance: earned - paid,
      payments: pays,
      ugc,
      payouts: outs,
    };
  });
}

export async function computeStatement(userId: string, period: string): Promise<Statement> {
  return (await computeStatements([userId], period))[0];
}
