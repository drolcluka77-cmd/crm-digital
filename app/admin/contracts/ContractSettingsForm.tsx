"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveContractSettings } from "@/lib/contract-actions";

type S = {
  legalName: string;
  legalAddress: string | null;
  legalRegNo: string | null;
  legalTaxNo: string | null;
  legalVatId: string | null;
  legalVatPayer: boolean;
  legalIban: string | null;
  legalBic: string | null;
  legalBank: string | null;
  legalRepresentative: string | null;
  legalEmail: string | null;
  contractReviewRequired: boolean;
  proformaDueDays: number;
  contractTemplate: string | null;
};

const PLACEHOLDERS =
  "{{stevilka}} {{datum}} {{ponudba}} {{izvajalec_naziv}} {{izvajalec_naslov}} {{izvajalec_maticna}} {{izvajalec_davcna}} {{izvajalec_zastopnik}} {{narocnik_naziv}} {{narocnik_naslov}} {{narocnik_maticna}} {{narocnik_ddv}} {{narocnik_zastopnik}} {{storitve}} {{cene}} {{ddv_klavzula}} {{rok_placila}} {{opombe}}";

export default function ContractSettingsForm({ s, defaultTemplate }: { s: S; defaultTemplate: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [vatPayer, setVatPayer] = useState(s.legalVatPayer);
  const [useDefault, setUseDefault] = useState(!s.contractTemplate);

  const f = (label: string, name: keyof S, placeholder?: string) => (
    <label className="text-sm">
      <span className="label">{label}</span>
      <input name={name} defaultValue={(s[name] as string) || ""} placeholder={placeholder} className="input" />
    </label>
  );

  return (
    <form
      className="card p-5 mt-8 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await saveContractSettings(new FormData(e.currentTarget));
        setBusy(false);
        setMsg(r || null);
        router.refresh();
      }}
    >
      <div>
        <h2 className="font-semibold">Contract settings</h2>
        <p className="text-sm text-black/50">The company that signs the contracts and issues proforma invoices.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {f("Company name", "legalName")}
        {f("Address (street, post code and town)", "legalAddress", "Zaloška cesta 161, 1000 Ljubljana")}
        {f("Registration no. (matična)", "legalRegNo")}
        {f("Tax no. (davčna)", "legalTaxNo")}
        {f("Signs for the company", "legalRepresentative", "Luka Drolc, direktor")}
        {f("E-mail on documents", "legalEmail")}
        {f("IBAN", "legalIban", "SI56 …")}
        {f("BIC", "legalBic")}
        {f("Bank", "legalBank")}
        <label className="text-sm">
          <span className="label">Proforma due in (days)</span>
          <input name="proformaDueDays" type="number" min={1} max={60} defaultValue={s.proformaDueDays} className="input" />
        </label>
      </div>
      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" name="legalVatPayer" checked={vatPayer} onChange={(e) => setVatPayer(e.target.checked)} />
        The company is a VAT payer (zavezanec za DDV)
      </label>
      {vatPayer ? (
        f("VAT ID (ID za DDV)", "legalVatId", "SI12345678")
      ) : (
        <p className="text-xs text-black/45 -mt-2">
          Not a VAT payer: contracts and proformas show prices without VAT and the note “DDV ni obračunan na podlagi
          1. odstavka 94. člena ZDDV-1”.
        </p>
      )}
      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" name="contractReviewRequired" defaultChecked={s.contractReviewRequired} />
        A manager or admin approves every contract before the seller can send it
      </label>

      <div>
        <label className="text-sm flex items-center gap-2 mb-2">
          <input type="checkbox" name="useDefaultTemplate" checked={useDefault} onChange={(e) => setUseDefault(e.target.checked)} />
          Use the built-in contract template
        </label>
        <textarea
          name="contractTemplate"
          rows={18}
          readOnly={useDefault}
          defaultValue={s.contractTemplate || defaultTemplate}
          className={`input font-mono text-[12px] ${useDefault ? "opacity-60" : ""}`}
        />
        <p className="text-xs text-black/40 mt-1">Placeholders: {PLACEHOLDERS}</p>
      </div>
      {msg?.error && <div className="error-box">{msg.error}</div>}
      {msg?.success && <div className="success-box">{msg.success}</div>}
      <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
    </form>
  );
}
