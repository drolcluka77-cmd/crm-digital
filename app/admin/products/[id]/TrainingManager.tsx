"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon } from "@/components/icons";
import {
  updateCertificationSettings,
  saveQuestion,
  deleteQuestion,
  resetCertifications,
} from "../training-actions";

type Question = { id: string; question: string; options: string[]; correctIndex: number; explanation: string | null };

export default function TrainingManager({
  productId,
  requireCertification,
  passScore,
  questions,
  certified,
}: {
  productId: string;
  requireCertification: boolean;
  passScore: number;
  questions: Question[];
  certified: { name: string; score: number; passedAt: string | null }[];
}) {
  const router = useRouter();
  const [required, setRequired] = useState(requireCertification);
  const [score, setScore] = useState(passScore);
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const q = editing && editing !== "new" ? editing : null;

  async function saveSettings() {
    setBusy(true);
    const result = await updateCertificationSettings(productId, required, score);
    setBusy(false);
    setMsg(result || null);
    if (result && result.error) setRequired(requireCertification);
    router.refresh();
  }

  async function submit(fd: FormData) {
    setBusy(true);
    setFormError(null);
    const result = await saveQuestion(fd);
    setBusy(false);
    if (result && result.error) return setFormError(result.error);
    setEditing(null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold">Training & certification</h2>
          <p className="text-sm text-black/45">
            A short quiz sellers pass before they can quote this product or send its materials. They can still read
            the playbook while learning.
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => {
            setFormError(null);
            setEditing("new");
          }}
        >
          <PlusIcon className="h-4 w-4" /> Add question
        </button>
      </div>

      <div className="card p-5 mb-3 flex flex-wrap items-end gap-4">
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
          Require certification to sell
        </label>
        <div>
          <label className="label">Pass mark (%)</label>
          <input
            type="number"
            min={1}
            max={100}
            value={score}
            onChange={(e) => setScore(Number(e.target.value))}
            className="input w-28 py-2"
          />
        </div>
        <button className="btn-primary" disabled={busy} onClick={saveSettings}>
          Save
        </button>
        {certified.length > 0 && (
          <button
            className="btn-ghost ml-auto"
            onClick={async () => {
              if (!confirm("Everyone will have to pass the quiz again. Continue?")) return;
              setMsg((await resetCertifications(productId)) || null);
              router.refresh();
            }}
          >
            Reset certifications
          </button>
        )}
        {msg?.error && <div className="error-box w-full">{msg.error}</div>}
        {msg?.success && <div className="success-box w-full">{msg.success}</div>}
      </div>

      <div className="card divide-y divide-black/5">
        {questions.map((qq, i) => (
          <div key={qq.id} className="px-5 py-4 flex items-start gap-4">
            <span className="text-xs font-semibold text-black/35 mt-0.5 w-5">{i + 1}.</span>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">{qq.question}</div>
              <ul className="mt-1 space-y-0.5">
                {qq.options.map((o, oi) => (
                  <li key={oi} className={`text-xs flex items-center gap-1.5 ${oi === qq.correctIndex ? "text-emerald-700 font-medium" : "text-black/50"}`}>
                    {oi === qq.correctIndex ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <span className="w-3.5" />}
                    {o}
                  </li>
                ))}
              </ul>
            </div>
            <button
              className="btn-ghost"
              onClick={() => {
                setFormError(null);
                setEditing(qq);
              }}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              className="btn-danger"
              onClick={async () => {
                if (!confirm("Delete this question?")) return;
                await deleteQuestion(qq.id);
                router.refresh();
              }}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
        {questions.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-black/40">
            No questions yet. 5–10 questions about who it&apos;s for, pricing and key benefits work well.
          </div>
        )}
      </div>

      {certified.length > 0 && (
        <div className="mt-3 text-xs text-black/50">
          Certified: {certified.filter((c) => c.passedAt).map((c) => `${c.name} (${c.score}%)`).join(", ") || "nobody yet"}
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={q ? "Edit question" : "Add question"} wide>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          {formError && <div className="error-box">{formError}</div>}
          <input type="hidden" name="productId" value={productId} />
          {q && <input type="hidden" name="id" value={q.id} />}
          <div>
            <label className="label">Question</label>
            <input name="question" required defaultValue={q?.question} className="input" placeholder="Who is Arrive built for?" />
          </div>
          <div>
            <label className="label">Answers — one per line</label>
            <textarea
              name="options"
              required
              defaultValue={q?.options.join("\n")}
              className="input min-h-[120px]"
              placeholder={"Hotels and hospitals\nRestaurants\nSchools"}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Correct answer #</label>
              <input name="correct" type="number" min={1} max={6} required defaultValue={q ? q.correctIndex + 1 : 1} className="input" />
            </div>
            <div className="col-span-2">
              <label className="label">Explanation (shown after a wrong answer)</label>
              <input name="explanation" defaultValue={q?.explanation || ""} className="input" />
            </div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Saving…" : "Save question"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
