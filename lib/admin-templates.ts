import { prisma } from "@/lib/prisma";

/** Email templates shaped for the admin UI. */
export async function loadAdminTemplates(productId?: string) {
  const rows = await prisma.emailTemplate.findMany({
    where: productId ? { productId } : {},
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { product: { select: { name: true } } },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    purpose: t.purpose,
    subject: t.subject,
    body: t.body,
    productId: t.productId,
    productName: t.product?.name ?? null,
    sortOrder: t.sortOrder,
  }));
}
