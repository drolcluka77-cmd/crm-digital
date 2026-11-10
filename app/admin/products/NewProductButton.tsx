"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { PlusIcon } from "@/components/icons";
import { createProduct } from "./actions";

export default function NewProductButton({ families }: { families: string[] }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    const result = await createProduct(formData); // redirects to the editor on success
    setBusy(false);
    if (result && result.error) setError(result.error);
  }

  return (
    <>
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        Add product
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add product">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(new FormData(e.currentTarget));
          }}
        >
          {error && <div className="error-box">{error}</div>}
          <div>
            <label className="label">Product / edition name</label>
            <input
              name="name"
              required
              className="input"
              placeholder="e.g. Unbusyness for Building Managers"
            />
          </div>
          <div>
            <label className="label">Product family</label>
            <input name="family" list="families" className="input" placeholder="e.g. Unbusyness" />
            <datalist id="families">
              {families.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <p className="text-xs text-black/40 mt-1">
              Editions with the same family are grouped together for sellers.
            </p>
          </div>
          <div>
            <label className="label">Who it&apos;s for</label>
            <input
              name="targetSegment"
              className="input"
              placeholder="e.g. Hotels, hospitals, care homes"
            />
          </div>
          <div>
            <label className="label">Tagline</label>
            <input name="tagline" className="input" placeholder="One line that sells it" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Creating…" : "Create & open editor"}
          </button>
        </form>
      </Modal>
    </>
  );
}
