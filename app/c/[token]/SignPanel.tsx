"use client";

import { useState } from "react";
import { requestSigningCode, signContract } from "./actions";

export default function SignPanel({ token, email }: { token: string; email: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function sendCode() {
    setBusy("code");
    setError(null);
    const r = await requestSigningCode(token);
    setBusy(null);
    if (r?.error) setError(r.error);
    if (r?.sentTo) setSentTo(r.sentTo);
  }

  async function sign(fd: FormData) {
    setBusy("sign");
    setError(null);
    const r = await signContract(token, fd);
    if (r?.error) {
      setBusy(null);
      setError(r.error);
      return;
    }
    window.location.reload();
  }

  const masked = email.replace(/^(.{2})[^@]*(@.*)$/, "$1•••$2");

  return (
    <div className="card p-6">
      <div className="font-semibold text-lg">Elektronski podpis</div>
      <p className="text-sm text-black/55 mt-1">
        Za podpis vam na {sentTo || masked} pošljemo 6-mestno kodo. Ko jo vpišete, prejmete podpisano pogodbo in
        predračun po e-pošti.
      </p>
      <form
        className="space-y-4 mt-5"
        onSubmit={(e) => {
          e.preventDefault();
          sign(new FormData(e.currentTarget));
        }}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="label">Ime in priimek</span>
            <input name="name" className="input" required autoComplete="name" />
          </label>
          <label className="text-sm">
            <span className="label">Funkcija (npr. direktor)</span>
            <input name="title" className="input" autoComplete="organization-title" />
          </label>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="label">Koda iz e-pošte</span>
            <input name="code" className="input w-40 tracking-[0.3em] text-center" inputMode="numeric" maxLength={6} autoComplete="one-time-code" />
          </label>
          <button type="button" className="btn-secondary" disabled={!!busy} onClick={sendCode}>
            {busy === "code" ? "Pošiljam…" : sentTo ? "Pošlji novo kodo" : "Pošlji mi kodo"}
          </button>
        </div>
        {sentTo && <div className="text-xs text-emerald-700">Koda je poslana na {sentTo}. Velja 15 minut.</div>}
        <label className="text-sm flex items-start gap-2">
          <input type="checkbox" name="agree" className="mt-1" />
          <span>
            Pogodbo sem prebral(a), se z njo strinjam in jo podpisujem v imenu naročnika. Strinjam se, da je ta
            elektronski podpis veljaven in zavezujoč.
          </span>
        </label>
        {error && <div className="error-box">{error}</div>}
        <button className="btn-primary w-full sm:w-auto" disabled={!!busy}>
          {busy === "sign" ? "Podpisujem…" : "Podpiši pogodbo"}
        </button>
      </form>
    </div>
  );
}
