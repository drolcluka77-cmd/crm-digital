import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { getManagedSellerIds } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { computeQuoteBreakdown } from "@/lib/format";
import { commissionWindowEnd, quoteRate } from "@/lib/payments";
import PaymentsManager from "./PaymentsManager";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await requireStaff();
  const sellerIds = await getManagedSellerIds(user);
  const settings = await getSettings();
  const quotes = await prisma.quote.findMany({
    where: { status: "ACCEPTED", userId: { in: sellerIds } },
    include: {
      items: true,
      customer: { select: { id: true, name: true, company: true, leadType: true } },
      user: { select: { name: true } },
      payments: { orderBy: { paidAt: "desc" } },
    },
    orderBy: { decidedAt: "desc" },
    take: 500,
  });
  const now = new Date();

  return (
    <PaymentsManager
      isAdmin={user.role === "ADMIN"}
      ownRate={settings.ownLeadCommissionRate}
      months={settings.commissionMonths}
      rows={quotes.map((q) => {
        const b = computeQuoteBreakdown(q.items, q.discount, q.vatRate);
        const end = commissionWindowEnd(q.decidedAt || q.updatedAt, settings.commissionMonths);
        const monthly = b.groups.find((g) => g.billing === "MONTHLY")?.taxable || 0;
        return {
          quoteId: q.id,
          number: q.number,
          customer: q.customer.company || q.customer.name,
          customerId: q.customer.id,
          leadType: q.customer.leadType,
          seller: q.user.name,
          acceptedAt: (q.decidedAt || q.updatedAt).toISOString(),
          windowEnd: end.toISOString(),
          inWindow: end > now,
          rate: quoteRate(q, q.customer.leadType, settings.ownLeadCommissionRate),
          annualNet: b.annualNet,
          monthlyNet: monthly,
          paidTotal: q.payments.reduce((s, p) => s + p.amount, 0),
          commissionTotal: q.payments.reduce((s, p) => s + p.commission, 0),
          payments: q.payments.map((p) => ({
            id: p.id,
            amount: p.amount,
            paidAt: p.paidAt.toISOString(),
            commission: p.commission,
            rate: p.rate,
            note: p.note,
          })),
        };
      })}
    />
  );
}
