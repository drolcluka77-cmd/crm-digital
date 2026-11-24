"use client";

import { useState } from "react";
import { apply } from "./actions";
import type { PositionQuestion } from "@/lib/recruiting-labels";

export default function ApplyForm({
  position,
  experienceLabel,
  experienceHint,
  source,
  retentionMonths,
  companyName,
  questions = [],
  autoInvite = true,
}: {
  position: string;
  experienceLabel: string;
  experienceHint: string;
  source: string | null;
  retentionMonths: number;
  companyName: string;
  questions?: PositionQuestion[];
  autoInvite?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ invited: boolean } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    for (const q of questions) {
      if (q.required && q.type === "checks" && fd.getAll(`q_${q.key}`).length === 0) {
        setError(`Odgovorite na vprašanje: ${q.label}`);
        return;
      }
    }
    setBusy(true);
    setError(null);
    const res = await apply(fd);
    setBusy(false);
    if (res?.error) setError(res.error);
    else setDone({ invited: !!res?.invited });
  }

  if (done) {
    return (
      <div className="card p-8 text-center">
        <div className="text-3xl mb-2">✓</div>
        <h2 className="text-xl font-semibold">Hvala za prijavo!</h2>
        <p className="text-black/60 mt-2">
          {done.invited
            ? "Na vaš e-poštni naslov smo poslali povabilo z izbiro termina za uvodni pogovor. Če ga ne vidite, preverite tudi mapo z neželeno pošto."
            : "Vašo prijavo smo prejeli. Kmalu se vam oglasimo po e-pošti."}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-6 sm:p-7 space-y-4">
      <input type="hidden" name="source" value={source || ""} />
      <input type="hidden" name="position" value={position} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="label">Ime in priimek *</span>
          <input name="name" required className="input" autoComplete="name" />
        </label>
        <label className="block">
          <span className="label">Kraj bivanja</span>
          <input name="city" className="input" autoComplete="address-level2" />
        </label>
        <label className="block">
          <span className="label">E-pošta *</span>
          <input name="email" type="email" required className="input" autoComplete="email" />
        </label>
        <label className="block">
          <span className="label">Telefon *</span>
          <input name="phone" type="tel" required className="input" autoComplete="tel" />
        </label>
        <label className="block">
          <span className="label">Status</span>
          <select name="status" className="input" defaultValue="">
            <option value="">Izberite …</option>
            <option>Študent</option>
            <option>Dijak</option>
            <option>Drugo</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Koliko ur na teden lahko delate?</span>
          <select name="hours" className="input" defaultValue="">
            <option value="">Izberite …</option>
            <option>do 10 ur</option>
            <option>10–20 ur</option>
            <option>20–30 ur</option>
            <option>več kot 30 ur</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Od kdaj lahko začnete?</span>
          <input name="from" className="input" placeholder="npr. takoj, 1. 12." />
        </label>
        <label className="block">
          <span className="label">Kje želite delati?</span>
          <select name="workMode" className="input" defaultValue="">
            <option value="">Izberite …</option>
            <option>Od doma</option>
            <option>V Ljubljani</option>
            <option>Oboje</option>
          </select>
        </label>
      </div>

      <label className="block">
        <span className="label">Jeziki, ki jih govorite</span>
        <input name="languages" className="input" placeholder="npr. slovenščina, angleščina, nemščina" />
      </label>
      <label className="block">
        <span className="label">{experienceLabel}</span>
        <textarea name="experience" rows={3} className="input" placeholder={experienceHint} />
      </label>
      {questions.map((q) => (
        <div key={q.key} className="block">
          <span className="label">
            {q.label}
            {q.required ? " *" : ""}
          </span>
          {q.hint && <span className="block text-xs text-black/45 mb-1">{q.hint}</span>}
          {q.type === "checks" ? (
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5 mt-1">
              {(q.options || []).map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name={`q_${q.key}`} value={o} />
                  {o}
                </label>
              ))}
            </div>
          ) : q.type === "textarea" ? (
            <textarea name={`q_${q.key}`} rows={4} className="input" required={q.required} />
          ) : (
            <input name={`q_${q.key}`} className="input" required={q.required} />
          )}
        </div>
      ))}
      <label className="block">
        <span className="label">Zakaj vas zanima to delo?</span>
        <textarea name="motivation" rows={3} className="input" />
      </label>
      <label className="block">
        <span className="label">Življenjepis (neobvezno)</span>
        <input name="cv" type="file" accept=".pdf,.doc,.docx,.odt,.rtf,.jpg,.jpeg,.png" className="block w-full text-sm mt-1" />
        <span className="text-xs text-black/40">PDF, Word ali slika, največ 5 MB.</span>
      </label>

      <label className="flex items-start gap-2.5 text-sm text-black/70">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>
          Strinjam se, da {companyName} obdeluje moje podatke in življenjepis za namen izbire kandidatov. Podatke
          hranimo največ {retentionMonths} mesecev po zaključku izbire; izbris lahko kadar koli zahtevate z odgovorom na
          naše sporočilo. *
        </span>
      </label>

      {error && <div className="error-box">{error}</div>}
      <button className="btn-primary w-full justify-center py-3" disabled={busy}>
        {busy ? "Pošiljam …" : "Pošlji prijavo"}
      </button>
    </form>
  );
}
