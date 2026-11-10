import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getBuilderProducts } from "@/lib/builder";
import { computeQuoteBreakdown } from "@/lib/format";
import QuoteDetail from "./QuoteDetail";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({ params }: { params: { id: string } }) {
  const user = await requireSales();

  const [quote, products, settings, me] = await Promise.all([
    prisma.quote.findUnique({
      where: { id: params.id },
      include: { items: true, customer: true, approvedBy: { select: { name: true } } },
    }),
    getBuilderProducts(user),
    getSettings(),
    prisma.user.findUnique({ where: { id: user.id }, select: { commissionRate: true } }),
  ]);
  if (!quote || quote.userId !== user.id) notFound();

  const breakdown = computeQuoteBreakdown(quote.items, quote.discount, quote.vatRate);

  return (
    <div>
      <Link href="/crm/quotes" className="text-sm text-black/40 hover:text-black/60">
        ← All quotes
      </Link>
      <div className="mt-3">
        <QuoteDetail
          quote={{
            id: quote.id,
            number: quote.number,
            status: quote.status,
            customerId: quote.customerId,
            customerName: quote.customer.company || quote.customer.name,
            contactName: quote.customer.name,
            customerEmail: quote.customer.email,
            sentAt: quote.sentAt?.toISOString() ?? null,
            items: quote.items.map((i) => ({
              key: i.id,
              productId: i.productId,
              planId: i.planId,
              name: i.name,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              billing: i.billing,
              unitLabel: i.unitLabel,
              listPrice: i.listPrice,
            })),
            discount: quote.discount,
            vatRate: quote.vatRate,
            notes: quote.notes,
            validUntil: quote.validUntil?.toISOString() ?? null,
            approvalStatus: quote.approvalStatus,
            approvalReason: quote.approvalReason,
            approvalNote: quote.approvalNote,
            approvedBy: quote.approvedBy?.name ?? null,
            viewedAt: quote.viewedAt?.toISOString() ?? null,
            acceptedByName: quote.acceptedByName,
            acceptedByTitle: quote.acceptedByTitle,
            declineReason: quote.declineReason,
          }}
          commissionOverride={me?.commissionRate ?? null}
          products={products}
          companyName={settings.companyName}
          annualNet={breakdown.annualNet}
          totalsSummary={breakdown.groups.map((g) => ({ billing: g.billing, total: g.total }))}
        />
      </div>
    </div>
  );
}
