"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { claimProspect, lookupContact, rejectProspect, skipProspect, setMyLeadProducts } from "./actions";

type Lookup = {
  summary?: string | null;
  fit?: { productName: string | null; score: number | null; reason: string | null } | null;
  google?: { mapsUrl: string | null; rating: number | null; reviews: number | null; category: string | null } | null;
  emailsFound?: string[];
  phonesFound?: string[];
  sources?: string[];
  notes?: string[];
};

type P = {
  id: string;
  name: string;
  legalForm: string | null;
  soleTrader: boolean;
  address: string;
  town: string | null;
  regNumber: string;
  productId: string | null;
  product: { name: string; color: string | null } | null;
  matchedKeyword: string | null;
  recommendedAt: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  activity: string | null;
  lookedUp: boolean;
  lookup: Lookup | null;
};

type Prod = { id: string; name: string; color: string | null; enabled: boolean; open: number; available: number };

export default function ProspectList({
  prospects,
  products,
  quota,
  expiryDays,
  lookupReady,
  attribution,
}: {
  prospects: P[];
  products: Prod[];
  quota: number;
  expiryDays: number;
  lookupReady: boolean;
  attribution: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<Record<string, { error?: string; success?: string }>>({});
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [tab, setTab] = useState<string>("ALL");
  const [choosing, setChoosing] = useState(false);
  const [chosen, setChosen] = useState<string[]>(products.filter((p) => p.enabled).map((p) => p.id));
  const [prefMsg, setPrefMsg] = useState<string | null>(null);
  const shown = tab === "ALL" ? prospects : prospects.filter((p) => p.productId === tab);
  const active = products.filter((p) => p.enabled);

  async function savePrefs() {
    setBusy("prefs");
    const res = await setMyLeadProducts(chosen);
    setBusy(null);
    if (res?.error) setPrefMsg(res.error);
    else {
      setPrefMsg(null);
      setChoosing(false);
      setTab("ALL");
    }
    router.refresh();
  }

  async function run(id: string, kind: string, fn: () => Promise<any>) {
    setBusy(id + kind);
    const res = await fn();
    setBusy(null);
    setMsg((m) => ({ ...m, [id]: res || {} }));
    if (res?.customerId) {
      router.push(`/crm/customers/${res.customerId}`);
      return;
    }
    router.refresh();
  }

  const google = (p: P) => `https://www.google.com/search?q=${encodeURIComponent([p.name, p.town].filter(Boolean).join(" "))}`;
  const maps = (p: P) => `https://www.google.com/maps/search/${encodeURIComponent([p.name, p.address].filter(Boolean).join(", "))}`;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Recommended leads</h1>
        <p className="text-black/50 text-sm mt-1">
          New companies from the Slovenian Business Register picked for your products — up to {quota} a day for each
          product. Find the contact, then claim the ones worth calling. Unclaimed leads go to another seller after{" "}
          {expiryDays} days.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setTab("ALL")} className={tab === "ALL" ? "chip-active" : "chip"}>
          All <span className="ml-1.5 opacity-60">{prospects.length}</span>
        </button>
        {active.map((p) => (
          <button key={p.id} onClick={() => setTab(p.id)} className={tab === p.id ? "chip-active" : "chip"}>
            {p.name} <span className="ml-1.5 opacity-60">{p.open}</span>
          </button>
        ))}
        <button className="text-sm text-brand-700 hover:underline ml-1" onClick={() => setChoosing((v) => !v)}>
          {choosing ? "Close" : "Choose products…"}
        </button>
      </div>

      {choosing && (
        <div className="card p-4 mb-5">
          <div className="text-sm font-medium mb-2">Which products do you want leads for?</div>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {products.map((p) => (
              <label key={p.id} className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={chosen.includes(p.id)}
                  onChange={(e) => setChosen((c) => (e.target.checked ? [...c, p.id] : c.filter((x) => x !== p.id)))}
                />
                {p.name}
                <span className="text-xs text-black/40">{p.available > 0 ? `${p.available} available` : "no leads yet"}</span>
              </label>
            ))}
          </div>
          {prefMsg && <div className="error-box mt-3">{prefMsg}</div>}
          <button className="btn-primary mt-3 py-1.5" disabled={busy === "prefs"} onClick={savePrefs}>
            {busy === "prefs" ? "Saving…" : "Save"}
          </button>
        </div>
      )}

      {shown.length === 0 && (
        <div className="card p-10 text-center text-sm text-black/40">
          {tab !== "ALL" && (products.find((p) => p.id === tab)?.available || 0) === 0
            ? "No leads for this product yet — your manager can add keywords for it in Lead finder."
            : "No recommended leads right now. New ones arrive every day."}
        </div>
      )}

      <div className="space-y-4">
        {shown.map((p) => {
          const m = msg[p.id];
          const l = p.lookup;
          return (
            <div key={p.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-[15px] leading-snug">{p.name}</div>
                  <div className="text-xs text-black/45 mt-0.5">
                    {[p.legalForm, p.address, `mat. št. ${p.regNumber}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {p.product && (
                  <span
                    className="text-xs font-medium rounded-full px-2.5 py-1 shrink-0"
                    style={{ background: (p.product.color || "#4f46e5") + "1a", color: p.product.color || "#4f46e5" }}
                    title={p.matchedKeyword ? `Matched “${p.matchedKeyword}” in the name` : undefined}
                  >
                    {p.product.name}
                  </span>
                )}
              </div>

              {p.soleTrader && (
                <div className="mt-3 text-xs rounded-lg bg-amber-50 text-amber-800 px-3 py-2">
                  Samostojni podjetnik (fizična oseba): pokličite ga, promocijske e-pošte pa ne pošiljajte brez soglasja.
                </div>
              )}

              {(p.lookedUp || p.phone || p.email || p.website) && (
                <div className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-black/40">Phone</div>
                    {p.phone ? <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="font-medium text-brand-700">{p.phone}</a> : <span className="text-black/35">—</span>}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-black/40">E-mail</div>
                    <div className="truncate">{p.email || <span className="text-black/35">—</span>}</div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-black/40">Website</div>
                    {p.website ? (
                      <a href={p.website} target="_blank" rel="noreferrer" className="truncate block text-brand-700 hover:underline">
                        {p.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                      </a>
                    ) : (
                      <span className="text-black/35">—</span>
                    )}
                  </div>
                </div>
              )}

              {l && (
                <div className="mt-3 text-sm space-y-1.5">
                  {p.activity && <div><span className="text-black/45">Dejavnost:</span> {p.activity}</div>}
                  {l.summary && <div className="text-black/70">{l.summary}</div>}
                  {l.fit?.productName && (
                    <div className="text-black/70">
                      <span className="text-black/45">Best fit:</span> {l.fit.productName}
                      {l.fit.score != null ? ` (${l.fit.score}/100)` : ""}
                      {l.fit.reason ? ` — ${l.fit.reason}` : ""}
                    </div>
                  )}
                  {l.google?.rating != null && (
                    <div className="text-black/55 text-xs">
                      Google: {l.google.rating}★ · {l.google.reviews ?? 0} reviews{l.google.category ? ` · ${l.google.category}` : ""}
                    </div>
                  )}
                  {(l.emailsFound?.length || 0) > 1 && (
                    <div className="text-xs text-black/55">Other e-mails on the site: {l.emailsFound!.filter((e) => e !== p.email).join(", ")}</div>
                  )}
                  {(l.sources?.length || 0) > 0 && (
                    <div className="text-xs text-black/45 flex flex-wrap gap-x-2">
                      Sources:
                      {l.sources!.map((s) => (
                        <a key={s} href={s} target="_blank" rel="noreferrer" className="underline truncate max-w-[220px]">
                          {s.replace(/^https?:\/\/(www\.)?/, "")}
                        </a>
                      ))}
                    </div>
                  )}
                  {(l.notes?.length || 0) > 0 && <div className="text-xs text-black/40">{l.notes!.join(" ")}</div>}
                </div>
              )}

              {m?.error && <div className="error-box mt-3">{m.error}</div>}
              {m?.success && <div className="success-box mt-3">{m.success}</div>}

              {rejecting === p.id ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input className="input flex-1 min-w-[200px]" placeholder="Why? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
                  <button className="btn-secondary py-1.5" onClick={() => run(p.id, "reject", () => rejectProspect(p.id, reason, false)).then(() => setRejecting(null))}>
                    Not a fit
                  </button>
                  <button className="btn-secondary py-1.5 text-rose-700" onClick={() => run(p.id, "reject", () => rejectProspect(p.id, reason, true)).then(() => setRejecting(null))}>
                    Do not contact
                  </button>
                  <button className="text-sm text-black/45 px-2" onClick={() => setRejecting(null)}>Cancel</button>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {lookupReady && (
                    <button className="btn-secondary py-1.5" disabled={!!busy} onClick={() => run(p.id, "lookup", () => lookupContact(p.id))}>
                      {busy === p.id + "lookup" ? "Searching…" : p.lookedUp ? "Search again" : "Find contact"}
                    </button>
                  )}
                  <a className="btn-secondary py-1.5" href={google(p)} target="_blank" rel="noreferrer">Google</a>
                  <a className="btn-secondary py-1.5" href={maps(p)} target="_blank" rel="noreferrer">Maps</a>
                  <button className="btn-primary py-1.5" disabled={!!busy} onClick={() => run(p.id, "claim", () => claimProspect(p.id))}>
                    {busy === p.id + "claim" ? "Claiming…" : "Claim"}
                  </button>
                  <span className="flex-1" />
                  <button className="text-sm text-black/45 hover:text-black/70 px-1" disabled={!!busy} onClick={() => run(p.id, "skip", () => skipProspect(p.id))}>
                    Not for me
                  </button>
                  <button className="text-sm text-black/45 hover:text-black/70 px-1" onClick={() => { setReason(""); setRejecting(p.id); }}>
                    Remove…
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-black/35 mt-6">
        {attribution}. Claimed leads appear under <Link href="/crm/customers?stage=NEW" className="underline">Customers</Link>.
      </p>
    </div>
  );
}
