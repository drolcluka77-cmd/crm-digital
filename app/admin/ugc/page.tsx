import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getManagedSellerIds } from "@/lib/access";
import { DEFAULT_UGC_TERMS } from "@/lib/ugc";
import UgcAdmin from "./UgcAdmin";

export const dynamic = "force-dynamic";

export default async function UgcAdminPage({ searchParams }: { searchParams: { tab?: string } }) {
  const user = await requireStaff();
  const sellerIds = await getManagedSellerIds(user);
  const since30 = new Date(Date.now() - 30 * 86_400_000);
  const [settings, videos, tasks, products, creators] = await Promise.all([
    getSettings(),
    prisma.ugcVideo.findMany({
      where: { creatorId: { in: sellerIds } },
      include: {
        creator: { select: { name: true, ugcCode: true } },
        product: { select: { name: true } },
        task: { select: { title: true } },
        reviewedBy: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    prisma.ugcTask.findMany({
      include: { product: { select: { name: true } }, _count: { select: { videos: true } } },
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
    prisma.product.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { id: { in: sellerIds }, ugcCreator: true },
      select: { id: true, name: true, ugcCode: true, ugcTermsAt: true, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const creatorIds = creators.map((c) => c.id);
  const [clicks, clicks30, leads, won, pay] = await Promise.all([
    prisma.ugcClick.groupBy({ by: ["creatorId"], where: { creatorId: { in: creatorIds } }, _count: { _all: true } }),
    prisma.ugcClick.groupBy({ by: ["creatorId"], where: { creatorId: { in: creatorIds }, createdAt: { gte: since30 } }, _count: { _all: true } }),
    prisma.customer.groupBy({ by: ["ugcCreatorId"], where: { ugcCreatorId: { in: creatorIds } }, _count: { _all: true } }),
    prisma.customer.groupBy({ by: ["ugcCreatorId"], where: { ugcCreatorId: { in: creatorIds }, status: "WON" }, _count: { _all: true } }),
    prisma.ugcVideo.groupBy({
      by: ["creatorId"],
      where: { creatorId: { in: creatorIds }, status: "PUBLISHED" },
      _count: { _all: true },
      _sum: { basePay: true, bonus: true, views: true },
    }),
  ]);
  const m = <T extends { _count: { _all: number } }>(rows: T[], key: keyof T) =>
    new Map(rows.map((r) => [r[key] as unknown as string, r._count._all]));
  const clicksM = m(clicks, "creatorId");
  const clicks30M = m(clicks30, "creatorId");
  const leadsM = m(leads, "ugcCreatorId");
  const wonM = m(won, "ugcCreatorId");
  const payM = new Map(pay.map((p) => [p.creatorId, p]));

  return (
    <UgcAdmin
      tab={searchParams.tab || "review"}
      isAdmin={user.role === "ADMIN"}
      aiReady={!!process.env.ANTHROPIC_API_KEY}
      products={products}
      settings={{
        pay: settings.ugcVideoPay,
        tiers: settings.ugcBonusTiers || "",
        terms: settings.ugcTerms || DEFAULT_UGC_TERMS,
        warmHours: settings.warmClaimHours,
        website: settings.websiteUrl,
      }}
      videos={videos.map((v) => ({
        id: v.id,
        title: v.title,
        status: v.status,
        creator: v.creator.name,
        code: v.creator.ugcCode,
        product: v.product?.name || null,
        task: v.task?.title || null,
        note: v.note,
        reviewNote: v.reviewNote,
        reviewedBy: v.reviewedBy?.name || null,
        hasFile: !!v.fileKey,
        linkUrl: v.linkUrl,
        postUrl: v.postUrl,
        views: v.views,
        viewsAt: v.viewsAt?.toISOString() ?? null,
        basePay: v.basePay,
        bonus: v.bonus,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
        publishedAt: v.publishedAt?.toISOString() ?? null,
      }))}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        brief: t.brief,
        theme: t.theme,
        productId: t.productId,
        product: t.product?.name || null,
        status: t.status,
        ai: t.ai,
        weekOf: t.weekOf?.toISOString() ?? null,
        videos: t._count.videos,
      }))}
      creators={creators.map((c) => {
        const p = payM.get(c.id);
        return {
          id: c.id,
          name: c.name,
          code: c.ugcCode,
          active: c.active,
          since: c.ugcTermsAt?.toISOString() ?? null,
          clicks: clicksM.get(c.id) || 0,
          clicks30: clicks30M.get(c.id) || 0,
          leads: leadsM.get(c.id) || 0,
          won: wonM.get(c.id) || 0,
          published: p?._count._all || 0,
          views: p?._sum.views || 0,
          earned: (p?._sum.basePay || 0) + (p?._sum.bonus || 0),
        };
      })}
    />
  );
}
