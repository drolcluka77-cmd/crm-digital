"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepareWebmaster, submitWebmaster, verifyClientSite } from "@/lib/geo-actions";
import type { WebmasterState, EngineState } from "@/lib/webmaster";
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
  webmaster: WebmasterState | null;
  webmasterReady: { google: boolean; bing: boolean };
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

      <Block
        title="1. Koda za <head> (verifikacija + schema.org)"
        hint={props.webmaster ? "V <head> vseh strani. Vsebuje verifikacijski kodi za Google in Bing." : "V <head> vseh strani. Verifikacijski kodi za Google in Bing dodaš spodaj pri točki 5."}
        text={props.schema}
        file="head.html"
      />
      <Block title="2. llms.txt" hint="Datoteka v korenu strani: /llms.txt" text={props.llms} file="llms.txt" />
      <Block title="3. Vrstice za robots.txt" hint="Dodaj v obstoječi robots.txt." text={props.robots} file="robots-ai.txt" />
      <Block title="4. Noga strani (ime, naslov, telefon)" hint="Natančno tako kot v kartici." text={props.footer} />

<WebmasterCard clientId={props.clientId} website={props.website} state={props.webmaster} ready={props.webmasterReady} />

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

function engineLine(name: string, e: EngineState | undefined, ready: boolean) {
  if (!ready) return { cls: "text-black/40", text: `${name}: ni povezan (manjka ključ na strežniku)` };
  if (!e?.code) return { cls: "text-black/45", text: `${name}: koda še ni pripravljena` };
  if (e.verified && !e.at) return { cls: "text-emerald-700", text: `${name}: verificirano · sitemap še ni oddan` };
  if (e.verified) return { cls: "text-emerald-700", text: `${name}: verificirano${e.sitemap ? ` · sitemap oddan` : " · sitemap ni najden na strani"}` };
  if (e.error) return { cls: "text-rose-600", text: `${name}: ${e.error}` };
  return { cls: "text-amber-700", text: `${name}: koda pripravljena, čaka na stran` };
}

function WebmasterCard({
  clientId,
  website,
  state,
  ready,
}: {
  clientId: string;
  website: string;
  state: WebmasterState | null;
  ready: { google: boolean; bing: boolean };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "prep" | "submit">(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const run = async (kind: "prep" | "submit") => {
    setBusy(kind);
    setMsg(null);
    const r = kind === "prep" ? await prepareWebmaster(clientId) : await submitWebmaster(clientId);
    setBusy(null);
    setMsg(r || null);
    router.refresh();
  };
  const g = engineLine("Google Search Console", state?.google, ready.google);
  const b = engineLine("Bing Webmaster Tools", state?.bing, ready.bing);
  const at = [state?.google?.at, state?.bing?.at].filter(Boolean).sort().pop();
  return (
    <div className="card p-5">
      <div className="font-semibold">5. Google Search Console in Bing</div>
      <ol className="list-decimal pl-5 mt-2 space-y-1 text-sm text-black/70">
        <li>Klikni »Pripravi verifikacijo« — kodi se dodata v kodo za &lt;head&gt; (točka 1) in v e-mail za programerja.</li>
        <li>Ko je koda za &lt;head&gt; na strani, klikni »Preveri in oddaj sitemap«. CRM stran verificira, jo doda v Search Console in Bing ter odda sitemap.</li>
      </ol>
      {state?.siteUrl && <p className="text-xs text-black/45 mt-2">Naslov lastnosti: {state.siteUrl}</p>}
      <ul className="mt-3 space-y-1 text-sm">
        <li className={g.cls}>{g.text}</li>
        <li className={b.cls}>{b.text}</li>
        {at && <li className="text-xs text-black/40">Zadnji poskus: {new Date(at).toLocaleString("sl-SI")}</li>}
      </ul>
      <div className="flex flex-wrap gap-2 mt-4">
        <button className="btn-secondary py-1.5" disabled={!!busy || !website || (!ready.google && !ready.bing)} onClick={() => run("prep")}>
          {busy === "prep" ? "Pripravljam …" : state?.siteUrl ? "Pripravi znova" : "Pripravi verifikacijo"}
        </button>
        <button className="btn-primary py-1.5" disabled={!!busy || !state?.siteUrl} onClick={() => run("submit")}>
          {busy === "submit" ? "Preverjam …" : "Preveri in oddaj sitemap"}
        </button>
      </div>
      {msg?.error && <div className="error-box mt-3 text-sm">{msg.error}</div>}
      {msg?.success && <div className="success-box mt-3 text-sm">{msg.success}</div>}
    </div>
  );
}
