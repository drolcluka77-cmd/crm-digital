import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";
import { getAccessibleProductIds } from "@/lib/access";

export type SellerMaterial = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  productId: string | null;
  productName: string | null;
  fileName: string | null;
  fileSize: number | null;
  linkUrl: string | null;
  internalOnly: boolean;
  uploadedAt: string;
};

/** Products (active, accessible) with their active plans — for the quote builder & pickers. */
export async function getSellerProducts(user: CurrentUser) {
  const ids = await getAccessibleProductIds(user);
  return prisma.product.findMany({
    where: { id: { in: ids }, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { plans: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { price: "asc" }] } },
  });
}

/** Materials the seller may open: general ones + those of accessible products. */
export async function getSellerMaterials(
  user: CurrentUser,
  opts: { productId?: string; sendableOnly?: boolean } = {}
): Promise<SellerMaterial[]> {
  const ids = await getAccessibleProductIds(user);
  const rows = await prisma.salesMaterial.findMany({
    where: {
      AND: [
        opts.productId
          ? { productId: opts.productId }
          : { OR: [{ productId: null }, { productId: { in: ids }, product: { active: true } }] },
        opts.sendableOnly ? { internalOnly: false } : {},
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { uploadedAt: "desc" }],
    include: { product: { select: { name: true } } },
  });
  return rows
    .filter((m) => !m.productId || ids.includes(m.productId))
    .map((m) => ({
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
      uploadedAt: m.uploadedAt.toISOString(),
    }));
}

export type SellerTemplate = {
  id: string;
  name: string;
  purpose: string;
  subject: string;
  body: string;
  productId: string | null;
  productName: string | null;
  demoUrl: string | null;
};

/** Email templates: general ones + those of products the seller can see. */
export async function getSellerTemplates(user: CurrentUser): Promise<SellerTemplate[]> {
  const ids = await getAccessibleProductIds(user);
  const rows = await prisma.emailTemplate.findMany({
    where: { OR: [{ productId: null }, { productId: { in: ids }, product: { active: true } }] },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { product: { select: { name: true, demoUrl: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    purpose: t.purpose,
    subject: t.subject,
    body: t.body,
    productId: t.productId,
    productName: t.product?.name ?? null,
    demoUrl: t.product?.demoUrl ?? null,
  }));
}
