"use client";

import { useState } from "react";
import Link from "next/link";
import { submitQuiz, type QuizResult } from "../../actions";

export default function QuizForm({
  productId,
  questions,
}: {
  productId: string;
  questions: { id: string; question: string; options: string[] }[];
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuizResult>(undefined);
  const [attempt, setAttempt] = useState(0);
  const answered = Object.keys(answers).length;

  async function submit() {
    setBusy(true);
    setResult(await submitQuiz(productId, answers));
    setBusy(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (result && !result.error) {
    return (
      <div className="space-y-4">
        <div className={`card p-6 text-center ${result.passed ? "border-emerald-200" : ""}`}>
          <div className="text-4xl font-semibold">{result.score}%</div>
          <div className={`mt-1 font-medium ${result.passed ? "text-emerald-700" : "text-amber-700"}`}>
            {result.passed ? "Passed — you can now quote this product." : `Not yet — you need ${result.passScore}%.`}
          </div>
          <div className="mt-4 flex justify-center gap-2">
            {result.passed ? (
              <Link href={`/crm/quotes/new?productId=${productId}`} className="btn-primary">
                Make a quote
              </Link>
            ) : (
              <Link href={`/crm/products/${productId}`} className="btn-secondary">
                Review the playbook
              </Link>
            )}
            <button
              className="btn-ghost"
              onClick={() => {
                setAnswers({});
                setResult(undefined);
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </button>
          </div>
        </div>
        {result.review && result.review.some((r) => !r.correct) && (
          <div className="card divide-y divide-black/5">
            {result.review
              .filter((r) => !r.correct)
              .map((r, i) => (
                <div key={i} className="px-5 py-4 text-sm">
                  <div className="font-medium">{r.question}</div>
                  <div className="text-emerald-700 mt-1">Correct answer: {r.correctAnswer}</div>
                  {r.explanation && <div className="text-black/55 mt-0.5">{r.explanation}</div>}
                </div>
              ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div key={attempt} className="space-y-4">
      {result?.error && <div className="error-box">{result.error}</div>}
      {questions.map((q, qi) => (
        <div key={q.id} className="card p-5">
          <div className="font-medium mb-3">
            {qi + 1}. {q.question}
          </div>
          <div className="space-y-2">
            {q.options.map((o, oi) => (
              <label
                key={oi}
                className="flex items-center gap-3 rounded-xl border border-black/10 px-4 py-3 text-sm cursor-pointer has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/60"
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === oi}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                />
                {o}
              </label>
            ))}
          </div>
        </div>
      ))}
      <button className="btn-primary w-full py-3" disabled={busy || answered < questions.length} onClick={submit}>
        {busy ? "Checking…" : answered < questions.length ? `Answer all questions (${answered}/${questions.length})` : "Submit answers"}
      </button>
    </div>
  );
}
