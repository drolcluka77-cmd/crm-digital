"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export type ActionResult = { error?: string; success?: string } | void;

function revalidateTraining(productId: string) {
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath(`/crm/products/${productId}`);
  revalidatePath(`/crm/products/${productId}/quiz`);
  revalidatePath("/crm/products");
  revalidatePath("/admin/access");
}

export async function updateCertificationSettings(
  productId: string,
  requireCertification: boolean,
  passScore: number
): Promise<ActionResult> {
  await requireAdmin();
  if (requireCertification) {
    const count = await prisma.quizQuestion.count({ where: { productId } });
    if (count === 0) return { error: "Add at least one question before requiring certification." };
  }
  await prisma.product.update({
    where: { id: productId },
    data: { requireCertification, passScore: Math.min(100, Math.max(1, Math.round(passScore) || 80)) },
  });
  revalidateTraining(productId);
  return { success: "Saved." };
}

export async function saveQuestion(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const productId = String(formData.get("productId") || "");
  const id = String(formData.get("id") || "");
  const question = String(formData.get("question") || "").trim();
  const options = String(formData.get("options") || "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
  const correct = Number(formData.get("correct") || 0) - 1;
  const explanation = String(formData.get("explanation") || "").trim() || null;

  if (!question) return { error: "Write the question." };
  if (options.length < 2 || options.length > 6) return { error: "Give 2–6 answers, one per line." };
  if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) {
    return { error: `The correct answer must be a number from 1 to ${options.length}.` };
  }
  const data = { question, options: JSON.stringify(options), correctIndex: correct, explanation };

  if (id) {
    const q = await prisma.quizQuestion.findUnique({ where: { id } });
    if (!q || q.productId !== productId) return { error: "Question not found." };
    await prisma.quizQuestion.update({ where: { id }, data });
  } else {
    const max = await prisma.quizQuestion.aggregate({ where: { productId }, _max: { sortOrder: true } });
    await prisma.quizQuestion.create({ data: { ...data, productId, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  }
  revalidateTraining(productId);
  return { success: "Question saved." };
}

export async function deleteQuestion(id: string): Promise<ActionResult> {
  await requireAdmin();
  const q = await prisma.quizQuestion.findUnique({ where: { id } });
  if (!q) return;
  await prisma.quizQuestion.delete({ where: { id } });
  const left = await prisma.quizQuestion.count({ where: { productId: q.productId } });
  if (left === 0) await prisma.product.update({ where: { id: q.productId }, data: { requireCertification: false } });
  revalidateTraining(q.productId);
}

/** Reset a seller's certification (e.g. after the product changed a lot). */
export async function resetCertifications(productId: string): Promise<ActionResult> {
  await requireAdmin();
  const { count } = await prisma.certification.updateMany({ where: { productId }, data: { passedAt: null } });
  revalidateTraining(productId);
  return { success: `${count} seller${count === 1 ? "" : "s"} must pass the quiz again.` };
}
