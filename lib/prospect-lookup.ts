import { lookup as dnsLookup } from "dns/promises";
import net from "net";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { normalize } from "@/lib/prospects";

/**
 * Contact look-up for one prospect, run only when a seller asks.
 *
 * 1. Google Places (GOOGLE_PLACES_API_KEY): phone, website, category.
 * 2. The company's own website: e-mail and phone from the home and contact page.
 * 3. Optional AI (ANTHROPIC_API_KEY): reads that text — or, if no site was
 *    found, searches the web — and returns the best phone/e-mail, the
 *    company's activity and whether the suggested product fits.
 *
 * Results are suggestions with sources; the seller decides what to use.
 * Business directories whose terms forbid automated use are excluded.
 */

const BLOCKED_DOMAINS = ["bizi.si", "companywall.si"];
const UA = "Mozilla/5.0 (compatible; DistributionHubLeadFinder/1.0)";

export type LookupResult = {
  phone: string | null;
  email: string | null;
  website: string | null;
  activity: string | null;
  summary: string | null;
  fit: { productName: string | null; score: number | null; reason: string | null } | null;
  google: { name: string; address: string; phone: string | null; website: string | null; category: string | null; mapsUrl: string | null; rating: number | null; reviews: number | null } | null;
  emailsFound: string[];
  phonesFound: string[];
  sources: string[];
  usedAi: boolean;
  notes: string[];
};

// ─── Safe fetching (no local/private hosts, timeouts, size cap) ───────────

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("Only http(s) URLs");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || net.isIP(host)) {
    throw new Error("Blocked host");
  }
  if (BLOCKED_DOMAINS.some((d) => host === d || host.endsWith("." + d))) throw new Error("Blocked directory");
  const addrs = await dnsLookup(host, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("Blocked host");
  return u;
}

async function safeFetchText(raw: string, maxBytes = 1_500_000): Promise<{ url: string; html: string } | null> {
  let url = raw;
  for (let hop = 0; hop < 4; hop++) {
    const u = await assertPublicUrl(url);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const res = await fetch(u, { redirect: "manual", signal: ctrl.signal, headers: { "user-agent": UA, accept: "text/html" }, cache: "no-store" });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        url = new URL(res.headers.get("location")!, u).toString();
        continue;
      }
      if (!res.ok) return null;
      const type = res.headers.get("content-type") || "";
      if (!type.includes("html") && !type.includes("text")) return null;
      const reader = res.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) break;
        chunks.push(value);
      }
      return { url: u.toString(), html: Buffer.concat(chunks).toString("utf-8") };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

// ─── Extraction helpers ───────────────────────────────────────────────────

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#64;|&commat;/g, "@")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function extractEmails(html: string): string[] {
  const out = new Set<string>();
  const decoded = html.replace(/&#64;|&commat;/g, "@").replace(/\s*\[at\]\s*|\s*\(at\)\s*/gi, "@");
  for (const m of decoded.matchAll(/mailto:([^"'?\s>]+)/gi)) out.add(decodeURIComponent(m[1]).toLowerCase());
  for (const m of decoded.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) out.add(m[0].toLowerCase());
  return Array.from(out).filter(
    (e) => !/\.(png|jpe?g|gif|svg|webp)$/.test(e) && !/(example|sentry|wixpress|domain)\./.test(e) && e.length < 80
  );
}

function extractPhones(html: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/tel:([+\d][\d\s()./-]{6,})/gi)) out.add(m[1].replace(/[^\d+]/g, ""));
  const text = htmlToText(html);
  for (const m of text.matchAll(/(?:\+386|00386|\b0)[\s/-]?\(?\d{1,2}\)?[\s/.-]?\d{3}[\s/.-]?\d{2,3}[\s/.-]?\d{0,3}\b/g)) {
    const digits = m[0].replace(/[^\d+]/g, "");
    if (digits.replace(/^\+?386|^00386/, "0").length >= 8) out.add(digits);
  }
  return Array.from(out).slice(0, 8);
}

function contactLinks(html: string, base: string): string[] {
  const out: string[] = [];
  const host = new URL(base).hostname;
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const href = m[1];
    if (!/kontakt|contact|o-nas|about|impressum/i.test(href)) continue;
    try {
      const u = new URL(href, base);
      if (u.hostname === host && !out.includes(u.toString())) out.push(u.toString());
    } catch {}
    if (out.length >= 2) break;
  }
  return out;
}

const LEGAL_SUFFIX = /\b(d o o|d d|s p|k d|d n o|so p|z o o|gmbh)\b/g;
function nameTokens(s: string): string[] {
  return normalize(s).replace(LEGAL_SUFFIX, " ").split(" ").filter((w) => w.length > 2);
}
function similarity(a: string, b: string): number {
  const A = new Set(nameTokens(a));
  const B = nameTokens(b);
  if (!A.size || !B.length) return 0;
  return B.filter((w) => A.has(w)).length / Math.min(A.size, B.length);
}

// ─── Google Places ────────────────────────────────────────────────────────

async function googlePlaces(name: string, town: string | null, postalCode: string | null): Promise<LookupResult["google"]> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.primaryTypeDisplayName,places.googleMapsUri,places.rating,places.userRatingCount",
      },
      body: JSON.stringify({ textQuery: [name, town].filter(Boolean).join(", "), languageCode: "sl", regionCode: "SI", pageSize: 5 }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Google Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const places: any[] = json.places || [];
    let best: any = null;
    let bestScore = 0;
    for (const p of places) {
      let s = similarity(name, p.displayName?.text || "");
      if (postalCode && String(p.formattedAddress || "").includes(postalCode)) s += 0.4;
      else if (town && normalize(p.formattedAddress || "").includes(normalize(town))) s += 0.2;
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    if (!best || bestScore < 0.5) return null;
    return {
      name: best.displayName?.text || "",
      address: best.formattedAddress || "",
      phone: best.nationalPhoneNumber || best.internationalPhoneNumber || null,
      website: best.websiteUri || null,
      category: best.primaryTypeDisplayName?.text || null,
      mapsUrl: best.googleMapsUri || null,
      rating: best.rating ?? null,
      reviews: best.userRatingCount ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── AI (Claude) ──────────────────────────────────────────────────────────

async function askClaude(prompt: string, useWebSearch: boolean): Promise<any | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const body: any = {
    model: process.env.ANTHROPIC_MODEL || "claude-haiku-5-5",
    max_tokens: 900,
    system:
      "You research Slovenian companies for a B2B sales team. Use only information about the named company. " +
      "Prefer the company's own website and its Google business profile. Never invent contact details: if you are not sure, use null. " +
      "Answer with one JSON object only, no prose.",
    messages: [{ role: "user", content: prompt }],
  };
  if (useWebSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 3, blocked_domains: BLOCKED_DOMAINS }];
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const json = await res.json();
    const text = (json.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

export async function lookupProspect(prospectId: string): Promise<{ error?: string; result?: LookupResult }> {
  const settings = await getSettings();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const usedToday = await prisma.prospect.count({ where: { lookedUpAt: { gte: startOfToday } } });
  if (usedToday >= settings.prospectLookupDailyCap) {
    return { error: `The daily limit of ${settings.prospectLookupDailyCap} contact look-ups is used up. Try again tomorrow, or ask your manager to raise it.` };
  }
  if (!process.env.GOOGLE_PLACES_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return { error: "Contact look-up isn't set up yet (no Google Places or AI key on the server)." };
  }

  const p = await prisma.prospect.findUnique({ where: { id: prospectId }, include: { product: { select: { name: true } } } });
  if (!p) return { error: "Lead not found." };
  const products = await prisma.product.findMany({ where: { active: true }, select: { name: true } });

  const r: LookupResult = {
    phone: null, email: null, website: null, activity: null, summary: null, fit: null,
    google: null, emailsFound: [], phonesFound: [], sources: [], usedAi: false, notes: [],
  };

  // 1. Google Places
  try {
    r.google = await googlePlaces(p.name, p.postTown, p.postalCode);
    if (r.google) {
      r.phone = r.google.phone;
      r.website = r.google.website;
      r.activity = r.google.category;
      if (r.google.mapsUrl) r.sources.push(r.google.mapsUrl);
    } else if (process.env.GOOGLE_PLACES_API_KEY) {
      r.notes.push("No matching Google business profile.");
    }
  } catch (e: any) {
    r.notes.push(`Google: ${e?.message || e}`);
  }

  // 2. Company website: home + contact page
  let siteText = "";
  if (r.website) {
    try {
      const home = await safeFetchText(r.website);
      if (home) {
        r.sources.push(home.url);
        const pages = [home];
        for (const link of contactLinks(home.html, home.url)) {
          const page = await safeFetchText(link);
          if (page) {
            pages.push(page);
            r.sources.push(page.url);
          }
        }
        for (const pg of pages) {
          r.emailsFound.push(...extractEmails(pg.html));
          r.phonesFound.push(...extractPhones(pg.html));
          siteText += `\n--- ${pg.url}\n` + htmlToText(pg.html).slice(0, 6000);
        }
        r.emailsFound = Array.from(new Set(r.emailsFound));
        r.phonesFound = Array.from(new Set(r.phonesFound));
        const domain = new URL(home.url).hostname.replace(/^www\./, "");
        r.email =
          r.emailsFound.find((e) => e.endsWith("@" + domain) && /^(info|kontakt|contact|office|pisarna|recepcija|reception|prodaja|hello)@/.test(e)) ||
          r.emailsFound.find((e) => e.endsWith("@" + domain)) ||
          r.emailsFound[0] ||
          null;
        if (!r.phone) r.phone = r.phonesFound[0] || null;
      } else {
        r.notes.push("The website couldn't be read.");
      }
    } catch (e: any) {
      r.notes.push(`Website: ${e?.message || e}`);
    }
  }

  // 3. AI: read the site text, or search the web if we have nothing.
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const needSearch = !r.website && !r.phone;
      const prompt = [
        `Company (Slovenian Business Register): ${p.name}`,
        `Legal form: ${p.legalForm || "unknown"}${p.soleTrader ? " (sole trader, a natural person)" : ""}`,
        `Address: ${[p.street, p.postalCode, p.postTown].filter(Boolean).join(", ")}`,
        `Suggested product: ${p.product?.name || "none"}. Our products: ${products.map((x) => x.name).join("; ")}.`,
        r.google ? `Google profile: ${JSON.stringify(r.google)}` : "No Google profile found.",
        siteText ? `Text from the company's website:\n${siteText.slice(0, 12000)}` : "",
        needSearch
          ? "Search the web for this exact company (match name and town) to find its official website and public business phone and e-mail."
          : "",
        `Return JSON: {"website": string|null, "phone": string|null, "email": string|null, "activity": string (what the company does, in Slovenian, max 12 words)|null, "summary": string (1-2 sentences in Slovenian, useful before a sales call)|null, "fitProduct": string (one of our product names, best fit)|null, "fitScore": number 0-100, "fitReason": string (Slovenian, max 20 words), "sources": string[] (URLs you used)}. ` +
          "For phone prefer the main business or reception line; for e-mail prefer a general company address (info@, kontakt@) over a personal one.",
      ]
        .filter(Boolean)
        .join("\n\n");
      const ai = await askClaude(prompt, needSearch);
      if (ai) {
        r.usedAi = true;
        r.website = r.website || ai.website || null;
        r.phone = r.phone || ai.phone || null;
        r.email = r.email || ai.email || null;
        r.activity = ai.activity || r.activity;
        r.summary = ai.summary || null;
        r.fit = { productName: ai.fitProduct || null, score: typeof ai.fitScore === "number" ? ai.fitScore : null, reason: ai.fitReason || null };
        for (const s of ai.sources || []) if (typeof s === "string" && !r.sources.includes(s)) r.sources.push(s);
      }
    } catch (e: any) {
      r.notes.push(`AI: ${e?.message || e}`);
    }
  }

  // Never keep sources from directories we don't use.
  r.sources = r.sources.filter((s) => !BLOCKED_DOMAINS.some((d) => s.includes(d))).slice(0, 8);

  await prisma.prospect.update({
    where: { id: p.id },
    data: {
      phone: r.phone,
      email: r.email,
      website: r.website,
      activity: r.activity,
      lookup: JSON.stringify(r),
      lookedUpAt: new Date(),
    },
  });
  return { result: r };
}
