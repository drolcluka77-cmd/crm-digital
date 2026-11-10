"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { canManageSeller, getManagedSellerIds } from "@/lib/access";

export type ActionResult = { error?: string; success?: string } | void;

function revalidateAccess() {
  revalidatePath("/admin/access");
  revalidatePath("/admin/team");
  revalidatePath("/admin/products");
  revalidatePath("/crm", "layout");
}

/** Tick / untick one cell of the seller × product matrix. */
export async function setAccess(userId: string, productId: string, granted: boolean): Promise<ActionResult> {
  const actor = await requireStaff();
  if (!(await canManageSeller(actor, userId))) return { error: "That seller isn't on your team." };
  if (!(await prisma.product.findUnique({ where: { id: productId } }))) return { error: "Product not found." };

  if (granted) {
    await prisma.productAccess.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, grantedById: actor.id },
      update: {},
    });
  } else {
    await prisma.productAccess.deleteMany({ where: { userId, productId } });
  }
  revalidateAccess();
}

/** Replace a seller's full product list (used by the Team page modal). */
export async function setSellerProducts(userId: string, productIds: string[]): Promise<ActionResult> {
  const actor = await requireStaff();
  if (!(await canManageSeller(actor, userId))) return { error: "That seller isn't on your team." };

  const valid = (
    await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } })
  ).map((p) => p.id);

  await prisma.$transaction([
    prisma.productAccess.deleteMany({ where: { userId, productId: { notIn: valid } } }),
    ...valid.map((productId) =>
      prisma.productAccess.upsert({
        where: { userId_productId: { userId, productId } },
        create: { userId, productId, grantedById: actor.id },
        update: {},
      })
    ),
  ]);
  revalidateAccess();
  return { success: "Products updated." };
}

/** Give (or take away) one product for every seller you manage. */
export async function setProductForTeam(productId: string, granted: boolean): Promise<ActionResult> {
  const actor = await requireStaff();
  const sellerIds = await getManagedSellerIds(actor);
  if (sellerIds.length === 0) return { error: "You don't have any sellers yet." };

  if (granted) {
    const existing = await prisma.productAccess.findMany({
      where: { productId, userId: { in: sellerIds } },
      select: { userId: true },
    });
    const have = new Set(existing.map((e) => e.userId));
    const missing = sellerIds.filter((id) => !have.has(id));
    if (missing.length) {
      await prisma.productAccess.createMany({
        data: missing.map((userId) => ({ userId, productId, grantedById: actor.id })),
      });
    }
  } else {
    await prisma.productAccess.deleteMany({ where: { productId, userId: { in: sellerIds } } });
  }
  revalidateAccess();
}
