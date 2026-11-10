"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import Badge from "@/components/Badge";
import { PlusIcon, PencilIcon, TrashIcon } from "@/components/icons";
import { savePlan, togglePlanActive, deletePlan } from "../actions";
import { BILLINGS, BILLING_LABEL } from "@/lib/constants";
import { formatPrice } from "@/lib/format";

type Plan = {
  id: string;
  name: string;
  price: number;
  billing: string;
  unitLabel: string | null;
  description: string | null;
  active: boolean;
  sortOrder: number;
};

export default function PlansManager({ productId, plans }: { productId: string; plans: Plan[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = await savePlan(fd);
    setBusy(false);
    if (result && result.error) {
      setError(result.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function handleToggle(p: Plan) {
    await togglePlanActive(p.id, !p.active);
    router.refresh();
  }

  async function handleDelete(p: Plan) {
    if (!confirm(`Delete plan "${p.name}"? Existing quotes keep their lines.`)) return;
    await deletePlan(p.id);
    router.refresh();
  }

  const plan = editing && editing !== "new" ? editing : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-semibold">Plans & pricing</h2>
          <p className="text-sm text-black/45">
            The price points sellers pick from in the quote builder. Prices excl. VAT.
          </p>
        </div>
        <button
          className="btn-secondary"
          onClick={() => {
            setError(null);
            setEditing("new");
          }}
        >
          <PlusIcon className="h-4 w-4" /> Add plan
        </button>
      </div>

      <div className="card divide-y divide-black/5">
        {plans.map((p) => (
          <div key={p.id} className="px-5 py-4 flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{p.name}</span>
                <Badge variant="MUTED">{BILLING_LABEL[p.billing]}</Badge>
                {!p.active && <Badge variant="LOST">Inactive</Badge>}
              </div>
              {p.description && <div className="text-xs text-black/45 mt-0.5">{p.description}</div>}
            </div>
            <div className="text-sm font-semibold shrink-0">{formatPrice(p.price, p.billing, p.unitLabel)}</div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                className="btn-ghost"
                onClick={() => {
                  setError(null);
                  setEditing(p);
                }}
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button className="btn-ghost text-xs" onClick={() => handleToggle(p)}>
                {p.active ? "Deactivate" : "Activate"}
              </button>
              <button className="btn-danger" onClick={() => handleDelete(p)}>
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="px-5 py-8 text-center text-black/40 text-sm">
            No plans yet. Add at least one so sellers can quote this product.
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={plan ? "Edit plan" : "Add plan"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave(new FormData(e.currentTarget));
          }}
        >
          {error && <div className="error-box">{error}</div>}
          <input type="hidden" name="productId" value={productId} />
          {plan && <input type="hidden" name="planId" value={plan.id} />}
          <div>
            <label className="label">Plan name</label>
            <input
              name="name"
              required
              defaultValue={plan?.name}
              className="input"
              placeholder="Starter, Pro, Setup & onboarding…"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Price (EUR, excl. VAT)</label>
              <input
                name="price"
                type="number"
                step="0.01"
                min="0"
                required
                defaultValue={plan?.price}
                className="input"
              />
            </div>
            <div>
              <label className="label">Billing</label>
              <select name="billing" defaultValue={plan?.billing || "MONTHLY"} className="input">
                {BILLINGS.map((b) => (
                  <option key={b} value={b}>
                    {BILLING_LABEL[b]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Per (optional)</label>
              <input
                name="unitLabel"
                defaultValue={plan?.unitLabel || ""}
                className="input"
                placeholder="per building, per user, per bed"
              />
            </div>
            <div>
              <label className="label">Sort order</label>
              <input name="sortOrder" type="number" defaultValue={plan?.sortOrder ?? 0} className="input" />
            </div>
          </div>
          <div>
            <label className="label">What&apos;s included (optional)</label>
            <textarea
              name="description"
              defaultValue={plan?.description || ""}
              className="input min-h-[60px]"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Saving…" : "Save plan"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
