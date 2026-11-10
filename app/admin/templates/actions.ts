"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { TEMPLATE_PURPOSES } from "@/lib/constants";

export type ActionResult = { error?: string; success?: string } | void;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function revalidateTemplates(productId?: string | null) {
  revalidatePath("/admin/templates");
  if (productId) revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/crm/customers", "layout");
}

export async function saveTemplate(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const id = str(formData, "id");
  const name = str(formData, "name");
  const subject = str(formData, "subject");
  const body = String(formData.get("body") ?? "").trim();
  const purpose = str(formData, "purpose") || "OTHER";
  const productRaw = str(formData, "productId");
  const productId = productRaw && productRaw !== "GENERAL" ? productRaw : null;
  if (!name || !subject || !body) return { error: "Name, subject and text are required." };
  if (!(TEMPLATE_PURPOSES as readonly string[]).includes(purpose)) return { error: "Pick a purpose." };

  const data = {
    name,
    subject,
    body,
    purpose,
    productId,
    sortOrder: Number(str(formData, "sortOrder") || 0) || 0,
  };
  if (id) {
    const existing = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!existing) return { error: "Template not found." };
    await prisma.emailTemplate.update({ where: { id }, data });
    revalidateTemplates(existing.productId);
  } else {
    await prisma.emailTemplate.create({ data });
  }
  revalidateTemplates(productId);
  return { success: "Template saved." };
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  await requireAdmin();
  const t = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!t) return;
  await prisma.emailTemplate.delete({ where: { id } });
  revalidateTemplates(t.productId);
}
