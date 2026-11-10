import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/session";

/**
 * Product visibility rules — the single place that decides who sees what.
 *
 * - Admins and managers see every product.
 * - Sellers see only active products they were given access to
 *   (ProductAccess rows, managed under Console → Product access).
 */
export async function getAccessibleProductIds(user: CurrentUser): Promise<string[]> {
  if (user.role !== "SALES") {
    const all = await prisma.product.findMany({ select: { id: true } });
    return all.map((p) => p.id);
  }
  const rows = await prisma.productAccess.findMany({
    where: { userId: user.id, product: { active: true } },
    select: { productId: true },
  });
  return rows.map((r) => r.productId);
}

export async function canAccessProduct(user: CurrentUser, productId: string): Promise<boolean> {
  if (user.role !== "SALES") return true;
  const row = await prisma.productAccess.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
    include: { product: { select: { active: true } } },
  });
  return !!row && row.product.active;
}

/** General materials (no product) are visible to everyone signed in. */
export async function canAccessMaterial(
  user: CurrentUser,
  material: { productId: string | null }
): Promise<boolean> {
  if (!material.productId) return true;
  return canAccessProduct(user, material.productId);
}

/**
 * The sellers a staff member manages: admins → every seller,
 * managers → sellers whose managerId is them.
 */
export async function getManagedSellerIds(user: CurrentUser): Promise<string[]> {
  if (user.role === "ADMIN") {
    const all = await prisma.user.findMany({ where: { role: "SALES" }, select: { id: true } });
    return all.map((u) => u.id);
  }
  if (user.role === "MANAGER") {
    const team = await prisma.user.findMany({
      where: { role: "SALES", managerId: user.id },
      select: { id: true },
    });
    return team.map((u) => u.id);
  }
  return [];
}

export async function canManageSeller(user: CurrentUser, sellerId: string): Promise<boolean> {
  const seller = await prisma.user.findUnique({ where: { id: sellerId } });
  if (!seller || seller.role !== "SALES") return false;
  if (user.role === "ADMIN") return true;
  return user.role === "MANAGER" && seller.managerId === user.id;
}

/**
 * Products the seller may actually sell (quote, send materials): accessible
 * AND — if the product requires it — passed its certification quiz.
 * Accessible-but-uncertified products stay visible for learning.
 */
export async function getSellableProductIds(user: CurrentUser): Promise<string[]> {
  const accessible = await getAccessibleProductIds(user);
  if (user.role !== "SALES") return accessible;
  const [gated, certs] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: accessible }, requireCertification: true },
      select: { id: true },
    }),
    prisma.certification.findMany({
      where: { userId: user.id, passedAt: { not: null } },
      select: { productId: true },
    }),
  ]);
  const gatedIds = new Set(gated.map((g) => g.id));
  const certified = new Set(certs.map((c) => c.productId));
  return accessible.filter((id) => !gatedIds.has(id) || certified.has(id));
}
