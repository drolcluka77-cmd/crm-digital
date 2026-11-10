import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { logActivity } from "@/lib/activity";
import { notify, supervisorsOf } from "@/lib/notify";
import { BILLING_ANNUAL_FACTOR } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

/**
 * Marks a quote accepted — by the seller in the CRM, or by the client on
 * the online acceptance page — and does everything that follows a win:
 * lead → Won, timeline entry, subscription for recurring lines, notifications.
 */
export async function acceptQuote(
  quoteId: string,
  by: { userId: string | null; name?: string; title?: string; ip?: string }
) {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true, customer: true, subscription: true },
  });
  if (!quote) throw new Error("Quote not found");

  const now = new Date();
  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      status: "ACCEPTED",
      decidedAt: now,
      ...(by.name ? { acceptedByName: by.name, acceptedByTitle: by.title || null, acceptedIp: by.ip || null } : {}),
    },
  });
  await prisma.customer.update({
    where: { id: quote.customerId },
    data: { status: "WON", nextFollowUpAt: null },
  });
  await logActivity(
    quote.customerId,
    by.userId,
    "QUOTE_ACCEPTED",
    by.name
      ? `${quote.number} accepted online by ${by.name}${by.title ? `, ${by.title}` : ""}`
      : `${quote.number} accepted`
  );

  // Recurring lines → subscription (once per quote).
  if (!quote.subscription) {
    const factor = 1 - quote.discount / 100;
    let monthly = 0;
    let annual = 0;
    let renewalCommission = 0;
    for (const i of quote.items) {
      if (i.billing === "ONE_TIME") continue;
      const yearValue = i.quantity * i.unitPrice * factor * (BILLING_ANNUAL_FACTOR[i.billing] ?? 1);
      annual += yearValue;
      monthly += yearValue / 12;
      renewalCommission += yearValue * ((i.renewalCommissionRate || 0) / 100);
    }
    if (annual > 0) {
      const settings = await getSettings();
      const term = settings.renewalTermMonths || 12;
      const renewalDate = new Date(now);
      renewalDate.setMonth(renewalDate.getMonth() + term);
      await prisma.subscription.create({
        data: {
          quoteId,
          customerId: quote.customerId,
          userId: quote.userId,
          startDate: now,
          renewalDate,
          termMonths: term,
          monthlyValue: monthly,
          annualValue: annual,
          renewalCommission,
        },
      });
      await logActivity(
        quote.customerId,
        by.userId,
        "SUBSCRIPTION",
        `Subscription started: ${formatMoney(monthly)} / month`
      );
    }
  }

  if (!by.userId) {
    const who = quote.customer.company || quote.customer.name;
    await notify([quote.userId], {
      type: "QUOTE_ACCEPTED",
      title: `🎉 ${who} accepted ${quote.number}`,
      body: by.name ? `Accepted online by ${by.name}.` : null,
      link: `/crm/quotes/${quote.id}`,
    });
    await notify(await supervisorsOf(quote.userId), {
      type: "QUOTE_ACCEPTED",
      title: `${who} accepted ${quote.number}`,
      link: `/admin`,
    }, { email: false });
  }
}

/** Seller or client rejected the quote. */
export async function rejectQuote(quoteId: string, by: { userId: string | null; reason?: string }) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { customer: true } });
  if (!quote) throw new Error("Quote not found");

  await prisma.quote.update({
    where: { id: quoteId },
    data: { status: "REJECTED", decidedAt: new Date(), declineReason: by.reason || null },
  });
  const alive = await prisma.quote.count({
    where: { customerId: quote.customerId, id: { not: quoteId }, status: { in: ["DRAFT", "SENT", "ACCEPTED"] } },
  });
  if (!alive && quote.customer.status !== "WON") {
    await prisma.customer.update({ where: { id: quote.customerId }, data: { status: "LOST" } });
  }
  await logActivity(
    quote.customerId,
    by.userId,
    "QUOTE_REJECTED",
    `${quote.number} ${by.userId ? "rejected" : "declined online"}${by.reason ? `: ${by.reason}` : ""}`
  );
  if (!by.userId) {
    await notify([quote.userId], {
      type: "QUOTE_DECLINED",
      title: `${quote.customer.company || quote.customer.name} declined ${quote.number}`,
      body: by.reason || null,
      link: `/crm/customers/${quote.customerId}`,
    });
  }
}
