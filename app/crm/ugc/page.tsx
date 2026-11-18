import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getAccessibleProductIds } from "@/lib/access";
import { getBaseUrl } from "@/lib/url";
import { DEFAULT_UGC_TERMS, parseBonusTiers, webPageForProduct, WEB_PAGES } from "@/lib/ugc";
import UgcSeller from "./UgcSeller";

export const dynamic = "force-dynamic";

export default async function UgcPage() {
  const user = await requireSales();
  const [me, settings, productIds] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { ugcCreator: true, ugcCode: true, ugcTermsAt: true } }),
    getSettings(),
    getAccessibleProductIds(user),
  ]);
  const terms = settings.ugcTerms || DEFAULT_UGC_TERMS;
  const tiers = parseBonusTiers(settings.ugcBonusTiers);

  if (!me?.ugcCreator || !me.ugcCode) {
    return <UgcSeller joined={false} terms={terms} pay={settings.ugcVideoPay} tiers={tiers} />;
  }

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [products, tasks, videos, clicks, clicksMonth, leads, won, monthVideos] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds }, active: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.ugcTask.findMany({
      where: { status: "PUBLISHED", OR: [{ productId: null }, { productId: { in: productIds } }] },
      include: { product: { select: { name: true } }, _count: { select: { videos: true } } },
      orderBy: [{ weekOf: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
    prisma.ugcVideo.findMany({
      where: { creatorId: user.id },
      include: { product: { select: { name: true } }, task: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.ugcClick.count({ where: { creatorId: user.id } }),
    prisma.ugcClick.count({ where: { creatorId: user.id, createdAt: { gte: startOfMonth } } }),
    prisma.customer.count({ where: { ugcCreatorId: user.id } }),
    prisma.customer.count({ where: { ugcCreatorId: user.id, status: "WON" } }),
    prisma.ugcVideo.findMany({
      where: {
        creatorId: user.id,
        OR: [{ publishedAt: { gte: startOfMonth } }, { viewsAt: { gte: startOfMonth } }],
      },
      select: { publishedAt: true, viewsAt: true, basePay: true, bonus: true },
    }),
  ]);
  const earnedMonth = monthVideos.reduce(
    (s, v) => s + (v.publishedAt && v.publishedAt >= startOfMonth ? v.basePay : 0) + (v.viewsAt && v.viewsAt >= startOfMonth ? v.bonus : 0),
    0
  );

  const base = `${getBaseUrl()}/r/${me.ugcCode.toLowerCase()}`;
  const pages = Array.from(new Set(products.map((p) => webPageForProduct(p))));
  const links = pages.map((slug) => ({
    slug,
    label: WEB_PAGES.find((w) => w.slug === slug)?.label || slug,
    products: products.filter((p) => webPageForProduct(p) === slug).map((p) => p.name),
    url: `${base}/${slug}`,
  }));

  return (
    <UgcSeller
      joined
      terms={terms}
      pay={settings.ugcVideoPay}
      tiers={tiers}
      code={me.ugcCode}
      baseLink={base}
      links={links}
      products={products}
      stats={{ clicks, clicksMonth, leads, won, earnedMonth }}
      tasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        brief: t.brief,
        theme: t.theme,
        product: t.product?.name || null,
        productId: t.productId,
        weekOf: t.weekOf?.toISOString() ?? null,
        videos: t._count.videos,
        link: t.productId ? `${base}/${webPageForProduct(products.find((p) => p.id === t.productId))}` : base,
      }))}
      videos={videos.map((v) => ({
        id: v.id,
        title: v.title,
        status: v.status,
        product: v.product?.name || null,
        task: v.task?.title || null,
        note: v.note,
        reviewNote: v.reviewNote,
        hasFile: !!v.fileKey,
        linkUrl: v.linkUrl,
        postUrl: v.postUrl,
        views: v.views,
        basePay: v.basePay,
        bonus: v.bonus,
        createdAt: v.createdAt.toISOString(),
        publishedAt: v.publishedAt?.toISOString() ?? null,
      }))}
    />
  );
}
