import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSellerProducts } from "@/lib/seller";
import { getSellableProductIds } from "@/lib/access";
import Badge from "@/components/Badge";
import { PackageIcon, ChevronRightIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MyProductsPage() {
  const user = await requireSales();
  const [products, sellable] = await Promise.all([getSellerProducts(user), getSellableProductIds(user)]);

  const [materialCounts, leadCounts] = await Promise.all([
    prisma.salesMaterial.groupBy({
      by: ["productId"],
      where: { productId: { in: products.map((p) => p.id) } },
      _count: { _all: true },
    }),
    prisma.customerProduct.groupBy({
      by: ["productId"],
      where: { productId: { in: products.map((p) => p.id) }, customer: { ownerId: user.id } },
      _count: { _all: true },
    }),
  ]);
  const mCount = new Map(materialCounts.map((m) => [m.productId, m._count._all]));
  const lCount = new Map(leadCounts.map((l) => [l.productId, l._count._all]));

  const families = new Map<string, typeof products>();
  for (const p of products) {
    const k = p.family || p.name;
    if (!families.has(k)) families.set(k, []);
    families.get(k)!.push(p);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">My products</h1>
        <p className="text-black/50 text-sm mt-1">
          What you can sell — open a product for its pitch, pricing, demo and materials.
        </p>
      </div>

      {products.length === 0 ? (
        <div className="card p-10 text-center text-black/40 text-sm">
          You haven&apos;t been given any products yet. Ask your sales manager to assign some.
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(families.entries()).map(([family, list]) => (
            <section key={family}>
              <h2 className="section-title mb-3">{family}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((p) => (
                  <Link
                    key={p.id}
                    href={`/crm/products/${p.id}`}
                    className="card overflow-hidden flex flex-col hover:shadow-md transition-shadow"
                  >
                    <div className="h-1.5" style={{ background: p.color || "#4f46e5" }} />
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 rounded-xl bg-sand-100 flex items-center justify-center overflow-hidden shrink-0">
                          {p.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <PackageIcon className="h-5 w-5 text-black/25" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold leading-snug">{p.name}</div>
                          {p.targetSegment && (
                            <div className="text-xs text-black/45 mt-0.5 line-clamp-1">{p.targetSegment}</div>
                          )}
                        </div>
                      </div>
                      {p.tagline && <p className="text-sm text-black/55 mt-3 line-clamp-2">{p.tagline}</p>}
                      <div className="mt-auto pt-4 flex flex-wrap items-center gap-2 text-xs">
                        {p.plans[0] && (
                          <span className="font-semibold text-sm mr-auto">
                            from {formatPrice(p.plans[0].price, p.plans[0].billing, p.plans[0].unitLabel)}
                          </span>
                        )}
                        {p.commissionRate > 0 && <Badge variant="WON">{p.commissionRate}% commission</Badge>}
                        {!sellable.includes(p.id) && <Badge variant="WARN">🔒 Quiz needed</Badge>}
                      </div>
                      <div className="mt-3 pt-3 border-t border-black/5 flex items-center gap-3 text-xs text-black/45">
                        <span>{mCount.get(p.id) || 0} materials</span>·<span>{lCount.get(p.id) || 0} of your leads</span>
                        <ChevronRightIcon className="h-3.5 w-3.5 ml-auto" />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
