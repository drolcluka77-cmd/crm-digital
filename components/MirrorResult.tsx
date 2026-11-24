import type { MirrorAnswer, MirrorSummary } from "@/lib/ai-mirror";

export type MirrorRunView = {
  id: string;
  kind: string;
  status: string;
  company: string;
  city: string;
  category: string;
  score: number | null;
  mentions: number | null;
  answersCount: number | null;
  costEur: number;
  error: string | null;
  createdAt: string;
  userName: string | null;
  answers: MirrorAnswer[];
  summary: MirrorSummary;
};

const ENGINE: Record<string, string> = { chatgpt: "ChatGPT", gemini: "Gemini" };
const BRAND: Record<string, { t: string; cls: string }> = {
  known: { t: "pozna podjetje", cls: "text-emerald-700" },
  unknown: { t: "podjetja ne pozna", cls: "text-rose-600" },
  wrong: { t: "navaja napačne podatke", cls: "text-amber-700" },
};

export default function MirrorResult({ run }: { run: MirrorRunView }) {
  if (run.status === "FAILED")
    return <div className="card p-5 text-sm text-rose-700">Analiza ni uspela: {run.error || "neznana napaka"}</div>;
  if (run.status !== "DONE") return <div className="card p-5 text-sm text-black/60">Analiza še teče … osvežite stran čez nekaj sekund.</div>;

  const s = run.summary || ({} as MirrorSummary);
  const disc = run.answers.filter((a) => a.kind === "discovery" && !a.error);
  const engines = Array.from(new Set(run.answers.map((a) => a.engine)));
  const perEngine = engines.map((e) => {
    const d = disc.filter((a) => a.engine === e);
    const hits = d.filter((a) => a.mentioned);
    const best = hits.map((a) => a.position).filter((p): p is number => !!p).sort((a, b) => a - b)[0] ?? null;
    return { e, n: d.length, hits: hits.length, best };
  });
  const score = run.score ?? 0;
  const tone = score >= 50 ? "text-emerald-700" : score >= 20 ? "text-amber-700" : "text-rose-600";

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-black/40">{run.kind === "FULL" ? "Celovita analiza" : "Hiter pregled"} · {run.company}, {run.city}</div>
            <div className={`text-4xl font-semibold mt-1 ${tone}`}>{run.score ?? 0} %</div>
            <div className="text-sm text-black/60">
              AI vidnost: omenjeni v {run.mentions ?? 0} od {run.answersCount ?? 0} odgovorov na »{run.category}«
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            {perEngine.map((p) => (
              <div key={p.e}>
                <div className="font-medium">{ENGINE[p.e]}</div>
                <div className="text-black/60">
                  {p.hits}/{p.n} odgovorov{p.best ? ` · najvišje ${p.best}. mesto` : ""}
                </div>
                {s.brand?.[p.e] && <div className={`text-xs ${BRAND[s.brand[p.e]!].cls}`}>{BRAND[s.brand[p.e]!].t}</div>}
              </div>
            ))}
          </div>
        </div>
        {s.summary && <p className="mt-4 text-sm leading-relaxed">{s.summary}</p>}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="font-semibold mb-2">Kdo je omenjen namesto njih</div>
          {s.competitors?.length ? (
            <ol className="text-sm space-y-1 list-decimal list-inside">
              {s.competitors.map((c) => (
                <li key={c.name}>
                  {c.name} <span className="text-black/40">· {c.mentions}×</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-black/45">Ni podatka.</p>
          )}
        </div>
        <div className="card p-5">
          <div className="font-semibold mb-2">{run.kind === "FULL" ? "Točke za sestanek" : "Napačni podatki"}</div>
          {run.kind === "FULL" && s.talkingPoints?.length ? (
            <ul className="text-sm space-y-1.5 list-disc list-inside">
              {s.talkingPoints.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          ) : null}
          {(run.kind === "FULL" ? s.wrongFacts?.length : true) && (
            <div className={run.kind === "FULL" ? "mt-3" : ""}>
              {run.kind === "FULL" && <div className="text-xs uppercase tracking-wide text-black/40 mb-1">Napačni podatki</div>}
              {s.wrongFacts?.length ? (
                <ul className="text-sm space-y-1 list-disc list-inside text-amber-800">
                  {s.wrongFacts.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-black/45">Nismo opazili napačnih podatkov.</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card divide-y divide-black/5">
        <div className="px-5 py-3 font-semibold">Odgovori ({run.answers.length})</div>
        {run.answers.map((a, i) => (
          <details key={i} className="px-5 py-3 group">
            <summary className="cursor-pointer list-none flex items-start gap-3 text-sm">
              <span className={`mt-0.5 shrink-0 text-xs rounded px-1.5 py-0.5 ${a.error ? "bg-black/5 text-black/40" : a.mentioned ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
                {a.error ? "napaka" : a.mentioned ? (a.position ? `${a.position}. mesto` : "omenjeni") : "ni omembe"}
              </span>
              <span className="shrink-0 w-16 text-black/50">{ENGINE[a.engine]}</span>
              <span className="flex-1">{a.q}</span>
            </summary>
            <div className="mt-2 ml-0 sm:ml-[6.5rem] text-sm whitespace-pre-line text-black/75">{a.error || a.text}</div>
            {a.sources.length > 0 && (
              <div className="mt-2 sm:ml-[6.5rem] text-xs text-black/45 space-y-0.5">
                {a.sources.slice(0, 5).map((src) => (
                  <div key={src.url} className="truncate">
                    ↗ <a href={src.url} target="_blank" rel="noreferrer" className="underline">{src.title || src.url}</a>
                  </div>
                ))}
              </div>
            )}
          </details>
        ))}
      </div>
      <p className="text-xs text-black/40">
        {new Date(run.createdAt).toLocaleString("sl-SI")} · {run.userName || ""} · strošek ≈ {run.costEur.toLocaleString("sl-SI", { maximumFractionDigits: 3 })} €. AI odgovori se
        od iskanja do iskanja nekoliko razlikujejo; za primerjavo skozi čas uporabljamo ista vprašanja.
      </p>
    </div>
  );
}

export function toRunView(r: any): MirrorRunView {
  return {
    id: r.id,
    kind: r.kind,
    status: r.status,
    company: r.company,
    city: r.city,
    category: r.category,
    score: r.score,
    mentions: r.mentions,
    answersCount: r.answersCount,
    costEur: r.costEur,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    userName: r.userName,
    answers: Array.isArray(r.answers) ? r.answers : [],
    summary: r.summary && typeof r.summary === "object" ? r.summary : {},
  };
}
