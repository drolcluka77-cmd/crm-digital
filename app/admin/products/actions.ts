"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { saveUploadedFile } from "@/lib/upload";
import { BILLINGS } from "@/lib/constants";
import { normalizeUrl } from "@/lib/format";

export type ActionResult = { error?: string; success?: string } | void;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const opt = (fd: FormData, key: string) => str(fd, key) || null;

function revalidateCatalog(productId?: string) {
  revalidatePath("/admin/products");
  revalidatePath("/admin/access");
  revalidatePath("/admin/materials");
  revalidatePath("/crm/products");
  revalidatePath("/crm/library");
  revalidatePath("/crm/quotes/new");
  if (productId) {
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath(`/crm/products/${productId}`);
  }
}

/** Quick create (name + family) → then the full editor opens. */
export async function createProduct(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const name = str(formData, "name");
  if (!name) return { error: "Give the product a name." };

  const max = await prisma.product.aggregate({ _max: { sortOrder: true } });
  const product = await prisma.product.create({
    data: {
      name,
      family: opt(formData, "family"),
      tagline: opt(formData, "tagline"),
      targetSegment: opt(formData, "targetSegment"),
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      active: true,
    },
  });
  revalidateCatalog();
  redirect(`/admin/products/${product.id}`);
}

export async function updateProduct(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(formData, "id");
  const name = str(formData, "name");
  if (!id || !name) return { error: "Name is required." };

  const commissionRaw = str(formData, "commissionRate");
  const commissionRate = commissionRaw ? Number(commissionRaw) : 0;
  if (Number.isNaN(commissionRate) || commissionRate < 0 || commissionRate > 100) {
    return { error: "Commission must be between 0 and 100 %." };
  }
  const sortOrder = Number(str(formData, "sortOrder") || 0) || 0;
  const renewalRaw = str(formData, "renewalCommissionRate");
  const renewalCommissionRate = renewalRaw ? Math.min(100, Math.max(0, Number(renewalRaw) || 0)) : 0;
  const maxRaw = str(formData, "maxDiscount");
  const maxDiscount = maxRaw === "" ? null : Math.min(100, Math.max(0, Number(maxRaw) || 0));

  let imageUrl: string | undefined;
  const image = formData.get("image") as File | null;
  if (image && image.size > 0) {
    if (!image.type.startsWith("image/")) return { error: "The product image must be an image file." };
    imageUrl = (await saveUploadedFile(image, "products")).url;
  }
  const removeImage = formData.get("removeImage") === "on";

  const color = str(formData, "color");
  await prisma.product.update({
    where: { id },
    data: {
      name,
      family: opt(formData, "family"),
      tagline: opt(formData, "tagline"),
      targetSegment: opt(formData, "targetSegment"),
      description: opt(formData, "description"),
      pitch: opt(formData, "pitch"),
      keyBenefits: opt(formData, "keyBenefits"),
      idealCustomer: opt(formData, "idealCustomer"),
      objections: opt(formData, "objections"),
      websiteUrl: normalizeUrl(str(formData, "websiteUrl")),
      demoUrl: normalizeUrl(str(formData, "demoUrl")),
      color: /^#[0-9a-fA-F]{6}$/.test(color) ? color : null,
      commissionRate,
      renewalCommissionRate,
      maxDiscount,
      sortOrder,
      ...(imageUrl ? { imageUrl } : removeImage ? { imageUrl: null } : {}),
    },
  });
  revalidateCatalog(id);
  return { success: "Product saved." };
}

export async function toggleProductActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  await prisma.product.update({ where: { id }, data: { active } });
  revalidateCatalog(id);
}

/**
 * Copies a product (texts, plans, seller access — not materials) so a new
 * edition like "Unbusyness for Hotels" starts from an existing one.
 */
export async function duplicateProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  const src = await prisma.product.findUnique({
    where: { id },
    include: { plans: true, access: true },
  });
  if (!src) return { error: "Product not found." };

  const copy = await prisma.product.create({
    data: {
      name: `${src.name} (copy)`,
      family: src.family,
      tagline: src.tagline,
      targetSegment: src.targetSegment,
      description: src.description,
      pitch: src.pitch,
      keyBenefits: src.keyBenefits,
      idealCustomer: src.idealCustomer,
      objections: src.objections,
      websiteUrl: src.websiteUrl,
      demoUrl: src.demoUrl,
      imageUrl: src.imageUrl,
      color: src.color,
      commissionRate: src.commissionRate,
      renewalCommissionRate: src.renewalCommissionRate,
      maxDiscount: src.maxDiscount,
      requireCertification: src.requireCertification,
      passScore: src.passScore,
      sortOrder: src.sortOrder + 1,
      active: false, // starts hidden until you've edited it
      plans: {
        create: src.plans.map((p) => ({
          name: p.name,
          price: p.price,
          billing: p.billing,
          unitLabel: p.unitLabel,
          description: p.description,
          active: p.active,
          sortOrder: p.sortOrder,
        })),
      },
    },
  });
  revalidateCatalog();
  redirect(`/admin/products/${copy.id}`);
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  const used = await prisma.quoteItem.count({ where: { productId: id } });
  if (used > 0) {
    return {
      error: "This product is used in existing quotes. Deactivate it instead, so quote history stays intact.",
    };
  }
  await prisma.product.delete({ where: { id } });
  revalidateCatalog();
  redirect("/admin/products");
}

// ─── Plans ──────────────────────────────────────────────────────────────

function parsePlan(formData: FormData) {
  const name = str(formData, "name");
  const priceRaw = str(formData, "price");
  const price = Number(priceRaw);
  const billing = str(formData, "billing");
  if (!name) return { error: "Give the plan a name." } as const;
  if (!priceRaw || Number.isNaN(price) || price < 0) return { error: "Enter a valid price." } as const;
  if (!BILLINGS.includes(billing as any)) return { error: "Choose how the plan is billed." } as const;
  return {
    data: {
      name,
      price,
      billing,
      unitLabel: opt(formData, "unitLabel"),
      description: opt(formData, "description"),
      sortOrder: Number(str(formData, "sortOrder") || 0) || 0,
    },
  } as const;
}

export async function savePlan(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const productId = str(formData, "productId");
  const planId = str(formData, "planId");
  const parsed = parsePlan(formData);
  if ("error" in parsed) return { error: parsed.error };

  if (planId) {
    const existing = await prisma.productPlan.findUnique({ where: { id: planId } });
    if (!existing || existing.productId !== productId) return { error: "Plan not found." };
    await prisma.productPlan.update({ where: { id: planId }, data: parsed.data });
  } else {
    await prisma.productPlan.create({ data: { ...parsed.data, productId, active: true } });
  }
  revalidateCatalog(productId);
  return { success: "Plan saved." };
}

export async function togglePlanActive(planId: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const plan = await prisma.productPlan.update({ where: { id: planId }, data: { active } });
  revalidateCatalog(plan.productId);
}

export async function deletePlan(planId: string): Promise<ActionResult> {
  await requireAdmin();
  const plan = await prisma.productPlan.findUnique({ where: { id: planId } });
  if (!plan) return;
  // Quote lines keep their own name/price copy; the link is just cleared.
  await prisma.productPlan.delete({ where: { id: planId } });
  revalidateCatalog(plan.productId);
}

// ─── Seller access from the product page ────────────────────────────────

/** Replace the full list of sellers who can see this product. */
export async function setProductSellers(productId: string, sellerIds: string[]): Promise<ActionResult> {
  const admin = await requireAdmin();
  const sellers = await prisma.user.findMany({
    where: { id: { in: sellerIds }, role: "SALES" },
    select: { id: true },
  });
  const valid = sellers.map((s) => s.id);

  await prisma.$transaction([
    prisma.productAccess.deleteMany({ where: { productId, userId: { notIn: valid } } }),
    ...valid.map((userId) =>
      prisma.productAccess.upsert({
        where: { userId_productId: { userId, productId } },
        create: { userId, productId, grantedById: admin.id },
        update: {},
      })
    ),
  ]);
  revalidateCatalog(productId);
  revalidatePath("/admin/team");
  return { success: `${valid.length} seller${valid.length === 1 ? "" : "s"} can now see this product.` };
}
