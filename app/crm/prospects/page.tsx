import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { recommendFor, recommendationProductIds, AJPES_ATTRIBUTION } from "@/lib/prospects";
import { getSellableProductIds } from "@/lib/access";
import ProspectList from "./ProspectList";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const user = await requireSales();
  await recommendFor(user);
  const [settings, me, prospects] = await Promise.all([
    getSettings(),
    prisma.user.findUnique({ where: { id: user.id }, select: { prospectQuota: true } }),
    prisma.prospect.findMany({
      where: { recommendedToId: user.id, status: "RECOMMENDED" },
      include: { product: { select: { id: true, name: true, color: true } } },
      orderBy: [{ recommendedAt: "asc" }, { score: "desc" }],
    }),
  ]);
  const quota = me?.prospectQuota ?? settings.prospectDailyPerSeller;
  const [sellableIds, enabledIds] = await Promise.all([getSellableProductIds(user), recommendationProductIds(user)]);
  const [sellable, available] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: sellableIds } }, select: { id: true, name: true, color: true }, orderBy: { sortOrder: "asc" } }),
    prisma.prospect.groupBy({ by: ["productId"], where: { status: "NEW", productId: { in: sellableIds } }, _count: { _all: true } }),
  ]);
  const products = sellable.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    enabled: enabledIds.includes(p.id),
    open: prospects.filter((x) => x.productId === p.id).length,
    available: available.find((a) => a.productId === p.id)?._count._all || 0,
  }));
  const lookupReady = !!(process.env.GOOGLE_PLACES_API_KEY || process.env.ANTHROPIC_API_KEY);

  return (
    <ProspectList
      quota={quota}
      products={products}
      expiryDays={settings.prospectExpiryDays}
      lookupReady={lookupReady}
      attribution={AJPES_ATTRIBUTION}
      prospects={prospects.map((p) => ({
        id: p.id,
        name: p.name,
        legalForm: p.legalForm,
        soleTrader: p.soleTrader,
        address: [p.street, [p.postalCode, p.postTown].filter(Boolean).join(" ")].filter(Boolean).join(", "),
        town: p.postTown,
        regNumber: p.regNumber,
        productId: p.productId,
        product: p.product ? { name: p.product.name, color: p.product.color } : null,
        matchedKeyword: p.matchedKeyword,
        recommendedAt: p.recommendedAt?.toISOString() ?? null,
        phone: p.phone,
        email: p.email,
        website: p.website,
        activity: p.activity,
        lookedUp: !!p.lookedUpAt,
        lookup: p.lookup ? safeParse(p.lookup) : null,
      }))}
    />
  );
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
