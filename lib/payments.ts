import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { computeQuoteBreakdown, formatMoney } from "@/lib/format";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";

/**
 * Commission is earned on money the customer actually paid:
 *   payment (net, excl. VAT) × the quote's commission rate,
 * only for payments within the first Settings.commissionMonths (12) after
 * the quote was accepted. Own leads (found by the seller) get at least
 * Settings.ownLeadCommissionRate (20 %). No commission after that window.
 */

/** Effective commission % of a quote (weighted by its line rates). */
export function quoteRate(
  quote: { items: { quantity: number; unitPrice: number; billing: string; commissionRate: number }[]; discount: number; vatRate: number },
  leadType: string | null | undefined,
  ownRate: number
): number {
  const b = computeQuoteBreakdown(quote.items, quote.discount, quote.vatRate);
  const base = b.annualNet > 0 ? (b.commission / b.annualNet) * 100 : 0;
  const rate = leadType === "OWN" ? Math.max(base, ownRate) : base;
  return Math.round(rate * 100) / 100;
}

export function commissionWindowEnd(acceptedAt: Date, months: number): Date {
  const d = new Date(acceptedAt);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function recordPayment(input: {
  quoteId: string;
  amount: number;
  paidAt: Date;
  note?: string | null;
  createdById: string;
  source?: "MANUAL" | "IMPORT";
}): Promise<{ error?: string; commission?: number }> {
  const quote = await prisma.quote.findUnique({
    where: { id: input.quoteId },
    include: { items: true, customer: { select: { id: true, name: true, company: true, leadType: true } } },
  });
  if (!quote || quote.status !== "ACCEPTED" || !quote.decidedAt) return { error: "Only accepted quotes can get payments." };
  if (!Number.isFinite(input.amount) || input.amount === 0) return { error: "Enter the amount paid (net, excl. VAT)." };
  if (Number.isNaN(input.paidAt.getTime())) return { error: "Enter the payment date." };

  const settings = await getSettings();
  const end = commissionWindowEnd(quote.decidedAt, settings.commissionMonths);
  const rate = input.paidAt < end ? quoteRate(quote, quote.customer.leadType, settings.ownLeadCommissionRate) : 0;
  const commission = Math.round(input.amount * rate) / 100;

  await prisma.payment.create({
    data: {
      quoteId: quote.id,
      customerId: quote.customerId,
      userId: quote.userId,
      amount: input.amount,
      paidAt: input.paidAt,
      rate,
      commission,
      note: input.note || null,
      source: input.source || "MANUAL",
      createdById: input.createdById,
    },
  });
  await logActivity(quote.customerId, input.createdById, "PAYMENT", `Payment received: ${formatMoney(input.amount)} (${quote.number})`);
  if (commission !== 0) {
    await notify([quote.userId], {
      type: "PAYMENT",
      title: `💶 ${quote.customer.company || quote.customer.name} paid ${formatMoney(input.amount)}`,
      body: `Your commission: ${formatMoney(commission)} (${rate}%).`,
      link: "/crm/commission",
    }, { email: false });
  }
  return { commission };
}
