// Monthly report draft for a Mr. Picked client, built from measurements and tasks. Client-safe (no server imports).

export type ReportMeasurement = {
  month: number;
  at: string;
  answers: number | null;
  mentions: number | null;
  score: number | null;
  mapRanks: { query: string; rank: number | null }[];
  wrongFacts: string[];
};
export type ReportTask = { title: string; status: string; doneAt: string | null; dueDate: string | null };

const day = (d: string) => new Date(d).toLocaleDateString("sl-SI");
const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v} %`);
const diff = (a: number | null | undefined, b: number | null | undefined, unit = " o. t.") => {
  if (a === null || a === undefined || b === null || b === undefined) return "";
  const d = Math.round((a - b) * 10) / 10;
  return d === 0 ? " (brez spremembe)" : ` (${d > 0 ? "+" : ""}${d}${unit})`;
};
const rankText = (r: number | null | undefined) => (r ? `${r}. mesto` : "ni v prvih 20");

/** Plain-text draft the assistant reviews, edits and sends (or pastes into the report template). */
export function buildMonthlyReport(opts: {
  company: string;
  current: ReportMeasurement;
  baseline?: ReportMeasurement;
  previous?: ReportMeasurement;
  tasks: ReportTask[];
  assistantName?: string | null;
}): string {
  const { company, current: cur, baseline: base, previous: prev, tasks } = opts;
  const from = prev ? new Date(prev.at) : base ? new Date(base.at) : new Date(new Date(cur.at).getTime() - 31 * 86400_000);
  const to = new Date(cur.at);
  const done = tasks.filter((t) => t.status === "DONE" && t.doneAt && new Date(t.doneAt) > from && new Date(t.doneAt) <= new Date(to.getTime() + 86400_000));
  const next = tasks
    .filter((t) => !["DONE", "NOT_POSSIBLE"].includes(t.status))
    .filter((t) => !t.dueDate || new Date(t.dueDate) <= new Date(to.getTime() + 35 * 86400_000))
    .slice(0, 8);
  const fixed = prev ? prev.wrongFacts.filter((f) => !cur.wrongFacts.includes(f)) : base ? base.wrongFacts.filter((f) => !cur.wrongFacts.includes(f)) : [];

  const L: string[] = [];
  L.push(`Mesečno poročilo — ${company}`);
  L.push(`Mesec ${cur.month} · meritev ${day(cur.at)}`);
  L.push("");
  L.push("1. Povzetek");
  const up = base && cur.score !== null && base.score !== null && cur.score > base.score;
  L.push(
    base
      ? `Ocena vidnosti v AI asistentih je ${pct(cur.score)}, na začetku sodelovanja je bila ${pct(base.score)}${diff(cur.score, base.score)}. ${
          up ? "Vidnost se izboljšuje." : "Vidnost še ni višja od izhodišča — v naslednjem mesecu se osredotočamo na spodnje naloge."
        }`
      : `Ocena vidnosti v AI asistentih je ${pct(cur.score)}.`
  );
  L.push("[Dopolni z 1–2 stavkoma: največja sprememba ta mesec.]");
  L.push("");
  L.push("2. Ključne številke");
  L.push(`• Ocena vidnosti: ${pct(cur.score)}${prev ? ` · prejšnji mesec ${pct(prev.score)}${diff(cur.score, prev.score)}` : ""}${base ? ` · izhodišče ${pct(base.score)}` : ""}`);
  if (cur.answers) L.push(`• AI odgovori z omembo podjetja: ${cur.mentions ?? 0} od ${cur.answers}`);
  if (cur.mapRanks.length) {
    L.push("• Google Zemljevidi:");
    for (const r of cur.mapRanks) {
      const b = base?.mapRanks.find((x) => x.query === r.query);
      L.push(`   – »${r.query}«: ${rankText(r.rank)}${b ? ` (na začetku ${rankText(b.rank)})` : ""}`);
    }
  }
  L.push("");
  L.push("3. Kaj smo naredili ta mesec");
  if (done.length) for (const t of done) L.push(`• ${t.title}`);
  else L.push("• [Dopolni — v CRM ni zaključenih nalog za to obdobje.]");
  L.push("");
  L.push("4. Napačni podatki o podjetju");
  if (fixed.length) {
    L.push("Popravljeno:");
    for (const f of fixed) L.push(`• ${f}`);
  }
  if (cur.wrongFacts.length) {
    L.push("Še v delu:");
    for (const f of cur.wrongFacts) L.push(`• ${f}`);
  }
  if (!fixed.length && !cur.wrongFacts.length) L.push("• Pri tej meritvi nismo našli napačnih podatkov.");
  L.push("");
  L.push("5. Načrt za naslednji mesec");
  if (next.length) for (const t of next) L.push(`• ${t.title}`);
  else L.push("• [Dopolni.]");
  L.push("");
  L.push("6. Kaj potrebujemo od vas");
  L.push("• [Npr. nove fotografije, potrditev objav, odgovor na vprašanje … — če nič, izbriši to točko.]");
  L.push("");
  L.push("Lep pozdrav,");
  L.push(`${opts.assistantName || "[ime]"}, Mr. Picked`);
  return L.join("\n");
}
