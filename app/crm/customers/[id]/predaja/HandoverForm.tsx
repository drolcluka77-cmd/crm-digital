"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveHandover } from "@/lib/geo-actions";
import {
  GEO_ADDONS,
  GEO_ADDON_LABEL,
  GEO_INDUSTRIES,
  GEO_INDUSTRY_LABEL,
  GEO_LANGUAGES,
  GEO_PACKAGES,
  GEO_PACKAGE_LABEL,
} from "@/lib/geo-labels";

export type HandoverValues = {
  company: string;
  industry: string;
  package: string;
  addons: string[];
  monthlyPrice: string;
  setupFee: string;
  startDate: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  webManager: string;
  customerValue: string;
  mainProblem: string;
  languages: string[];
  promised: string;
  specialNotes: string;
};

function L({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="label">
        {label}
        {req ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

export default function HandoverForm({ customerId, values, fromQuote }: { customerId: string; values: HandoverValues; fromQuote: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);

  async function run(form: HTMLFormElement, submit: boolean) {
    setBusy(submit ? "submit" : "save");
    setMsg(null);
    const r = await saveHandover(customerId, new FormData(form), submit);
    setBusy(null);
    setMsg(r || null);
    if (r && !r.error) {
      if (submit) router.push(`/crm/customers/${customerId}`);
      router.refresh();
    }
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(e.currentTarget, true);
      }}
    >
      {fromQuote && <div className="success-box text-sm">Paket, dodatki in cene so predizpolnjeni iz sprejete ponudbe — preveri jih.</div>}
      <div className="card p-5 grid sm:grid-cols-2 gap-4">
        <L label="Ime podjetja" req>
          <input name="company" defaultValue={values.company} className="input" />
        </L>
        <L label="Panoga" req>
          <select name="industry" defaultValue={values.industry} className="input">
            <option value="">Izberi …</option>
            {GEO_INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {GEO_INDUSTRY_LABEL[i]}
              </option>
            ))}
          </select>
        </L>
        <L label="Paket" req>
          <select name="package" defaultValue={values.package} className="input">
            <option value="">Izberi …</option>
            {GEO_PACKAGES.map((p) => (
              <option key={p} value={p}>
                {GEO_PACKAGE_LABEL[p]}
              </option>
            ))}
          </select>
        </L>
        <L label="Datum začetka" req>
          <input name="startDate" type="date" defaultValue={values.startDate} className="input" />
        </L>
        <L label="Mesečna cena (€)" req>
          <input name="monthlyPrice" inputMode="decimal" defaultValue={values.monthlyPrice} className="input" />
        </L>
        <L label="Enkratna namestitev (€)">
          <input name="setupFee" inputMode="decimal" defaultValue={values.setupFee} className="input" placeholder="490 pri Concierge / WhatsApp" />
        </L>
        <div className="sm:col-span-2 text-sm">
          <span className="label">Dodatki</span>
          <div className="flex flex-wrap gap-3 mt-1">
            {GEO_ADDONS.map((a) => (
              <label key={a} className="flex items-center gap-2">
                <input type="checkbox" name="addons" value={a} defaultChecked={values.addons.includes(a)} />
                {GEO_ADDON_LABEL[a]}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="card p-5 grid sm:grid-cols-3 gap-4">
        <L label="Kontaktna oseba" req>
          <input name="contactName" defaultValue={values.contactName} className="input" />
        </L>
        <L label="Telefon" req>
          <input name="contactPhone" defaultValue={values.contactPhone} className="input" />
        </L>
        <L label="E-pošta" req>
          <input name="contactEmail" type="email" defaultValue={values.contactEmail} className="input" />
        </L>
        <div className="sm:col-span-3">
          <L label="Kdo ureja spletno stran">
            <input name="webManager" defaultValue={values.webManager} className="input" placeholder="ime in kontakt programerja ali »sami«" />
          </L>
        </div>
      </div>

      <div className="card p-5 grid gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <L label="Vrednost ene stranke (€)" req>
            <input name="customerValue" inputMode="decimal" defaultValue={values.customerValue} className="input" placeholder="iz prvega klica" />
          </L>
          <div className="text-sm">
            <span className="label">Jeziki strank</span>
            <div className="flex flex-wrap gap-3 mt-2">
              {GEO_LANGUAGES.map((l) => (
                <label key={l} className="flex items-center gap-1.5">
                  <input type="checkbox" name="languages" value={l} defaultChecked={values.languages.includes(l)} />
                  {l}
                </label>
              ))}
            </div>
          </div>
        </div>
        <L label="Glavni problem" req>
          <textarea name="mainProblem" rows={2} defaultValue={values.mainProblem} className="input" placeholder="npr. premalo strank, slabe ocene, zgrešeni klici" />
        </L>
        <L label="Kaj si obljubil" req>
          <textarea name="promised" rows={2} defaultValue={values.promised} className="input" placeholder="tudi »nič posebnega«" />
        </L>
        <L label="Posebnosti">
          <textarea name="specialNotes" rows={2} defaultValue={values.specialNotes} className="input" placeholder="npr. »samo WhatsApp«, »ne kliči pred 10h«" />
        </L>
      </div>

      {msg?.error && <div className="error-box">{msg.error}</div>}
      {msg?.success && <div className="success-box">{msg.success}</div>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={!!busy}>
          {busy === "submit" ? "Oddajam …" : "Oddaj predajo"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!!busy}
          onClick={(e) => run((e.currentTarget as HTMLButtonElement).form!, false)}
        >
          {busy === "save" ? "Shranjujem …" : "Shrani osnutek"}
        </button>
      </div>
    </form>
  );
}
