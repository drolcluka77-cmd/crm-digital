import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { canAccessProduct } from "@/lib/access";
import QuizForm from "./QuizForm";

export const dynamic = "force-dynamic";

export default async function QuizPage({ params }: { params: { id: string } }) {
  const user = await requireSales();
  if (!(await canAccessProduct(user, params.id))) notFound();

  const [product, questions, cert] = await Promise.all([
    prisma.product.findUnique({ where: { id: params.id } }),
    prisma.quizQuestion.findMany({ where: { productId: params.id }, orderBy: { sortOrder: "asc" } }),
    prisma.certification.findUnique({ where: { userId_productId: { userId: user.id, productId: params.id } } }),
  ]);
  if (!product) notFound();

  return (
    <div className="max-w-2xl">
      <Link href={`/crm/products/${product.id}`} className="text-sm text-black/40 hover:text-black/60">
        ← {product.name}
      </Link>
      <div className="mt-3 mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{product.name} — certification</h1>
        <p className="text-black/50 text-sm mt-1">
          {questions.length} questions · pass mark {product.passScore}%.
          {cert?.passedAt ? ` ✅ You passed (best ${cert.bestScore}%) — you can retake it any time.` : ""}
          {!cert?.passedAt && cert?.attempts ? ` Attempts so far: ${cert.attempts}, best ${cert.bestScore}%.` : ""}
        </p>
        <p className="text-sm text-black/50 mt-1">
          Tip: read the playbook first — the answers are all in there.
        </p>
      </div>
      {questions.length === 0 ? (
        <div className="card p-8 text-center text-sm text-black/40">This product doesn&apos;t have a quiz yet.</div>
      ) : (
        <QuizForm
          productId={product.id}
          questions={questions.map((q) => {
            let options: string[] = [];
            try {
              options = JSON.parse(q.options);
            } catch {}
            return { id: q.id, question: q.question, options };
          })}
        />
      )}
    </div>
  );
}
