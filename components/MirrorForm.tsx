"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startMirror } from "@/lib/mirror-actions";

export type MirrorPrefill = {
  company?: string | null;
  city?: string | null;
  category?: string | null;
  website?: string | null;
  phone?: string | null;
  customerId?: string | null;
  geoClientId?: string | null;
};

const CATEGORIES = ["gostilna", "restavracija", "picerija", "kavarna", "hotel", "apartmaji", "avtoservis", "vulkanizerstvo", "avtovleka", "zobozdravnik", "frizerski salon", "kozmetični salon", "fizioterapija", "vodoinštalater", "električar", "krovec", "turistični izleti"];

export default function MirrorForm({
  prefill = {},
  basePath,
  budget,
  compact = false,
}: {
  prefill?: MirrorPrefill;
  basePath: string; // where results live, e.g. "/crm/mirror"
  budget: { quickLeft: number; fullLeft: number; monthEur: number; limitEur: number; engines: string[] };
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "QUICK" | "FULL">(null);
  const [error, setError] = useState<string | null>(null);
  const [showQueries, setShowQueries] = useState(false);
  const delivery = !!prefill.geoClientId;

  async function go(kind: "QUICK" | "FULL", form: HTMLFormElement) {
    if (!form.reportValidity()) return;
    setBusy(kind);
    setError(null);
    const fd = new FormData(form);
    fd.set("kind", kind);
    const r = await startMirror(fd);
    setBusy(null);
    if (r.error) return setError(r.error);
    router.push(`${basePath}/${r.id}`);
  }

  if (!budget.engines.length)
    return <div className="card p-5 text-sm text-black/60">AI Mirror še ni nastavljen (manjkata ključa OPENAI_API_KEY in GEMINI_API_KEY).</div>;

  return (
    <form className="card p-5 space-y-4" onSubmit={(e) => e.preventDefault()}>
      <input type="hidden" name="customerId" value={prefill.customerId || ""} />
      <input type="hidden" name="geoClientId" value={prefill.geoClientId || ""} />
      <div className={`grid gap-3 ${compact ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        <label className="text-sm">
          <span className="label">Podjetje *</span>
          <input name="company" required defaultValue={prefill.company || ""} className="input" placeholder="npr. Gostilna Pri Mihu" />
        </label>
        <label className="text-sm">
          <span className="label">Kraj *</span>
          <input name="city" required defaultValue={prefill.city || ""} className="input" placeholder="npr. Kamnik" />
        </label>
        <label className="text-sm">
          <span className="label">Kaj ljudje iščejo *</span>
          <input name="category" required list="mirror-cats" defaultValue={prefill.category || ""} className="input" placeholder="npr. gostilna" />
          <datalist id="mirror-cats">
            {CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        {!compact && (
          <>
            <label className="text-sm">
              <span className="label">Spletna stran</span>
              <input name="website" defaultValue={prefill.website || ""} className="input" placeholder="www.…" />
            </label>
            <label className="text-sm">
              <span className="label">Telefon</span>
              <input name="phone" defaultValue={prefill.phone || ""} className="input" />
            </label>
            <label className="text-sm">
              <span className="label">Naslov</span>
              <input name="address" className="input" placeholder="za preverjanje napačnih podatkov" />
            </label>
          </>
        )}
      </div>
      {!compact && (
        <div>
          <button type="button" className="text-xs text-brand-600 underline" onClick={() => setShowQueries((v) => !v)}>
            {showQueries ? "Skrij" : "Dodaj"} lastna vprašanja (samo celovita analiza)
          </button>
          {showQueries && (
            <textarea
              name="queries"
              rows={3}
              className="input mt-2"
              placeholder={delivery ? "Prazno = vprašanja iz kartice stranke (AI vprašanja in ključna iskanja)" : "Eno vprašanje na vrstico, največ 4, npr.: Kje v Kamniku jem dobro domačo hrano ob nedeljah?"}
            />
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!delivery && (
          <button type="button" className="btn-primary" disabled={!!busy || budget.quickLeft <= 0} onClick={(e) => go("QUICK", e.currentTarget.form!)}>
            {busy === "QUICK" ? "Sprašujem ChatGPT in Gemini … (≈ 30 s)" : "⚡ Hiter pregled"}
          </button>
        )}
        <button type="button" className={delivery ? "btn-primary" : "btn-secondary"} disabled={!!busy || budget.fullLeft <= 0} onClick={(e) => go("FULL", e.currentTarget.form!)}>
          {busy === "FULL" ? "Analiziram … (≈ 1 min)" : delivery ? "Izmeri z AI Mirror" : "Celovita analiza"}
        </button>
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>
      <p className="text-xs text-black/45">
        {delivery ? "" : `Hiter pregled: 3 vprašanja, med klicem (še ${budget.quickLeft} danes). `}
        Celovita analiza: do 10 vprašanj, konkurenti, napačni podatki{delivery ? "" : " in točke za sestanek"} (še {budget.fullLeft} danes).
        {" "}Uporablja {budget.engines.join(" + ")} s spletnim iskanjem. Ta mesec porabljeno {budget.monthEur.toLocaleString("sl-SI")} € od {budget.limitEur} €.
      </p>
    </form>
  );
}
