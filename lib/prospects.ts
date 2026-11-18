import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { getSellableProductIds } from "@/lib/access";
import type { CurrentUser } from "@/lib/session";

/**
 * Lead finder.
 *
 * Source: the free, open list of the Slovenian Business Register (AJPES,
 * published on OPSI under CC BY 4.0). It has the registration number, name,
 * legal form and address — no activity code, phone or email. A product is
 * suggested from keywords in the registered name (ProspectRule); contact
 * details are looked up per lead when a seller asks (lib/prospect-lookup).
 */

export const AJPES_RESOURCE_ID = "beb70929-3d0d-41c6-9af2-25d525d906d3";
const AJPES_API = "https://podatki.gov.si/api/3/action/datastore_search";
export const AJPES_ATTRIBUTION =
  "Vir: Poslovni register Slovenije, AJPES — podatki.gov.si (CC BY 4.0)";

export const PROSPECT_STATUS_LABEL: Record<string, string> = {
  NEW: "Available",
  RECOMMENDED: "Recommended",
  CLAIMED: "Claimed",
  REJECTED: "Not a fit",
  DO_NOT_CONTACT: "Do not contact",
};

/** Lower-case, no diacritics, single spaces. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function splitWords(list: string | null | undefined): string[] {
  return (list || "")
    .split(/[,\n;]/)
    .map((w) => normalize(w))
    .filter(Boolean);
}

/** True when every word of `phrase` starts a word in `name` (both normalized). */
function phraseMatches(name: string, phrase: string): boolean {
  const words = name.split(" ");
  return phrase.split(" ").every((p) => words.some((w) => w.startsWith(p)));
}

type Rule = { productId: string; keywords: string[]; exclude: string[]; priority: number };

export async function loadRules(): Promise<Rule[]> {
  const rules = await prisma.prospectRule.findMany({
    where: { active: true, product: { active: true } },
  });
  return rules.map((r) => ({
    productId: r.productId,
    keywords: splitWords(r.keywords),
    exclude: splitWords(r.exclude),
    priority: r.priority,
  }));
}

/** Best product for a company name, or null when no rule matches. */
export function matchProduct(name: string, rules: Rule[]) {
  const n = normalize(name);
  let best: { productId: string; keyword: string; score: number } | null = null;
  for (const r of rules) {
    if (r.exclude.some((x) => phraseMatches(n, x))) continue;
    for (const k of r.keywords) {
      if (!phraseMatches(n, k)) continue;
      // Longer / multi-word keywords are more specific → higher score.
      const score = 50 + r.priority * 10 + Math.min(k.length, 25);
      if (!best || score > best.score) best = { productId: r.productId, keyword: k, score };
    }
  }
  return best;
}

/** Starter rules, created once if there are none. Admins edit them in Lead finder. */
const DEFAULT_RULES: { productName: string; keywords: string; exclude?: string; priority?: number }[] = [
  { productName: "for Hotels", keywords: "hotel, hoteli, penzion, garni, hostel, motel, resort", exclude: "hotelska oprema", priority: 2 },
  {
    productName: "for Airbnb",
    keywords: "apartma, apartmaji, apartmajev, sobodajalstvo, sobodajalka, sobodajalec, turisticne sobe, oddajanje sob, pocitniska hisa, pocitniske hise, glamping, turisticna kmetija",
    priority: 2,
  },
  {
    productName: "Building Managers",
    keywords: "upravljanje nepremicnin, upravljanje z nepremicninami, upravljanje stavb, upravnik, upravniki, hisniske storitve, etazna lastnina",
    priority: 3,
  },
  {
    productName: "Tradespeople",
    keywords: "vodovod, vodovodne, vodoinstalacije, instalacije, instalaterstvo, ogrevanje, centralne kurjave, klima, klimatske, toplotne crpalke, elektroinstalacije, elektroinstalaterstvo, elektro storitve, plinske, dimnikarstvo, servis kotlov",
    exclude: "trgovina",
    priority: 1,
  },
  {
    productName: "Picked - Visible",
    keywords: "frizerstvo, frizerski, kozmetika, kozmeticni, kozmeticne, pedikura, manikura, gostilna, restavracija, picerija, pizzeria, okrepcevalnica, kavarna, slascicarna, zobozdravstvo, zobna ordinacija, fizioterapija, masaze, wellness, avtoservis, avtolicarstvo, vulkanizerstvo, fotostudio",
    priority: 0,
  },
];

export async function ensureDefaultRules() {
  if ((await prisma.prospectRule.count()) > 0) return;
  const products = await prisma.product.findMany({ select: { id: true, name: true } });
  for (const d of DEFAULT_RULES) {
    const p = products.find((x) => x.name.toLowerCase().includes(d.productName.toLowerCase()));
    if (!p) continue;
    await prisma.prospectRule.create({
      data: { productId: p.id, keywords: d.keywords, exclude: d.exclude || null, priority: d.priority || 0 },
    });
  }
}

type AjpesRecord = Record<string, string>;

async function fetchAjpes(q: string, offset: number, limit: number): Promise<{ total: number; records: AjpesRecord[] }> {
  const url = `${AJPES_API}?resource_id=${AJPES_RESOURCE_ID}&q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(`AJPES API ${res.status}`);
    const json = await res.json();
    if (!json.success) throw new Error("AJPES API returned an error");
    return { total: json.result.total, records: json.result.records };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ImportSummary = {
  keywords: number;
  fetched: number;
  matched: number;
  created: number;
  duplicates: number;
  errors: string[];
};

/**
 * Searches the AJPES list for every rule keyword, keeps companies whose
 * name matches a rule, and stores the new ones as prospects.
 * Duplicates (same registration number, or a company already in the CRM)
 * are skipped.
 */
export async function importFromAjpes(opts: { maxPerKeyword?: number } = {}): Promise<ImportSummary> {
  const maxPerKeyword = opts.maxPerKeyword ?? 1500;
  const rules = await loadRules();
  const keywords = Array.from(new Set(rules.flatMap((r) => r.keywords)));
  const summary: ImportSummary = { keywords: keywords.length, fetched: 0, matched: 0, created: 0, duplicates: 0, errors: [] };

  const found = new Map<string, { rec: AjpesRecord; productId: string; keyword: string; score: number }>();
  for (const k of keywords) {
    try {
      for (let offset = 0; offset < maxPerKeyword; offset += 500) {
        const { total, records } = await fetchAjpes(k, offset, 500);
        summary.fetched += records.length;
        for (const rec of records) {
          const reg = String(rec["Matična številka"] || "").trim();
          // Main entities end in 000; other numbers are branches/units.
          if (!/^\d{10}$/.test(reg) || !reg.endsWith("000")) continue;
          if (String(rec["Država"] || "SLOVENIJA").toUpperCase() !== "SLOVENIJA") continue;
          const m = matchProduct(String(rec["Popolno ime"] || ""), rules);
          if (!m) continue;
          const prev = found.get(reg);
          if (!prev || m.score > prev.score) found.set(reg, { rec, ...m });
        }
        if (offset + 500 >= total) break;
        await sleep(250);
      }
    } catch (e: any) {
      summary.errors.push(`${k}: ${e?.message || e}`);
    }
    await sleep(250);
  }
  summary.matched = found.size;

  // Skip what we already have: prospects by reg. number, customers by company name.
  const regs = Array.from(found.keys());
  const existing = new Set<string>();
  for (let i = 0; i < regs.length; i += 1000) {
    const chunk = await prisma.prospect.findMany({ where: { regNumber: { in: regs.slice(i, i + 1000) } }, select: { regNumber: true } });
    chunk.forEach((c) => existing.add(c.regNumber));
  }
  const customerNames = new Set(
    (await prisma.customer.findMany({ where: { company: { not: null } }, select: { company: true } })).map((c) =>
      normalize(c.company!)
    )
  );

  const rows = [];
  for (const [reg, f] of found) {
    const name = String(f.rec["Popolno ime"] || "").trim();
    if (existing.has(reg) || customerNames.has(normalize(name))) {
      summary.duplicates++;
      continue;
    }
    const legalForm = String(f.rec["Pravnoorganizacijska oblika"] || "").trim() || null;
    const street = [f.rec["Ulica"], String(f.rec["Hišna št"] || "").replace(/^0+/, ""), f.rec["Hišna št  dodatek"]]
      .filter(Boolean)
      .join(" ")
      .trim();
    rows.push({
      regNumber: reg,
      name,
      legalForm,
      soleTrader: !!legalForm && /podjetnik|s\.p\./i.test(legalForm),
      street: street || null,
      postalCode: String(f.rec["Poštna št"] || "").trim() || null,
      postTown: String(f.rec["Pošta"] || "").trim() || null,
      settlement: String(f.rec["Naselje"] || "").trim() || null,
      source: "AJPES",
      productId: f.productId,
      matchedKeyword: f.keyword,
      score: f.score,
    });
  }
  for (let i = 0; i < rows.length; i += 500) {
    const res = await prisma.prospect.createMany({ data: rows.slice(i, i + 500), skipDuplicates: true });
    summary.created += res.count;
  }
  summary.duplicates += rows.length - summary.created;

  await prisma.settings.update({
    where: { id: 1 },
    data: {
      prospectLastImportAt: new Date(),
      prospectLastImportNote: `${summary.created} new, ${summary.duplicates} duplicates skipped, ${summary.matched} matched out of ${summary.fetched} searched${
        summary.errors.length ? `, ${summary.errors.length} errors` : ""
      }`,
    },
  });
  return summary;
}

/** Recommendations nobody claimed in time go back to the pool (and not to the same seller). */
export async function expireRecommendations() {
  const settings = await getSettings();
  const cutoff = new Date(Date.now() - settings.prospectExpiryDays * 86_400_000);
  const stale = await prisma.prospect.findMany({
    where: { status: "RECOMMENDED", recommendedAt: { lt: cutoff } },
    select: { id: true, recommendedToId: true, skippedBy: true },
  });
  for (const p of stale) {
    await prisma.prospect.update({
      where: { id: p.id },
      data: {
        status: "NEW",
        recommendedToId: null,
        recommendedAt: null,
        skippedBy: [p.skippedBy, p.recommendedToId].filter(Boolean).join(","),
      },
    });
  }
  return stale.length;
}

/**
 * Tops up a seller's recommendations: at most `quota` open ones, and at
 * most `quota` new ones per day. Only products the seller may sell.
 */
export async function recommendFor(user: CurrentUser) {
  if (user.role !== "SALES") return;
  await expireRecommendations();
  const [settings, me] = await Promise.all([
    getSettings(),
    prisma.user.findUnique({ where: { id: user.id }, select: { prospectQuota: true } }),
  ]);
  const quota = me?.prospectQuota ?? settings.prospectDailyPerSeller;
  if (quota <= 0) return;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [open, givenToday] = await Promise.all([
    prisma.prospect.count({ where: { recommendedToId: user.id, status: "RECOMMENDED" } }),
    prisma.prospect.count({ where: { recommendedToId: user.id, recommendedAt: { gte: startOfToday } } }),
  ]);
  const need = Math.min(quota - open, quota - givenToday);
  if (need <= 0) return;
  const productIds = await getSellableProductIds(user);
  if (productIds.length === 0) return;

  const candidates = await prisma.prospect.findMany({
    where: {
      status: "NEW",
      productId: { in: productIds },
      OR: [{ skippedBy: null }, { NOT: { skippedBy: { contains: user.id } } }],
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: need * 3,
    select: { id: true },
  });
  let given = 0;
  for (const c of candidates) {
    if (given >= need) break;
    const { count } = await prisma.prospect.updateMany({
      where: { id: c.id, status: "NEW" },
      data: { status: "RECOMMENDED", recommendedToId: user.id, recommendedAt: new Date() },
    });
    given += count;
  }
}
