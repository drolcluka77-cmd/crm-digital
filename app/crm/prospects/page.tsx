import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { recommendFor, recommendationProductIds, leadGroupsFor, parseSegmentPrefs, AJPES_ATTRIBUTION } from "@/lib/prospects";
import { getSellableProductIds } from "@/lib/access";
import ProspectList from "./ProspectList";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const user = await requireSales();
  await recommendFor(user);
  const [settings, me, prospects] = await Promise.all([
    getSettings(),
    prisma.user.findUnique({ where: { id: user.id }, select: { prospectQuota: true, prospectSegments: true } }),
    prisma.prospect.findMany({
      where: { recommendedToId: user.id, status: "RECOMMENDED" },
      include: { product: { select: { id: true, name: true, color: true } } },
      orderBy: [{ recommendedAt: "asc" }, { score: "desc" }],
    }),
  ]);
  const quota = me?.prospectQuota ?? settings.prospectDailyPerSeller;
  const prefs = parseSegmentPrefs(me?.prospectSegments);
  const [sellableIds, enabledIds] = await Promise.all([getSellableProductIds(user), recommendationProductIds(user)]);
  const groups = await leadGroupsFor(sellableIds);
  const allIds = groups.flatMap((g) => g.productIds);
  const available = await prisma.prospect.groupBy({
    by: ["productId", "segment"],
    where: { status: "NEW", productId: { in: allIds } },
    _count: { _all: true },
  });

  const groupOf = (productId: string | null) => groups.find((g) => productId && g.productIds.includes(productId));
  const groupProps = groups.map((g) => {
    const rows = available.filter((a) => a.productId && g.productIds.includes(a.productId));
    const segs = new Map<string, number>();
    rows.forEach((r) => r.segment && segs.set(r.segment, (segs.get(r.segment) || 0) + r._count._all));
    return {
      key: g.key,
      name: g.name,
      color: g.color,
      // The seller's own products in this group (what "Choose products" switches).
      productIds: g.productIds.filter((id) => sellableIds.includes(id)),
      enabled: g.productIds.some((id) => enabledIds.includes(id)),
      open: prospects.filter((x) => groupOf(x.productId)?.key === g.key).length,
      available: rows.reduce((n, r) => n + r._count._all, 0),
      segments: Array.from(segs.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name, "sl")),
      chosen: prefs[g.key] || [],
    };
  });
  const lookupReady = !!(process.env.GOOGLE_PLACES_API_KEY || process.env.ANTHROPIC_API_KEY);

  return (
    <ProspectList
      quota={quota}
      groups={groupProps}
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
        regNumber: p.companyReg || p.regNumber.split(":")[0],
        groupKey: groupOf(p.productId)?.key || null,
        groupName: groupOf(p.productId)?.name || p.product?.name || null,
        color: p.product?.color || null,
        segment: p.segment,
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
