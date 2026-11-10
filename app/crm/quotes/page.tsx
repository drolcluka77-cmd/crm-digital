import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { computeQuoteBreakdown } from "@/lib/format";
import QuotesList from "./QuotesList";

export const dynamic = "force-dynamic";

export default async function QuotesPage() {
  const user = await requireSales();

  const quotes = await prisma.quote.findMany({
    where: { userId: user.id },
    include: { items: true, customer: true },
    orderBy: { createdAt: "desc" },
  });

  const data = quotes.map((q) => {
    const b = computeQuoteBreakdown(q.items, q.discount, q.vatRate);
    return {
      id: q.id,
      number: q.number,
      customerName: q.customer.company || q.customer.name,
      status: q.status,
      annualNet: b.annualNet,
      commission: b.commission,
      itemCount: q.items.length,
      createdAt: q.createdAt.toISOString(),
      validUntil: q.validUntil?.toISOString() ?? null,
    };
  });

  return <QuotesList quotes={data} />;
}
