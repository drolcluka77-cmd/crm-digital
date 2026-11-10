import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import AccessMatrix from "./AccessMatrix";

export const dynamic = "force-dynamic";

export default async function AccessPage() {
  const actor = await requireStaff();
  const isAdmin = actor.role === "ADMIN";

  const [sellers, products] = await Promise.all([
    prisma.user.findMany({
      where: { role: "SALES", ...(isAdmin ? {} : { managerId: actor.id }) },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        active: true,
        manager: { select: { name: true } },
        productAccess: { select: { productId: true } },
        certifications: { where: { passedAt: { not: null } }, select: { productId: true } },
      },
    }),
    prisma.product.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, family: true, active: true, color: true, requireCertification: true },
    }),
  ]);

  return (
    <AccessMatrix
      isAdmin={isAdmin}
      products={products}
      sellers={sellers.map((s) => ({
        id: s.id,
        name: s.name,
        active: s.active,
        managerName: s.manager?.name ?? null,
        productIds: s.productAccess.map((a) => a.productId),
        certifiedIds: s.certifications.map((c) => c.productId),
      }))}
    />
  );
}
