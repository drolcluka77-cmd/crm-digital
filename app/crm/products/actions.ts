"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { canAccessProduct } from "@/lib/access";
import { notify, supervisorsOf } from "@/lib/notify";

export type QuizResult =
  | {
      error?: string;
      score?: number;
      passed?: boolean;
      passScore?: number;
      review?: { question: string; correct: boolean; correctAnswer: string; explanation: string | null }[];
    }
  | void;

/** Grades the quiz on the server (answers never leave it) and records certification. */
export async function submitQuiz(productId: string, answers: Record<string, number>): Promise<QuizResult> {
  const user = await requireSales();
  if (!(await canAccessProduct(user, productId))) return { error: "You don't have access to this product." };

  const [product, questions] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.quizQuestion.findMany({ where: { productId }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!product || questions.length === 0) return { error: "This product has no quiz." };

  let right = 0;
  const review = questions.map((q) => {
    let options: string[] = [];
    try {
      options = JSON.parse(q.options);
    } catch {}
    const correct = answers[q.id] === q.correctIndex;
    if (correct) right++;
    return { question: q.question, correct, correctAnswer: options[q.correctIndex] || "", explanation: q.explanation };
  });
  const score = Math.round((right / questions.length) * 100);
  const passed = score >= product.passScore;

  const existing = await prisma.certification.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });
  const firstPass = passed && !existing?.passedAt;
  await prisma.certification.upsert({
    where: { userId_productId: { userId: user.id, productId } },
    create: { userId: user.id, productId, bestScore: score, lastScore: score, attempts: 1, passedAt: passed ? new Date() : null },
    update: {
      lastScore: score,
      bestScore: Math.max(score, existing?.bestScore ?? 0),
      attempts: { increment: 1 },
      ...(firstPass ? { passedAt: new Date() } : {}),
    },
  });
  if (firstPass) {
    await notify(await supervisorsOf(user.id), {
      type: "CERTIFIED",
      title: `${user.name} is certified for ${product.name}`,
      body: `Scored ${score}%.`,
      link: "/admin/access",
    }, { email: false });
  }

  revalidatePath(`/crm/products/${productId}`);
  revalidatePath("/crm/products");
  revalidatePath("/crm/quotes/new");
  return { score, passed, passScore: product.passScore, review };
}
