"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProduct } from "../actions";
import { ACCENT_COLORS } from "@/lib/constants";

type ProductDetails = {
  id: string;
  name: string;
  family: string | null;
  tagline: string | null;
  targetSegment: string | null;
  description: string | null;
  pitch: string | null;
  keyBenefits: string | null;
  idealCustomer: string | null;
  objections: string | null;
  websiteUrl: string | null;
  demoUrl: string | null;
  imageUrl: string | null;
  color: string | null;
  commissionRate: number;
  renewalCommissionRate: number;
  maxDiscount: number | null;
  sortOrder: number;
};

export default function ProductDetailsForm({
  product,
  families,
}: {
  product: ProductDetails;
  families: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [color, setColor] = useState(product.color || ACCENT_COLORS[0]);

  async function handleSubmit(fd: FormData) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const result = await updateProduct(fd);
    setBusy(false);
    if (result && result.error) {
      setError(result.error);
      return;
    }
    setSuccess("Saved.");
    router.refresh();
  }

  return (
    <form
      className="card p-6 space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(new FormData(e.currentTarget));
      }}
    >
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="color" value={color} />

      <div>
        <h2 className="font-semibold">Details</h2>
        <p className="text-sm text-black/45">What the product is and who it&apos;s for.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Name">
          <input name="name" required defaultValue={product.name} className="input" />
        </Field>
        <Field label="Product family" hint="Editions with the same family are grouped.">
          <input name="family" list="edit-families" defaultValue={product.family || ""} className="input" />
          <datalist id="edit-families">
            {families.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </Field>
        <Field label="Who it's for (target segment)">
          <input
            name="targetSegment"
            defaultValue={product.targetSegment || ""}
            className="input"
            placeholder="Hotels, hospitals, clinics…"
          />
        </Field>
        <Field label="Tagline">
          <input name="tagline" defaultValue={product.tagline || ""} className="input" />
        </Field>
      </div>

      <Field label="Description">
        <textarea
          name="description"
          defaultValue={product.description || ""}
          className="input min-h-[90px]"
          placeholder="What the product does, in plain words."
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Website">
          <input name="websiteUrl" defaultValue={product.websiteUrl || ""} className="input" placeholder="https://" />
        </Field>
        <Field label="Live demo / booking link" hint="Shown to sellers as a big “Open demo” button.">
          <input name="demoUrl" defaultValue={product.demoUrl || ""} className="input" placeholder="https://" />
        </Field>
      </div>

      <div className="pt-5 border-t border-black/5">
        <h2 className="font-semibold">Sales playbook</h2>
        <p className="text-sm text-black/45">
          What sellers see on the product page in their CRM. Keep it short and practical.
        </p>
      </div>

      <Field label="Elevator pitch (30 seconds)">
        <textarea
          name="pitch"
          defaultValue={product.pitch || ""}
          className="input min-h-[90px]"
          placeholder="The problem, who has it, and how this product fixes it."
        />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Key benefits" hint="One per line.">
          <textarea
            name="keyBenefits"
            defaultValue={product.keyBenefits || ""}
            className="input min-h-[140px]"
          />
        </Field>
        <Field label="Ideal customer & qualifying questions" hint="One per line.">
          <textarea
            name="idealCustomer"
            defaultValue={product.idealCustomer || ""}
            className="input min-h-[140px]"
          />
        </Field>
      </div>
      <Field
        label="Objection handling"
        hint="One per line, written as “Objection — answer”."
      >
        <textarea
          name="objections"
          defaultValue={product.objections || ""}
          className="input min-h-[110px]"
          placeholder="Too expensive — compare it with the hours your team spends on calls each week."
        />
      </Field>

      <div className="pt-5 border-t border-black/5">
        <h2 className="font-semibold">Commission, pricing rules & display</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Renewal commission (%)" hint="Of the yearly value, each time a subscription renews.">
          <input
            name="renewalCommissionRate"
            type="number"
            min={0}
            max={100}
            step="0.1"
            defaultValue={product.renewalCommissionRate}
            className="input"
          />
        </Field>
        <Field
          label="Max discount without approval (%)"
          hint="Off list price, incl. lowered unit prices. Empty = company default from Settings."
        >
          <input
            name="maxDiscount"
            type="number"
            min={0}
            max={100}
            step="0.5"
            defaultValue={product.maxDiscount ?? ""}
            className="input"
            placeholder="company default"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Seller commission (%)" hint="Of first-year net value of accepted quotes.">
          <input
            name="commissionRate"
            type="number"
            min={0}
            max={100}
            step="0.1"
            defaultValue={product.commissionRate}
            className="input"
          />
        </Field>
        <Field label="Sort order" hint="Lower numbers show first.">
          <input name="sortOrder" type="number" defaultValue={product.sortOrder} className="input" />
        </Field>
        <Field label="Accent colour">
          <div className="flex flex-wrap gap-2 pt-1">
            {ACCENT_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-ink-900" : "border-white"}`}
                style={{ background: c, boxShadow: "0 0 0 1px rgba(0,0,0,.08)" }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>
      </div>

      <Field label="Logo / image">
        <input
          name="image"
          type="file"
          accept="image/*"
          className="block w-full text-sm text-black/60 rounded-xl border border-black/10 bg-white px-3.5 py-2.5"
        />
        {product.imageUrl && (
          <label className="flex items-center gap-2 text-xs text-black/45 mt-1.5">
            <input type="checkbox" name="removeImage" /> Remove current image
          </label>
        )}
      </Field>

      {error && <div className="error-box">{error}</div>}
      {success && <div className="success-box">{success}</div>}
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save product"}
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && <p className="text-xs text-black/40 mt-1">{hint}</p>}
    </div>
  );
}
