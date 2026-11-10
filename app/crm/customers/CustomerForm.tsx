"use client";

import {
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  SEGMENT_SUGGESTIONS,
  SOURCE_SUGGESTIONS,
} from "@/lib/constants";
import { toDateInput } from "@/lib/format";

export type CustomerFormValues = {
  id: string;
  name: string;
  jobTitle: string | null;
  company: string | null;
  segment: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  country: string | null;
  size: string | null;
  source: string | null;
  note: string | null;
  status: string;
  estimatedValue: number | null;
  nextFollowUpAt: string | null;
  productIds: string[];
};

export default function CustomerForm({
  customer,
  products,
  busy,
  error,
  onSubmit,
  submitLabel,
  extraHidden,
}: {
  customer?: CustomerFormValues;
  products: { id: string; name: string }[];
  busy: boolean;
  error: string | null;
  onSubmit: (fd: FormData) => void;
  submitLabel: string;
  extraHidden?: Record<string, string>;
}) {
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      {error && <div className="error-box">{error}</div>}
      {customer && <input type="hidden" name="id" value={customer.id} />}
      {extraHidden &&
        Object.entries(extraHidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <fieldset className="space-y-4">
        <legend className="section-title mb-2">Company</legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Company / organisation</label>
            <input name="company" defaultValue={customer?.company || ""} className="input" placeholder="Hotel Lipa d.o.o." />
          </div>
          <div>
            <label className="label">Segment</label>
            <input
              name="segment"
              list="segments"
              defaultValue={customer?.segment || ""}
              className="input"
              placeholder="Hotel, hospital, building manager…"
            />
            <datalist id="segments">
              {SEGMENT_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Size</label>
            <input
              name="size"
              defaultValue={customer?.size || ""}
              className="input"
              placeholder="12 buildings / 300 beds"
            />
          </div>
          <div>
            <label className="label">City</label>
            <input name="city" defaultValue={customer?.city || ""} className="input" />
          </div>
          <div>
            <label className="label">Country</label>
            <input name="country" defaultValue={customer?.country || ""} className="input" placeholder="Slovenia" />
          </div>
        </div>
        <div>
          <label className="label">Website</label>
          <input name="website" defaultValue={customer?.website || ""} className="input" placeholder="example.com" />
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="section-title mb-2">Contact person</legend>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Name *</label>
            <input name="name" required defaultValue={customer?.name} className="input" />
          </div>
          <div>
            <label className="label">Job title / role</label>
            <input
              name="jobTitle"
              defaultValue={customer?.jobTitle || ""}
              className="input"
              placeholder="Facility manager, owner, CFO…"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" defaultValue={customer?.email || ""} className="input" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input name="phone" defaultValue={customer?.phone || ""} className="input" />
          </div>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="section-title mb-2">Opportunity</legend>
        {products.length > 0 && (
          <div>
            <label className="label">Interested in</label>
            <div className="flex flex-wrap gap-2">
              {products.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-sm cursor-pointer has-[:checked]:bg-brand-50 has-[:checked]:border-brand-300"
                >
                  <input
                    type="checkbox"
                    name="productIds"
                    value={p.id}
                    defaultChecked={customer?.productIds.includes(p.id)}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Stage</label>
            <select name="status" defaultValue={customer?.status || "NEW"} className="input">
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Lead source</label>
            <input
              name="source"
              list="sources"
              defaultValue={customer?.source || ""}
              className="input"
              placeholder="Cold call, referral…"
            />
            <datalist id="sources">
              {SOURCE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Estimated value (€ / first year)</label>
            <input
              name="estimatedValue"
              type="number"
              min="0"
              step="1"
              defaultValue={customer?.estimatedValue ?? ""}
              className="input"
            />
          </div>
          <div>
            <label className="label">Next follow-up</label>
            <input
              name="nextFollowUpAt"
              type="date"
              defaultValue={toDateInput(customer?.nextFollowUpAt)}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className="label">Note</label>
          <textarea
            name="note"
            defaultValue={customer?.note || ""}
            className="input min-h-[80px]"
            placeholder="Their pain points, current tools, decision makers, budget, timing…"
          />
        </div>
      </fieldset>

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
