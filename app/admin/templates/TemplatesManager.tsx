"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import Badge from "@/components/Badge";
import { PlusIcon, PencilIcon, TrashIcon, MailIcon } from "@/components/icons";
import { saveTemplate, deleteTemplate } from "./actions";
import { TEMPLATE_PLACEHOLDERS, TEMPLATE_PURPOSES, TEMPLATE_PURPOSE_LABEL } from "@/lib/constants";

export type AdminTemplate = {
  id: string;
  name: string;
  purpose: string;
  subject: string;
  body: string;
  productId: string | null;
  productName: string | null;
  sortOrder: number;
};

export default function TemplatesManager({
  templates,
  products,
  fixedProductId,
  compact = false,
}: {
  templates: AdminTemplate[];
  products: { id: string; name: string }[];
  fixedProductId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminTemplate | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = editing && editing !== "new" ? editing : null;

  async function submit(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = await saveTemplate(fd);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setEditing(null);
    router.refresh();
  }

  return (
    <div>
      <div className={`flex flex-wrap items-center justify-between gap-3 ${compact ? "mb-3" : "mb-6"}`}>
        {compact ? (
          <div>
            <h2 className="font-semibold">Email templates</h2>
            <p className="text-sm text-black/45">Ready-made emails sellers pick on a customer page.</p>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Email templates</h1>
            <p className="text-black/50 text-sm mt-1">
              First-contact, follow-up and after-demo emails sellers can send in one click. Placeholders are filled
              in with the client&apos;s and seller&apos;s details.
            </p>
          </div>
        )}
        <button
          className={compact ? "btn-secondary" : "btn-primary"}
          onClick={() => {
            setError(null);
            setEditing("new");
          }}
        >
          <PlusIcon className="h-4 w-4" /> Add template
        </button>
      </div>

      <div className="card divide-y divide-black/5">
        {templates.map((tp) => (
          <div key={tp.id} className="px-5 py-4 flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <MailIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{tp.name}</span>
                <Badge variant="MUTED">{TEMPLATE_PURPOSE_LABEL[tp.purpose]}</Badge>
                {!fixedProductId && <Badge variant="INFO">{tp.productName || "General"}</Badge>}
              </div>
              <div className="text-sm text-black/60 mt-0.5 truncate">{tp.subject}</div>
              <div className="text-xs text-black/40 mt-0.5 line-clamp-2 whitespace-pre-wrap">{tp.body}</div>
            </div>
            <button
              className="btn-ghost"
              onClick={() => {
                setError(null);
                setEditing(tp);
              }}
            >
              <PencilIcon className="h-4 w-4" />
            </button>
            <button
              className="btn-danger"
              onClick={async () => {
                if (!confirm(`Delete template "${tp.name}"?`)) return;
                await deleteTemplate(tp.id);
                router.refresh();
              }}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-black/40">
            No templates yet. Start with a first-contact email and an after-demo follow-up.
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={t ? "Edit template" : "Add template"} wide>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          {error && <div className="error-box">{error}</div>}
          {t && <input type="hidden" name="id" value={t.id} />}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Template name</label>
              <input name="name" required defaultValue={t?.name} className="input" placeholder="Cold intro — building managers" />
            </div>
            <div>
              <label className="label">Purpose</label>
              <select name="purpose" defaultValue={t?.purpose || "FIRST_CONTACT"} className="input">
                {TEMPLATE_PURPOSES.map((p) => (
                  <option key={p} value={p}>
                    {TEMPLATE_PURPOSE_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {fixedProductId ? (
            <input type="hidden" name="productId" value={fixedProductId} />
          ) : (
            <div>
              <label className="label">Product</label>
              <select name="productId" defaultValue={t?.productId || "GENERAL"} className="input">
                <option value="GENERAL">General — all sellers</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label">Subject</label>
            <input name="subject" required defaultValue={t?.subject} className="input" placeholder="Less phone time for {{company}}" />
          </div>
          <div>
            <label className="label">Text</label>
            <textarea
              name="body"
              required
              defaultValue={t?.body}
              className="input min-h-[200px] font-mono text-[13px]"
              placeholder={"Hi {{firstName}},\n\n…\n\nYou can pick a time for a 20-minute demo here: {{bookingLink}}\n\nBest regards,"}
            />
          </div>
          <div className="rounded-xl bg-sand-50 px-4 py-3 text-xs text-black/55">
            <div className="font-medium text-black/70 mb-1">Placeholders</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5">
              {TEMPLATE_PLACEHOLDERS.map(([k, v]) => (
                <div key={k}>
                  <code className="text-brand-700">{k}</code> — {v}
                </div>
              ))}
            </div>
            <div className="mt-1">The seller&apos;s signature is added automatically.</div>
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Saving…" : "Save template"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
