import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getManagedSellerIds } from "@/lib/access";
import { ensureDefaultRules, AJPES_ATTRIBUTION } from "@/lib/prospects";
import LeadFinderManager from "./LeadFinderManager";

export const dynamic = "force-dynamic";

export default async function LeadFinderPage({ searchParams }: { searchParams: { q?: string; status?: string; product?: string } }) {
  const user = await requireStaff();
  await ensureDefaultRules();
  const sellerIds = await getManagedSellerIds(user);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const q = (searchParams.q || "").trim();
  const status = searchParams.status || "ALL";
  const product = searchParams.product || "ALL";

  const [settings, products, rules, byStatus, byProduct, sellers, openRecs, claimed, lookupsToday, list] = await Promise.all([
    getSettings(),
    prisma.product.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } }),
    prisma.prospectRule.findMany({ include: { product: { select: { name: true } } }, orderBy: [{ priority: "desc" }, { createdAt: "asc" }] }),
    prisma.prospect.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.prospect.groupBy({ by: ["productId"], where: { status: "NEW" }, _count: { _all: true } }),
    prisma.user.findMany({ where: { id: { in: sellerIds }, active: true }, select: { id: true, name: true, prospectQuota: true }, orderBy: { name: "asc" } }),
    prisma.prospect.groupBy({ by: ["recommendedToId"], where: { status: "RECOMMENDED", recommendedToId: { in: sellerIds } }, _count: { _all: true } }),
    prisma.prospect.groupBy({ by: ["claimedById"], where: { status: "CLAIMED", claimedById: { in: sellerIds } }, _count: { _all: true } }),
    prisma.prospect.count({ where: { lookedUpAt: { gte: startOfToday } } }),
    prisma.prospect.findMany({
      where: {
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
        ...(status !== "ALL" ? { status } : {}),
        ...(product !== "ALL" ? { productId: product } : {}),
      },
      include: { product: { select: { name: true } }, recommendedTo: { select: { name: true } }, claimedBy: { select: { name: true } } },
      orderBy: [{ updatedAt: "desc" }],
      take: 60,
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  byStatus.forEach((s) => (statusCounts[s.status] = s._count._all));
  const productName = new Map(products.map((p) => [p.id, p.name]));

  return (
    <LeadFinderManager
      isAdmin={user.role === "ADMIN"}
      attribution={AJPES_ATTRIBUTION}
      googleReady={!!process.env.GOOGLE_PLACES_API_KEY}
      aiReady={!!process.env.ANTHROPIC_API_KEY}
      settings={{
        daily: settings.prospectDailyPerSeller,
        expiry: settings.prospectExpiryDays,
        lookupCap: settings.prospectLookupDailyCap,
        autoImport: settings.prospectAutoImport,
        lastImportAt: settings.prospectLastImportAt?.toISOString() ?? null,
        lastImportNote: settings.prospectLastImportNote,
      }}
      lookupsToday={lookupsToday}
      statusCounts={statusCounts}
      availableByProduct={byProduct
        .map((b) => ({ name: (b.productId && productName.get(b.productId)) || "No product", count: b._count._all }))
        .sort((a, b) => b.count - a.count)}
      products={products}
      rules={rules.map((r) => ({
        id: r.id,
        productId: r.productId,
        productName: r.product.name,
        keywords: r.keywords,
        exclude: r.exclude,
        priority: r.priority,
        active: r.active,
      }))}
      sellers={sellers.map((s) => ({
        id: s.id,
        name: s.name,
        quota: s.prospectQuota,
        open: openRecs.find((o) => o.recommendedToId === s.id)?._count._all || 0,
        claimed: claimed.find((o) => o.claimedById === s.id)?._count._all || 0,
      }))}
      filters={{ q, status, product }}
      prospects={list.map((p) => ({
        id: p.id,
        name: p.name,
        town: p.postTown,
        legalForm: p.legalForm,
        product: p.product?.name || null,
        keyword: p.matchedKeyword,
        status: p.status,
        who: p.claimedBy?.name || p.recommendedTo?.name || null,
        phone: p.phone,
        email: p.email,
        reason: p.rejectReason,
      }))}
    />
  );
}
