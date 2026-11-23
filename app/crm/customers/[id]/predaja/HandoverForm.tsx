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
  UNB_BOOKING_CHANNELS,
  UNB_GUEST_CHANNELS,
  UNB_PROPERTY_TYPES,
  type UnbDetails,
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
  details: UnbDetails;
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

export default function HandoverForm({ customerId, line, values, fromQuote }: { customerId: string; line: string; values: HandoverValues; fromQuote: boolean }) {
  const unb = line === "UNBUSYNESS";
  const d = values.details || {};
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);

  async function run(form: HTMLFormElement, submit: boolean) {
    setBusy(submit ? "submit" : "save");
    setMsg(null);
    const r = await saveHandover(customerId, new FormData(form), submit, line);
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
      {unb ? (
        <div className="card p-5 grid sm:grid-cols-2 gap-4">
          <L label="Ime podjetja" req>
            <input name="company" defaultValue={values.company} className="input" />
          </L>
          <L label="Datum začetka pilota" req>
            <input name="startDate" type="date" defaultValue={values.startDate} className="input" />
          </L>
          <L label="Vrsta nastanitve" req>
            <select name="propertyType" defaultValue={d.propertyType || ""} className="input">
              <option value="">Izberi …</option>
              {Object.entries(UNB_PROPERTY_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </L>
          <L label="Število enot (apartmajev, sob, stavb)" req>
            <input name="units" type="number" min={1} defaultValue={d.units ?? ""} className="input" />
          </L>
          <div className="sm:col-span-2">
            <L label="Lokacije">
              <input name="locations" defaultValue={d.locations || ""} className="input" placeholder="npr. Ljubljana center (4), Bled (2)" />
            </L>
          </div>
          <div className="text-sm">
            <span className="label">Kanali rezervacij *</span>
            <div className="flex flex-wrap gap-3 mt-1">
              {Object.entries(UNB_BOOKING_CHANNELS).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" name="bookingChannels" value={k} defaultChecked={(d.bookingChannels || []).includes(k)} />
                  {v}
                </label>
              ))}
            </div>
          </div>
          <div className="text-sm">
            <span className="label">Kje gostje pišejo *</span>
            <div className="flex flex-wrap gap-3 mt-1">
              {Object.entries(UNB_GUEST_CHANNELS).map(([k, v]) => (
                <label key={k} className="flex items-center gap-1.5">
                  <input type="checkbox" name="guestChannels" value={k} defaultChecked={(d.guestChannels || []).includes(k)} />
                  {v}
                </label>
              ))}
            </div>
          </div>
          <L label="Sistem za rezervacije / channel manager">
            <input name="pms" defaultValue={d.pms || ""} className="input" placeholder="npr. Smoobu, Hostaway, nič" />
          </L>
          <L label="Kdo zdaj odgovarja gostom">
            <input name="whoAnswers" defaultValue={d.whoAnswers || ""} className="input" placeholder="npr. lastnik sam, tudi ponoči" />
          </L>
          <div className="sm:col-span-2">
            <L label="Cilj pilota — kaj mora biti res po pilotu" req>
              <textarea
                name="pilotGoal"
                rows={2}
                defaultValue={d.pilotGoal || ""}
                className="input"
                placeholder="npr. 80 % vprašanj gostov odgovorjenih brez lastnika, odziv pod 5 minut"
              />
            </L>
          </div>
          <L label="Trajanje pilota po zagonu (dni)">
            <input name="pilotDays" type="number" min={7} defaultValue={d.pilotDays ?? 30} className="input" />
          </L>
          <L label="Dogovorjena cena po pilotu (€ / mesec)">
            <input name="priceAfterPilot" inputMode="decimal" defaultValue={d.priceAfterPilot ?? ""} className="input" placeholder="če je že dogovorjena" />
          </L>
        </div>
      ) : (
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
      )}

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
          {unb ? (
            <div />
          ) : (
            <L label="Vrednost ene stranke (€)" req>
              <input name="customerValue" inputMode="decimal" defaultValue={values.customerValue} className="input" placeholder="iz prvega klica" />
            </L>
          )}
          <div className="text-sm">
            <span className="label">{unb ? "Jeziki gostov" : "Jeziki strank"}</span>
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
          <textarea name="mainProblem" rows={2} defaultValue={values.mainProblem} className="input" placeholder={unb ? "npr. lastnik odgovarja gostom ponoči, zamujeni odgovori, slabe ocene zaradi komunikacije" : "npr. premalo strank, slabe ocene, zgrešeni klici"} />
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
