"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyClientSite } from "@/lib/geo-actions";
import { SITE_PLATFORM_LABEL } from "@/lib/geo-labels";

type Check = { key: string; label: string; ok: boolean; detail: string };

function Block({ title, hint, text, file }: { title: string; hint?: string; text: string; file?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="card">
      <div className="px-4 pt-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-semibold">{title}</div>
          {hint && <div className="text-xs text-black/45">{hint}</div>}
        </div>
        <div className="flex gap-2">
          <button
            className="btn-secondary py-1.5"
            onClick={() => {
              navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Kopirano" : "Kopiraj"}
          </button>
          {file && (
            <a
              className="btn-ghost py-1.5"
              download={file}
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(text)}`}
            >
              Prenesi {file}
            </a>
          )}
        </div>
      </div>
      <pre className="m-4 p-3 rounded-lg bg-ink-900 text-white/85 text-[12px] leading-relaxed overflow-x-auto max-h-80 whitespace-pre">{text}</pre>
    </div>
  );
}

export default function CodeTab(props: {
  clientId: string;
  ready: boolean;
  platform: string;
  steps: string[];
  schemaType: string;
  schema: string;
  llms: string;
  robots: string;
  footer: string;
  email: { subject: string; body: string };
  devContact: string | null;
  website: string;
  lastCheck: { at: string; url: string; ok: boolean; checks: Check[] } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const check = props.lastCheck;

  return (
    <div className="space-y-5">
      {!props.ready && (
        <div className="card p-4 border-amber-200 bg-amber-50/60 text-sm">
          Kartica še ni popolna — koda spodaj ima manjkajoče podatke. Najprej dopolni kartico.
        </div>
      )}

      <div className="card p-5">
        <div className="font-semibold">Kako vstaviti · {SITE_PLATFORM_LABEL[props.platform] || "platforma ni izbrana v kartici"}</div>
        {props.steps.length ? (
          <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm text-black/70">
            {props.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-black/50 mt-1">V kartici izberi, na čem je spletna stran.</p>
        )}
        <p className="text-xs text-black/45 mt-3">Tip podjetja v schemi: {props.schemaType}. Po vstavljanju klikni »Preveri stran«.</p>
      </div>

      {(props.platform === "CUSTOM_DEV" || props.platform === "CUSTOM_NODEV") && (
        <div className="card p-5">
          <div className="font-semibold">E-mail za programerja</div>
          <p className="text-sm text-black/55 mt-1">
            {props.platform === "CUSTOM_DEV" ? `Programer stranke: ${props.devContact || "kontakt je v Predaji (»Kdo ureja stran«)"}.` : "Pošlji našemu programerju."} V
            e-mailu je vsa koda in navodila.
          </p>
          <div className="text-sm mt-2">
            <b>Zadeva:</b> {props.email.subject}
          </div>
          <div className="flex gap-2 mt-3">
            <button
              className="btn-primary py-1.5"
              onClick={() => {
                navigator.clipboard.writeText(props.email.body);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "Kopirano" : "Kopiraj e-mail"}
            </button>
            <a className="btn-secondary py-1.5" href={`mailto:?subject=${encodeURIComponent(props.email.subject)}&body=${encodeURIComponent(props.email.body.slice(0, 1800))}`}>
              Odpri v e-pošti
            </a>
          </div>
          <p className="text-xs text-black/40 mt-2">»Odpri v e-pošti« ima zaradi omejitve dolžine lahko skrajšano kodo — raje uporabi »Kopiraj e-mail« in prilepi.</p>
        </div>
      )}

      <Block title="1. Strukturirani podatki (schema.org)" hint="V <head> vseh strani." text={props.schema} file="schema.html" />
      <Block title="2. llms.txt" hint="Datoteka v korenu strani: /llms.txt" text={props.llms} file="llms.txt" />
      <Block title="3. Vrstice za robots.txt" hint="Dodaj v obstoječi robots.txt." text={props.robots} file="robots-ai.txt" />
      <Block title="4. Noga strani (ime, naslov, telefon)" hint="Natančno tako kot v kartici." text={props.footer} />

      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold">Preverjanje strani</div>
            <div className="text-xs text-black/45">
              CRM odpre {props.website || "spletno stran"} in preveri schemo, llms.txt, robots.txt in telefon v nogi. Če je vse v redu, se
              naloga za spletno stran pošlje v potrditev.
            </div>
          </div>
          <button
            className="btn-primary"
            disabled={busy || !props.website}
            onClick={async () => {
              setBusy(true);
              setMsg(null);
              const r = await verifyClientSite(props.clientId);
              setBusy(false);
              setMsg(r || null);
              router.refresh();
            }}
          >
            {busy ? "Preverjam …" : "Preveri stran"}
          </button>
        </div>
        {msg?.error && <div className="error-box mt-3 text-sm">{msg.error}</div>}
        {msg?.success && <div className="success-box mt-3 text-sm">{msg.success}</div>}
        {check && (
          <ul className="mt-4 space-y-1.5 text-sm">
            {check.checks.map((c) => (
              <li key={c.key} className="flex gap-2">
                <span className={c.ok ? "text-emerald-600" : "text-rose-600"}>{c.ok ? "✓" : "✗"}</span>
                <span className="font-medium">{c.label}</span>
                <span className="text-black/50">— {c.detail}</span>
              </li>
            ))}
            <li className="text-xs text-black/40 pt-1">Zadnje preverjanje: {new Date(check.at).toLocaleString("sl-SI")}</li>
          </ul>
        )}
      </div>
    </div>
  );
}
