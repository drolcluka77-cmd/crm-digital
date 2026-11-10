import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getBuilderProducts } from "@/lib/builder";
import QuoteBuilder from "../QuoteBuilder";

export const dynamic = "force-dynamic";

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: { customerId?: string; productId?: string };
}) {
  const user = await requireSales();

  const [customers, products, settings, me] = await Promise.all([
    prisma.customer.findMany({
      where: { ownerId: user.id },
      orderBy: [{ company: "asc" }, { name: "asc" }],
      select: { id: true, name: true, company: true },
    }),
    getBuilderProducts(user),
    getSettings(),
    prisma.user.findUnique({ where: { id: user.id }, select: { commissionRate: true } }),
  ]);

  const validUntil = new Date(Date.now() + settings.quoteValidityDays * 86_400_000).toISOString();

  return (
    <div>
      <Link href="/crm/quotes" className="text-sm text-black/40 hover:text-black/60">
        ← All quotes
      </Link>
      <div className="mt-3 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New quote</h1>
        <p className="text-black/50 text-sm mt-1">
          Pick plans, adjust pricing and billing, then save it as a draft.
        </p>
      </div>

      {customers.length === 0 ? (
        <div className="card p-10 text-center text-black/40 text-sm">
          You need a customer first.{" "}
          <Link href="/crm/customers" className="text-brand-600 hover:underline">
            Add one →
          </Link>
        </div>
      ) : (
        <QuoteBuilder
          mode="create"
          customers={customers}
          products={products}
          defaultVatRate={settings.vatRate}
          defaultValidUntil={validUntil}
          initialCustomerId={
            customers.some((c) => c.id === searchParams.customerId) ? searchParams.customerId : undefined
          }
          initialProductId={searchParams.productId}
          commissionOverride={me?.commissionRate ?? null}
        />
      )}
    </div>
  );
}
