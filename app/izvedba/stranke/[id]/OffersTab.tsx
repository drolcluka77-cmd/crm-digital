"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteImportOffer, saveImportOffer, setImportOfferStatus } from "@/lib/geo-actions";
import { IMPORT_CURRENCIES, IMPORT_INCOTERMS, IMPORT_OFFER_STATUSES, IMPORT_OFFER_STATUS_LABEL } from "@/lib/geo-labels";

export type Offer = {
  id: string;
  supplier: string;
  location: string | null;
  contact: string | null;
  unitPrice: number | null;
  currency: string;
  moq: number | null;
  leadDays: number | null;
  incoterm: string | null;
  certificates: string | null;
  sampleCost: number | null;
  verified: boolean;
  status: string;
  note: string | null;
};

const STATUS_CLS: Record<string, string> = {
  CANDIDATE: "bg-black/5 text-black/60",
  SHORTLIST: "bg-sky-50 text-sky-700",
  SAMPLES: "bg-amber-50 text-amber-700",
  CHOSEN: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-rose-50 text-rose-600 line-through",
};

function OfferForm({ clientId, offer, onDone }: { clientId: string; offer?: Offer; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid sm:grid-cols-4 gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const r = await saveImportOffer(clientId, offer?.id ?? null, new FormData(e.currentTarget));
        setBusy(false);
        if (r?.error) return setError(r.error);
        router.refresh();
        onDone();
      }}
    >
      <label className="text-sm sm:col-span-2">
        <span className="label">Dobavitelj *</span>
        <input name="supplier" required defaultValue={offer?.supplier} className="input" placeholder="npr. Ningbo XY Co., Ltd." />
      </label>
      <label className="text-sm">
        <span className="label">Kraj / provinca</span>
        <input name="location" defaultValue={offer?.location || ""} className="input" placeholder="Zhejiang" />
      </label>
      <label className="text-sm">
        <span className="label">Kontakt</span>
        <input name="contact" defaultValue={offer?.contact || ""} className="input" placeholder="ime, e-pošta, WeChat, povezava" />
      </label>
      <label className="text-sm">
        <span className="label">Cena na kos</span>
        <div className="flex gap-1">
          <input name="unitPrice" inputMode="decimal" defaultValue={offer?.unitPrice ?? ""} className="input" />
          <select name="currency" defaultValue={offer?.currency || "USD"} className="input w-24">
            {IMPORT_CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </label>
      <label className="text-sm">
        <span className="label">MOQ (kosov)</span>
        <input name="moq" inputMode="numeric" defaultValue={offer?.moq ?? ""} className="input" />
      </label>
      <label className="text-sm">
        <span className="label">Proizvodnja (dni)</span>
        <input name="leadDays" inputMode="numeric" defaultValue={offer?.leadDays ?? ""} className="input" />
      </label>
      <label className="text-sm">
        <span className="label">Incoterm</span>
        <select name="incoterm" defaultValue={offer?.incoterm || ""} className="input">
          <option value="">—</option>
          {Object.keys(IMPORT_INCOTERMS).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="label">Certifikati</span>
        <input name="certificates" defaultValue={offer?.certificates || ""} className="input" placeholder="CE, LFGB, RoHS …" />
      </label>
      <label className="text-sm">
        <span className="label">Cena vzorca</span>
        <input name="sampleCost" inputMode="decimal" defaultValue={offer?.sampleCost ?? ""} className="input" />
      </label>
      <label className="text-sm flex items-end gap-2 pb-2">
        <input type="checkbox" name="verified" defaultChecked={offer?.verified} />
        Proizvajalec preverjen
      </label>
      <label className="text-sm sm:col-span-4">
        <span className="label">Opomba</span>
        <input name="note" defaultValue={offer?.note || ""} className="input" placeholder="kakovost, komunikacija, posebnosti" />
      </label>
      <div className="sm:col-span-4 flex items-center gap-2">
        <button className="btn-primary py-1.5" disabled={busy}>
          {busy ? "Shranjujem …" : offer ? "Shrani" : "Dodaj ponudbo"}
        </button>
        <button type="button" className="btn-secondary py-1.5" onClick={onDone}>
          Prekliči
        </button>
        {error && <span className="text-sm text-rose-600">{error}</span>}
      </div>
    </form>
  );
}

export default function OffersTab({ clientId, offers, quantity }: { clientId: string; offers: Offer[]; quantity: number | null }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const active = offers.filter((o) => o.status !== "REJECTED");
  const priced = active.filter((o) => o.unitPrice !== null);
  const cheapest = priced.length ? priced.reduce((a, b) => ((a.unitPrice as number) <= (b.unitPrice as number) ? a : b)) : null;
  const fmt = (v: number | null, cur?: string) => (v === null ? "—" : `${v.toLocaleString("sl-SI", { maximumFractionDigits: 2 })}${cur ? ` ${cur}` : ""}`);

  return (
    <div className="space-y-4">
      <div className="card p-4 text-sm text-black/60">
        Za vsako stranko primerjamo <b>najmanj 3 preverjene proizvajalce</b>. Ime dobavitelja stranki razkrijemo šele po plačilu provizije —
        v primerjavi ji pošlji ceno, MOQ, rok in certifikate.{" "}
        <span className={active.length >= 3 ? "text-emerald-700" : "text-amber-700"}>
          Aktivnih ponudb: {active.length}
          {active.length < 3 ? ` (manjkajo še ${3 - active.length})` : ""}.
        </span>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/40 border-b border-black/5">
              <th className="px-4 py-2">Dobavitelj</th>
              <th className="px-3 py-2">Cena / kos</th>
              <th className="px-3 py-2">{quantity ? `Skupaj (${quantity} kos)` : "MOQ"}</th>
              <th className="px-3 py-2">Rok</th>
              <th className="px-3 py-2">Certifikati</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) =>
              editing === o.id ? (
                <tr key={o.id} className="border-b border-black/5">
                  <td colSpan={7} className="px-4 py-4">
                    <OfferForm clientId={clientId} offer={o} onDone={() => setEditing(null)} />
                  </td>
                </tr>
              ) : (
                <tr key={o.id} className="border-b border-black/5 last:border-0 align-top">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">
                      {o.supplier} {o.verified && <span title="Preverjen" className="text-emerald-600">✓</span>}
                    </div>
                    <div className="text-xs text-black/45">{[o.location, o.contact].filter(Boolean).join(" · ")}</div>
                    {o.note && <div className="text-xs text-black/55 mt-0.5">{o.note}</div>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {fmt(o.unitPrice, o.currency)}
                    {cheapest?.id === o.id && priced.length > 1 && <div className="text-[11px] text-emerald-700">najnižja</div>}
                    {o.incoterm && <div className="text-[11px] text-black/40">{o.incoterm}</div>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {quantity && o.unitPrice !== null ? fmt(o.unitPrice * quantity, o.currency) : null}
                    <div className={quantity ? "text-[11px] text-black/40" : ""}>MOQ {o.moq ?? "—"}{quantity && o.moq && o.moq > quantity ? " ⚠ več od količine" : ""}</div>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{o.leadDays ? `${o.leadDays} dni` : "—"}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {o.certificates || "—"}
                    {o.sampleCost !== null && <div className="text-black/40">vzorec {fmt(o.sampleCost, o.currency)}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={o.status}
                      className={`rounded-md px-2 py-1 text-xs border-0 ${STATUS_CLS[o.status] || ""}`}
                      onChange={async (e) => {
                        await setImportOfferStatus(o.id, e.target.value);
                        router.refresh();
                      }}
                    >
                      {IMPORT_OFFER_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {IMPORT_OFFER_STATUS_LABEL[s]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-xs">
                    <button className="text-brand-600 underline mr-2" onClick={() => setEditing(o.id)}>
                      uredi
                    </button>
                    <button
                      className="text-rose-600 underline"
                      onClick={async () => {
                        if (!window.confirm(`Izbrišem ponudbo ${o.supplier}?`)) return;
                        await deleteImportOffer(o.id);
                        router.refresh();
                      }}
                    >
                      izbriši
                    </button>
                  </td>
                </tr>
              )
            )}
            {offers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-black/40">
                  Še ni ponudb.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card p-5">
        {adding ? (
          <OfferForm clientId={clientId} onDone={() => setAdding(false)} />
        ) : (
          <button className="btn-primary py-1.5" onClick={() => setAdding(true)}>
            + Dodaj ponudbo
          </button>
        )}
      </div>
    </div>
  );
}
