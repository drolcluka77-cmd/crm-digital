import { prisma } from "@/lib/prisma";

/**
 * AI Mirror — what ChatGPT and Gemini tell customers about a local business.
 *
 *   QUICK — during a call: 3 questions × 2 engines (≈ 20–40 s, ≈ 0,03–0,06 €).
 *   FULL  — before a meeting or as a Mr. Picked measurement: up to 10 questions × 2 engines,
 *           plus a fact check and talking points (≈ 1 min, ≈ 0,15–0,30 €).
 *
 * Both engines answer with live web search (ChatGPT web search, Gemini grounding with Google Search),
 * because that is what people see today. A cheap model without search then reads the answers and lists
 * competitors, wrong facts and a summary.
 *
 * Variables: OPENAI_API_KEY, GEMINI_API_KEY (either alone works). Optional: AI_MIRROR_OPENAI_MODEL
 * (default gpt-4.1-mini), AI_MIRROR_GEMINI_MODEL (default gemini-2.5-flash), AI_MIRROR_MONTHLY_LIMIT_EUR
 * (default 25), AI_MIRROR_DAILY_QUICK (default 30 per person), AI_MIRROR_DAILY_FULL (default 6 per person).
 */

export type MirrorKind = "QUICK" | "FULL";
export type MirrorEngine = "chatgpt" | "gemini";
export type MirrorQueryKind = "discovery" | "brand" | "facts";
export type MirrorQuery = { q: string; kind: MirrorQueryKind };

export type MirrorAnswer = {
  engine: MirrorEngine;
  q: string;
  kind: MirrorQueryKind;
  text: string;
  sources: { url: string; title?: string }[];
  mentioned: boolean;
  position: number | null; // place in the answer's list, when the answer is a list
  siteCited: boolean;
  error?: string;
};

export type MirrorSummary = {
  competitors: { name: string; mentions: number }[];
  brand: Partial<Record<MirrorEngine, "known" | "unknown" | "wrong">>;
  wrongFacts: string[];
  summary: string;
  talkingPoints: string[];
};

export type MirrorInput = {
  kind: MirrorKind;
  company: string;
  city: string;
  category: string; // what people search for, e.g. "picerija", "avtoservis"
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  extraQueries?: string[];
  customerId?: string | null;
  geoClientId?: string | null;
};

const OPENAI_MODEL = () => process.env.AI_MIRROR_OPENAI_MODEL || "gpt-4.1-mini";
const GEMINI_MODEL = () => process.env.AI_MIRROR_GEMINI_MODEL || "gemini-2.5-flash";
const EXTRACT_MODEL = () => process.env.AI_MIRROR_EXTRACT_MODEL || "gpt-4.1-mini";

// Rough prices in EUR (≈ USD) — only for the budget guard and the cost shown on each run.
const PRICE = {
  openaiSearchCall: 0.01,
  openaiIn: 0.4 / 1e6,
  openaiOut: 1.6 / 1e6,
  geminiSearchCall: 0.0, // grounding is free up to the daily free allowance; set AI_MIRROR_GEMINI_CALL_EUR if you pay per call
  geminiIn: 0.3 / 1e6,
  geminiOut: 2.5 / 1e6,
};
const geminiCallEur = () => Number(process.env.AI_MIRROR_GEMINI_CALL_EUR || PRICE.geminiSearchCall) || 0;

export function mirrorEngines(): MirrorEngine[] {
  const e: MirrorEngine[] = [];
  if (process.env.OPENAI_API_KEY) e.push("chatgpt");
  if (process.env.GEMINI_API_KEY) e.push("gemini");
  return e;
}

// ─── Questions ────────────────────────────────────────────────────────────

export function buildQueries(input: Pick<MirrorInput, "kind" | "company" | "city" | "category" | "extraQueries">): MirrorQuery[] {
  const { company, city, category } = input;
  const c = category.trim();
  const quick: MirrorQuery[] = [
    { q: `Kaj priporočaš za ${c} v kraju ${city}? Naštej nekaj konkretnih ponudnikov z imeni.`, kind: "discovery" },
    { q: `Iščem ${c} v bližini kraja ${city}. Koga mi priporočaš in zakaj?`, kind: "discovery" },
    { q: `Kaj veš o podjetju ${company} (${city})? Kaj ponujajo in kakšna so mnenja strank?`, kind: "brand" },
  ];
  if (input.kind === "QUICK") return quick;
  const extra = (input.extraQueries || [])
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((q) => ({ q, kind: "discovery" as const }));
  const all: MirrorQuery[] = [
    ...quick.slice(0, 2),
    { q: `Kateri so najbolje ocenjeni ponudniki za ${c} v kraju ${city} in okolici?`, kind: "discovery" },
    { q: `Kdo je najbolj zanesljiv za ${c} v kraju ${city}? Daj mi 3 predloge.`, kind: "discovery" },
    { q: `Best ${c} in ${city}, Slovenia — recommend specific places or companies.`, kind: "discovery" },
    ...extra,
    quick[2],
    { q: `Kakšen je naslov, telefon, spletna stran in delovni čas podjetja ${company} v kraju ${city}?`, kind: "facts" },
  ];
  // Keep at most 10, always ending with the brand and facts questions.
  const tail = all.slice(-2);
  return [...all.slice(0, -2).slice(0, 8), ...tail];
}

// ─── Matching ─────────────────────────────────────────────────────────────

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const LEGAL = /\b(d\s?o\s?o|d\s?d|s\s?p|k\s?d|z\s?o\s?o|gmbh|ltd|llc|inc)\b/g;
const GENERIC = new Set(["gostilna", "restavracija", "picerija", "hotel", "apartmaji", "avtoservis", "servis", "trgovina", "studio", "center", "podjetje", "druzba", "storitve", "ljubljana", "maribor", "kamnik"]);

export function coreName(company: string) {
  return fold(company).replace(LEGAL, " ").replace(/\s+/g, " ").trim();
}

function mentions(text: string, company: string, website?: string | null) {
  const t = ` ${fold(text)} `;
  const core = coreName(company);
  if (!core) return false;
  if (t.includes(` ${core} `)) return true;
  const words = core.split(" ").filter((w) => w.length >= 3 && !GENERIC.has(w));
  if (words.length && words.every((w) => t.includes(` ${w} `)) && (words.length > 1 || words[0].length >= 5)) return true;
  const host = domainOf(website);
  return !!host && fold(text).replace(/ /g, "").includes(host.replace(/[^a-z0-9]/g, ""));
}

function domainOf(url?: string | null) {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function listPosition(text: string, company: string, website?: string | null): number | null {
  const lines = text.split(/\n+/);
  let n = 0;
  for (const line of lines) {
    if (/^\s*(\d+[.)]|[-*•]|#{2,4})\s+/.test(line) && line.replace(/[#*\s\d.)•-]/g, "").length > 2) {
      n++;
      if (mentions(line, company, website)) return n;
    }
  }
  return null;
}

// ─── Engines ──────────────────────────────────────────────────────────────

type Raw = { text: string; sources: { url: string; title?: string }[]; cost: number };

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM =
  "Odgovarjaš kot pomočnik uporabniku v Sloveniji. Odgovori kratko in konkretno (največ 150 besed). " +
  "Ko priporočaš ponudnike, jih naštej v oštevilčenem seznamu z imeni.";

async function askChatGPT(q: string, city: string): Promise<Raw> {
  const key = process.env.OPENAI_API_KEY!;
  const call = (tool: string) =>
    withTimeout(60_000, (signal) =>
      fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: OPENAI_MODEL(),
          instructions: SYSTEM,
          input: q,
          max_output_tokens: 500,
          tools: [{ type: tool, search_context_size: "low", user_location: { type: "approximate", country: "SI", city } }],
        }),
        cache: "no-store",
      })
    );
  let res = await call("web_search");
  if (res.status === 400) res = await call("web_search_preview"); // older accounts / models
  if (!res.ok) throw new Error(`ChatGPT ${res.status}: ${(await res.text()).slice(0, 180)}`);
  const j = await res.json();
  let text = "";
  const sources: Raw["sources"] = [];
  let searches = 0;
  for (const item of j.output || []) {
    if (item.type === "web_search_call") searches++;
    if (item.type === "message")
      for (const c of item.content || []) {
        if (c.type === "output_text") {
          text += c.text;
          for (const a of c.annotations || []) if (a.type === "url_citation" && a.url) sources.push({ url: a.url, title: a.title });
        }
      }
  }
  const u = j.usage || {};
  const cost = Math.max(1, searches) * PRICE.openaiSearchCall + (u.input_tokens || 0) * PRICE.openaiIn + (u.output_tokens || 0) * PRICE.openaiOut;
  return { text: text.trim(), sources: dedupe(sources), cost };
}

async function askGemini(q: string): Promise<Raw> {
  const key = process.env.GEMINI_API_KEY!;
  const call = (thinking: boolean) =>
    withTimeout(60_000, (signal) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL()}:generateContent`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: q }] }],
          tools: [{ google_search: {} }],
          // Thinking off keeps it fast and cheap; models that can't turn it off get the default.
          generationConfig: thinking ? { maxOutputTokens: 2000 } : { maxOutputTokens: 900, thinkingConfig: { thinkingBudget: 0 } },
        }),
        cache: "no-store",
      })
    );
  let res = await call(false);
  if (res.status === 400) res = await call(true);
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 180)}`);
  const j = await res.json();
  const cand = j.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p: any) => p.text || "").join("").trim();
  const sources = (cand?.groundingMetadata?.groundingChunks || [])
    .map((c: any) => (c.web?.uri ? { url: c.web.uri as string, title: c.web.title as string | undefined } : null))
    .filter(Boolean) as Raw["sources"];
  const u = j.usageMetadata || {};
  const cost = geminiCallEur() + (u.promptTokenCount || 0) * PRICE.geminiIn + ((u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0)) * PRICE.geminiOut;
  return { text, sources: dedupe(sources), cost };
}

function dedupe(s: { url: string; title?: string }[]) {
  const seen = new Set<string>();
  return s.filter((x) => (seen.has(x.url) ? false : (seen.add(x.url), true))).slice(0, 8);
}

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    })
  );
  return out;
}

// ─── Reading the answers ─────────────────────────────────────────────────

async function summarize(input: MirrorInput, answers: MirrorAnswer[]): Promise<{ s: MirrorSummary; cost: number }> {
  const empty: MirrorSummary = { competitors: [], brand: {}, wrongFacts: [], summary: "", talkingPoints: [] };
  if (!process.env.OPENAI_API_KEY) return { s: empty, cost: 0 };
  const known = [
    `Podjetje: ${input.company}`,
    `Kraj: ${input.city}`,
    input.address ? `Naslov: ${input.address}` : null,
    input.phone ? `Telefon: ${input.phone}` : null,
    input.website ? `Spletna stran: ${input.website}` : null,
    `Dejavnost: ${input.category}`,
  ]
    .filter(Boolean)
    .join("\n");
  const body = answers
    .filter((a) => a.text)
    .map((a, i) => `[${i + 1}] ${a.engine === "chatgpt" ? "ChatGPT" : "Gemini"} · ${a.kind} · vprašanje: ${a.q}\n${a.text.slice(0, 1500)}`)
    .join("\n\n");
  const full = input.kind === "FULL";
  const prompt = `Pregledaš odgovore AI asistentov o lokalnem podjetju.\n\nZNANI PODATKI O PODJETJU:\n${known}\n\nODGOVORI:\n${body}\n\n` +
    `Vrni JSON: {"competitors":[{"name":"ime drugega ponudnika","mentions":število odgovorov}],` +
    `"brand":{"chatgpt":"known|unknown|wrong","gemini":"known|unknown|wrong"},` +
    `"wrongFacts":["kratek opis napačnega podatka, npr. 'Gemini navaja star telefon 01 234 5678'"],` +
    `"summary":"${full ? "3–4 stavki" : "1–2 stavka"} v slovenščini za prodajalca: kako vidno je podjetje v AI odgovorih in kdo je omenjen namesto njega",` +
    `"talkingPoints":[${full ? '"3 kratke točke, ki jih prodajalec pove stranki na sestanku (konkretno, brez pretiravanja)"' : ""}]}\n` +
    `Pravila: competitors = do 8 drugih konkretnih ponudnikov iz discovery odgovorov, brez našega podjetja, razvrščeni po številu omemb. ` +
    `brand: "known", če asistent pravilno pozna podjetje; "unknown", če ga ne najde ali ga zamenja z drugim; "wrong", če navaja napačne podatke. ` +
    `wrongFacts samo, kjer se odgovor jasno razlikuje od znanih podatkov ali si sam s sabo nasprotuje; ne ugibaj. Ne izmišljuj si številk.`;
  try {
    const res = await withTimeout(45_000, (signal) =>
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: EXTRACT_MODEL(),
          response_format: { type: "json_object" },
          max_tokens: 900,
          messages: [{ role: "user", content: prompt }],
        }),
        cache: "no-store",
      })
    );
    if (!res.ok) return { s: empty, cost: 0 };
    const j = await res.json();
    const u = j.usage || {};
    const cost = (u.prompt_tokens || 0) * PRICE.openaiIn + (u.completion_tokens || 0) * PRICE.openaiOut;
    const p = JSON.parse(j.choices?.[0]?.message?.content || "{}");
    const coreSelf = coreName(input.company);
    const s: MirrorSummary = {
      competitors: (Array.isArray(p.competitors) ? p.competitors : [])
        .filter((c: any) => c && typeof c.name === "string" && coreName(c.name) !== coreSelf)
        .slice(0, 8)
        .map((c: any) => ({ name: String(c.name).slice(0, 80), mentions: Math.max(1, Math.round(Number(c.mentions) || 1)) })),
      brand: Object.fromEntries(
        (["chatgpt", "gemini"] as const).filter((e) => ["known", "unknown", "wrong"].includes(p.brand?.[e])).map((e) => [e, p.brand[e]])
      ),
      wrongFacts: (Array.isArray(p.wrongFacts) ? p.wrongFacts : []).map((x: any) => String(x).slice(0, 200)).slice(0, 8),
      summary: String(p.summary || "").slice(0, 900),
      talkingPoints: (Array.isArray(p.talkingPoints) ? p.talkingPoints : []).map((x: any) => String(x).slice(0, 240)).slice(0, 4),
    };
    return { s, cost };
  } catch {
    return { s: empty, cost: 0 };
  }
}

// ─── Budget ───────────────────────────────────────────────────────────────

export async function mirrorBudget(userId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [month, today] = await Promise.all([
    prisma.aiMirrorRun.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { costEur: true }, _count: true }),
    prisma.aiMirrorRun.groupBy({ by: ["kind"], where: { userId, createdAt: { gte: dayStart } }, _count: true }),
  ]);
  const limit = Number(process.env.AI_MIRROR_MONTHLY_LIMIT_EUR || 25) || 25;
  const quickLimit = Number(process.env.AI_MIRROR_DAILY_QUICK || 30) || 30;
  const fullLimit = Number(process.env.AI_MIRROR_DAILY_FULL || 6) || 6;
  const used = (k: string) => today.find((t) => t.kind === k)?._count || 0;
  return {
    monthEur: Math.round((month._sum.costEur || 0) * 100) / 100,
    monthRuns: month._count,
    limitEur: limit,
    quickLeft: Math.max(0, quickLimit - used("QUICK")),
    fullLeft: Math.max(0, fullLimit - used("FULL")),
  };
}

// ─── Run ──────────────────────────────────────────────────────────────────

export async function runMirror(input: MirrorInput, user: { id: string; name: string }) {
  const engines = mirrorEngines();
  if (!engines.length) throw new Error("AI Mirror ni nastavljen: na strežniku manjkata OPENAI_API_KEY in GEMINI_API_KEY.");
  const b = await mirrorBudget(user.id);
  if (b.monthEur >= b.limitEur) throw new Error(`Mesečni proračun za AI Mirror (${b.limitEur} €) je porabljen. Administrator ga lahko poveča.`);
  if (input.kind === "QUICK" && b.quickLeft <= 0) throw new Error("Danes ste porabili vse hitre preglede. Poskusite jutri.");
  if (input.kind === "FULL" && b.fullLeft <= 0) throw new Error("Danes ste porabili vse celovite analize. Poskusite jutri.");

  // A delivery client keeps the same questions every month, so measurements are comparable.
  let queries = buildQueries(input);
  if (input.geoClientId && input.kind === "FULL") {
    const first = await prisma.aiMirrorRun.findFirst({ where: { geoClientId: input.geoClientId, kind: "FULL", status: "DONE" }, orderBy: { createdAt: "asc" } });
    if (first && Array.isArray(first.queries) && (first.queries as unknown[]).length) queries = first.queries as unknown as MirrorQuery[];
  }

  const run = await prisma.aiMirrorRun.create({
    data: {
      kind: input.kind,
      company: input.company,
      city: input.city,
      category: input.category,
      website: input.website || null,
      phone: input.phone || null,
      address: input.address || null,
      queries: queries as any,
      customerId: input.customerId || null,
      geoClientId: input.geoClientId || null,
      userId: user.id,
      userName: user.name,
      status: "RUNNING",
    },
  });

  try {
    const jobs = queries.flatMap((q) => engines.map((engine) => ({ q, engine })));
    let cost = 0;
    const answers = await pool(jobs, 6, async ({ q, engine }): Promise<MirrorAnswer> => {
      try {
        const r = engine === "chatgpt" ? await askChatGPT(q.q, input.city) : await askGemini(q.q);
        cost += r.cost;
        const host = domainOf(input.website);
        return {
          engine,
          q: q.q,
          kind: q.kind,
          text: r.text,
          sources: r.sources,
          mentioned: mentions(r.text, input.company, input.website),
          position: listPosition(r.text, input.company, input.website),
          siteCited: !!host && r.sources.some((s) => (domainOf(s.url) || "").endsWith(host) || (s.title || "").toLowerCase().includes(host)),
        };
      } catch (e: any) {
        return { engine, q: q.q, kind: q.kind, text: "", sources: [], mentioned: false, position: null, siteCited: false, error: String(e?.message || e).slice(0, 200) };
      }
    });
    const ok = answers.filter((a) => !a.error);
    if (!ok.length) {
      const errs = Array.from(new Set(answers.map((a) => a.error).filter(Boolean)));
      throw new Error(errs.join(" | ") || "Noben AI asistent ni odgovoril.");
    }
    const { s, cost: c2 } = await summarize(input, ok);
    cost += c2;
    const disc = ok.filter((a) => a.kind === "discovery");
    const hits = disc.filter((a) => a.mentioned).length;
    const score = disc.length ? Math.round((hits / disc.length) * 1000) / 10 : null;
    await prisma.aiMirrorRun.update({
      where: { id: run.id },
      data: { status: "DONE", answers: answers as any, summary: s as any, mentions: hits, answersCount: disc.length, score, costEur: Math.round(cost * 10000) / 10000 },
    });
  } catch (e: any) {
    await prisma.aiMirrorRun.update({ where: { id: run.id }, data: { status: "FAILED", error: String(e?.message || e).slice(0, 500) } });
  }
  return run.id;
}
