import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import Badge from "@/components/Badge";
import { PackageIcon, FolderIcon, UsersIcon, ChevronRightIcon } from "@/components/icons";
import { formatPrice } from "@/lib/format";
import NewProductButton from "./NewProductButton";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const user = await requireStaff();
  const isAdmin = user.role === "ADMIN";

  const products = await prisma.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      plans: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] },
      _count: { select: { materials: true, access: true } },
    },
  });

  // Group editions under their product family ("Unbusyness" → 3 editions).
  const families = new Map<string, typeof products>();
  for (const p of products) {
    const key = p.family || p.name;
    if (!families.has(key)) families.set(key, []);
    families.get(key)!.push(p);
  }
  const families_ = Array.from(families.entries());
  const knownFamilies = Array.from(new Set(products.map((p) => p.family).filter(Boolean))) as string[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-black/50 text-sm mt-1">
            {isAdmin
              ? "Everything your sellers can sell. Group editions of the same product with a shared family name."
              : "The catalog. Decide which of these each seller sees under Product access."}
          </p>
        </div>
        {isAdmin && <NewProductButton families={knownFamilies} />}
      </div>

      {products.length === 0 && (
        <div className="card p-10 text-center text-black/40 text-sm">
          No products yet. Add your first one to get started.
        </div>
      )}

      <div className="space-y-8">
        {families_.map(([family, items]) => (
          <section key={family}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="section-title">{family}</h2>
              <span className="text-xs text-black/30">
                {items.length} edition{items.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((p) => {
                const cheapest = p.plans[0];
                const body = (
                  <div className="card overflow-hidden flex flex-col h-full hover:shadow-md transition-shadow">
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
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold leading-snug">{p.name}</div>
                          {p.targetSegment && (
                            <div className="text-xs text-black/45 mt-0.5 line-clamp-1">{p.targetSegment}</div>
                          )}
                        </div>
                        {!p.active && <Badge variant="MUTED">Hidden</Badge>}
                      </div>
                      {p.tagline && <p className="text-sm text-black/55 mt-3 line-clamp-2">{p.tagline}</p>}
                      <div className="mt-auto pt-4 flex items-end justify-between gap-2">
                        <div className="text-sm">
                          {cheapest ? (
                            <>
                              <span className="text-black/40 text-xs block">from</span>
                              <span className="font-semibold">
                                {formatPrice(cheapest.price, cheapest.billing, cheapest.unitLabel)}
                              </span>
                            </>
                          ) : (
                            <span className="text-black/35 text-xs">No active plans</span>
                          )}
                        </div>
                        {p.commissionRate > 0 && (
                          <Badge variant="INFO">{p.commissionRate}% commission</Badge>
                        )}
                      </div>
                      <div className="mt-4 pt-3 border-t border-black/5 flex items-center gap-4 text-xs text-black/45">
                        <span className="flex items-center gap-1.5">
                          <FolderIcon className="h-3.5 w-3.5" /> {p._count.materials} materials
                        </span>
                        <span className="flex items-center gap-1.5">
                          <UsersIcon className="h-3.5 w-3.5" /> {p._count.access} sellers
                        </span>
                        {isAdmin && <ChevronRightIcon className="h-3.5 w-3.5 ml-auto" />}
                      </div>
                    </div>
                  </div>
                );
                return isAdmin ? (
                  <Link key={p.id} href={`/admin/products/${p.id}`} className="block">
                    {body}
                  </Link>
                ) : (
                  <div key={p.id}>{body}</div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
