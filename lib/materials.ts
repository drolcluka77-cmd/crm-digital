import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/** Loads materials (with product name + how often they were sent) for the admin UI. */
export async function loadAdminMaterials(where: Prisma.SalesMaterialWhereInput = {}) {
  const rows = await prisma.salesMaterial.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { uploadedAt: "desc" }],
    include: { product: { select: { name: true } }, _count: { select: { shares: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.description,
    type: m.type,
    productId: m.productId,
    productName: m.product?.name ?? null,
    fileName: m.fileName,
    fileSize: m.fileSize,
    linkUrl: m.linkUrl,
    internalOnly: m.internalOnly,
    sortOrder: m.sortOrder,
    uploadedAt: m.uploadedAt.toISOString(),
    shareCount: m._count.shares,
  }));
}
