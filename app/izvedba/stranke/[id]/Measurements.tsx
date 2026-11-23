"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirmDay90, saveMeasurement } from "@/lib/geo-actions";

type M = {
  id: string;
  month: number;
  at: string;
  answers: number | null;
  mentions: number | null;
  score: number | null;
  mapRanks: { query: string; rank: number | null }[];
  wrongFacts: string[];
  reportUrl: string | null;
  note: string | null;
};

export default function Measurements({
  clientId,
  rows,
  nextMonth,
  isAdmin,
  status,
  day90Done,
}: {
  clientId: string;
  rows: M[];
  nextMonth: number;
  isAdmin: boolean;
  status: string;
  day90Done: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const base = rows.find((r) => r.month === 0);
  const m3 = rows.filter((r) => r.month === 3).pop() || rows.filter((r) => r.month > 0).pop();
  const avg = (r?: M) => {
    const ranks = (r?.mapRanks || []).map((x) => x.rank).filter((x): x is number => !!x);
    return ranks.length ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10 : null;
  };
  const better = base && m3 && (m3.score ?? 0) > (base.score ?? 0);

  return (
    <div className="space-y-5">
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/40 border-b border-black/5">
              <th className="px-4 py-2">Mesec</th>
              <th className="px-3 py-2">Datum</th>
              <th className="px-3 py-2">Ocena vidnosti</th>
              <th className="px-3 py-2">Omembe / odgovori</th>
              <th className="px-3 py-2">Povpr. mesto na Zemljevidih</th>
              <th className="px-3 py-2">Napačni podatki</th>
              <th className="px-3 py-2">Poročilo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-black/5 last:border-0 align-top">
                <td className="px-4 py-2.5 font-medium">{r.month === 0 ? "0 (izhodišče)" : r.month}</td>
                <td className="px-3 py-2.5">{new Date(r.at).toLocaleDateString("sl-SI")}</td>
                <td className="px-3 py-2.5">{r.score !== null ? `${r.score} %` : "—"}</td>
                <td className="px-3 py-2.5">{r.answers ? `${r.mentions ?? 0} / ${r.answers}` : "—"}</td>
                <td className="px-3 py-2.5">{avg(r) ?? "—"}</td>
                <td className="px-3 py-2.5 text-xs">{r.wrongFacts.length ? r.wrongFacts.join("; ") : "—"}</td>
                <td className="px-3 py-2.5">
                  {r.reportUrl ? (
                    <a href={r.reportUrl} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                      odpri
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-black/40">
                  Še ni meritev. Najprej vnesi izhodišče (mesec 0).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {status === "DAY90" && !day90Done && (
        <div className="card p-5 border-amber-200">
          <div className="font-semibold mb-1">Dan 90: primerjava z izhodiščem</div>
          <p className="text-sm text-black/60">
            Izhodišče: {base?.score ?? "—"} % (povpr. mesto {avg(base) ?? "—"}) · zadnja meritev: {m3?.score ?? "—"} % (povpr. mesto{" "}
            {avg(m3) ?? "—"}). {base && m3 ? (better ? "Ocena vidnosti je višja — obljuba izpolnjena." : "Ocena vidnosti ni višja — po obljubi je 4. mesec brezplačen.") : "Manjka meritev."}
          </p>
          {isAdmin ? (
            <div className="flex flex-wrap gap-2 mt-3">
              <button className="btn-primary py-1.5" disabled={busy} onClick={async () => { setBusy(true); setMsg((await confirmDay90(clientId, false)) || null); setBusy(false); router.refresh(); }}>
                Potrdi — obljuba izpolnjena
              </button>
              <button className="btn-secondary py-1.5" disabled={busy} onClick={async () => { setBusy(true); setMsg((await confirmDay90(clientId, true)) || null); setBusy(false); router.refresh(); }}>
                Potrdi — 4. mesec brezplačen
              </button>
            </div>
          ) : (
            <p className="text-xs text-black/45 mt-2">Potrdi administrator.</p>
          )}
        </div>
      )}

      <form
        className="card p-5 grid sm:grid-cols-4 gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          const form = e.currentTarget;
          const r = await saveMeasurement(clientId, new FormData(form));
          setBusy(false);
          setMsg(r || null);
          if (r && !r.error) {
            form.reset();
            router.refresh();
          }
        }}
      >
        <div className="sm:col-span-4 font-semibold">Nova meritev</div>
        <label className="text-sm">
          <span className="label">Mesec (0 = izhodišče)</span>
          <input name="month" type="number" min={0} defaultValue={nextMonth} className="input" />
        </label>
        <label className="text-sm">
          <span className="label">Vseh AI odgovorov</span>
          <input name="answers" type="number" min={0} className="input" placeholder="npr. 180" />
        </label>
        <label className="text-sm">
          <span className="label">Odgovorov z omembo</span>
          <input name="mentions" type="number" min={0} className="input" placeholder="npr. 27" />
        </label>
        <label className="text-sm">
          <span className="label">Ocena vidnosti % (izračuna se sama)</span>
          <input name="score" inputMode="decimal" className="input" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="label">Mesta na Zemljevidih — »iskanje | mesto« v vsaki vrstici</span>
          <textarea name="mapRanks" rows={6} className="input font-mono text-[13px]" placeholder={"avtovleka kamnik | 2\nvlečna služba ljubljana | 7"} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="label">Napačni podatki (eden na vrstico — vsak ustvari nalogo)</span>
          <textarea name="wrongFacts" rows={6} className="input" placeholder={"ChatGPT navaja star telefon\nBing: napačen delovni čas ob sobotah"} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="label">Poročilo (povezava)</span>
          <input name="reportUrl" className="input" placeholder="https://…" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="label">Opomba</span>
          <input name="note" className="input" />
        </label>
        <div className="sm:col-span-4 flex items-center gap-3">
          <button className="btn-primary" disabled={busy}>
            {busy ? "Shranjujem …" : "Shrani meritev"}
          </button>
          {msg?.error && <span className="text-sm text-rose-600">{msg.error}</span>}
          {msg?.success && <span className="text-sm text-emerald-700">{msg.success}</span>}
        </div>
      </form>
    </div>
  );
}
