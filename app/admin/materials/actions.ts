"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { savePrivateFile, deletePrivateFile } from "@/lib/upload";
import { MATERIAL_TYPES } from "@/lib/constants";
import { normalizeUrl } from "@/lib/format";

export type ActionResult = { error?: string; success?: string } | void;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function revalidateMaterials(productId?: string | null) {
  revalidatePath("/admin/materials");
  revalidatePath("/crm/library");
  revalidatePath("/crm/products");
  if (productId) {
    revalidatePath(`/admin/products/${productId}`);
    revalidatePath(`/crm/products/${productId}`);
  }
}

async function readCommon(formData: FormData) {
  const title = str(formData, "title");
  const type = str(formData, "type") || "OTHER";
  const productIdRaw = str(formData, "productId");
  const productId = productIdRaw && productIdRaw !== "GENERAL" ? productIdRaw : null;
  if (!title) return { error: "Give the material a title." } as const;
  if (!MATERIAL_TYPES.includes(type as any)) return { error: "Choose a material type." } as const;
  if (productId && !(await prisma.product.findUnique({ where: { id: productId } }))) {
    return { error: "That product doesn't exist." } as const;
  }
  return {
    data: {
      title,
      type,
      productId,
      description: str(formData, "description") || null,
      // Sales scripts are always internal.
      internalOnly: type === "SALES_SCRIPT" || formData.get("internalOnly") === "on",
      linkUrl: normalizeUrl(str(formData, "linkUrl")),
      sortOrder: Number(str(formData, "sortOrder") || 0) || 0,
    },
  } as const;
}

/** Upload a file (deck, PDF, video) and/or add a link (YouTube, Loom, live demo). */
export async function createMaterial(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const common = await readCommon(formData);
  if ("error" in common) return { error: common.error };

  const file = formData.get("file") as File | null;
  const hasFile = !!file && file.size > 0;
  if (!hasFile && !common.data.linkUrl) {
    return { error: "Upload a file or paste a link (or both)." };
  }

  const saved = hasFile ? await savePrivateFile(file!, "materials") : null;
  await prisma.salesMaterial.create({ data: { ...common.data, ...(saved || {}) } });

  revalidateMaterials(common.data.productId);
  return { success: "Material added." };
}

export async function updateMaterial(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(formData, "id");
  const existing = await prisma.salesMaterial.findUnique({ where: { id } });
  if (!existing) return { error: "Material not found." };

  const common = await readCommon(formData);
  if ("error" in common) return { error: common.error };

  const file = formData.get("file") as File | null;
  const removeFile = formData.get("removeFile") === "on";
  let fileData: Record<string, unknown> = {};
  if (file && file.size > 0) {
    fileData = await savePrivateFile(file, "materials");
    await deletePrivateFile(existing.storagePath);
  } else if (removeFile) {
    fileData = { storagePath: null, fileName: null, fileType: null, fileSize: null };
    await deletePrivateFile(existing.storagePath);
  }

  const willHaveFile = file && file.size > 0 ? true : removeFile ? false : !!existing.storagePath;
  if (!willHaveFile && !common.data.linkUrl) {
    return { error: "A material needs a file or a link." };
  }

  await prisma.salesMaterial.update({ where: { id }, data: { ...common.data, ...fileData } });
  revalidateMaterials(existing.productId);
  if (existing.productId !== common.data.productId) revalidateMaterials(common.data.productId);
  return { success: "Material saved." };
}

export async function deleteMaterial(id: string): Promise<ActionResult> {
  await requireAdmin();
  const existing = await prisma.salesMaterial.findUnique({ where: { id } });
  if (!existing) return;
  await prisma.salesMaterial.delete({ where: { id } });
  await deletePrivateFile(existing.storagePath);
  revalidateMaterials(existing.productId);
}
