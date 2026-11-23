// Checks a client's website: is our schema there and does it match the card, is llms.txt reachable,
// and are AI crawlers allowed in robots.txt.
import { AI_BOTS } from "@/lib/geo-code";
import type { GeoCard } from "@/lib/geo-labels";

export type SiteCheck = { key: string; label: string; ok: boolean; detail: string };
export type SiteCheckResult = { at: string; url: string; ok: boolean; checks: SiteCheck[] };

const digits = (s?: string) => (s || "").replace(/\D/g, "").replace(/^386/, "0").replace(/^00386/, "0");

async function get(url: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; MrPickedCheck/1.0; +https://mrpicked.eu)" },
      cache: "no-store",
    });
    const text = r.ok ? (await r.text()).slice(0, 2_000_000) : "";
    return { status: r.status, text, finalUrl: r.url };
  } catch (e: any) {
    return { status: 0, text: "", finalUrl: url, error: e?.name === "AbortError" ? "timeout" : e?.message || "napaka" };
  } finally {
    clearTimeout(timer);
  }
}

function flatten(node: any, out: any[] = []): any[] {
  if (!node) return out;
  if (Array.isArray(node)) {
    node.forEach((n) => flatten(n, out));
    return out;
  }
  if (typeof node === "object") {
    out.push(node);
    if (node["@graph"]) flatten(node["@graph"], out);
  }
  return out;
}

/** Is the given user-agent allowed to fetch "/"? Minimal robots.txt reading (groups, Allow/Disallow on "/"). */
export function robotsAllows(robots: string, agent: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let cur: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const [k, ...rest] = line.split(":");
    const key = k.trim().toLowerCase();
    const val = rest.join(":").trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (!cur) continue;
      if (key === "allow" || key === "disallow") cur.rules.push({ allow: key === "allow", path: val });
    }
  }
  const a = agent.toLowerCase();
  const group = groups.find((g) => g.agents.includes(a)) || groups.find((g) => g.agents.includes("*"));
  if (!group) return true;
  // Decide for "/" by the most specific matching rule.
  let best: { allow: boolean; path: string } | null = null;
  for (const r of group.rules) {
    if (r.path === "") continue; // "Disallow:" (empty) allows all
    if (r.path === "/" || r.path === "/*") {
      if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
    }
  }
  return best ? best.allow : true;
}

export async function verifySite(card: GeoCard): Promise<SiteCheckResult> {
  const raw = (card.website || "").trim();
  const url = (/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).replace(/\/+$/, "");
  const checks: SiteCheck[] = [];
  const page = await get(url);
  checks.push({
    key: "site",
    label: "Spletna stran se odpre",
    ok: page.status >= 200 && page.status < 400 && !!page.text,
    detail: page.status ? `HTTP ${page.status}` : `Ni odziva (${(page as any).error || "napaka"})`,
  });

  // JSON-LD
  const blocks = Array.from(page.text.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)).map((m) => m[1]);
  const nodes: any[] = [];
  let bad = 0;
  for (const b of blocks) {
    try {
      flatten(JSON.parse(b.trim()), nodes);
    } catch {
      bad++;
    }
  }
  const phone = digits(card.phone);
  const biz = nodes.find((n) => n.telephone && digits(String(n.telephone)) === phone) || nodes.find((n) => n.address && n.name);
  checks.push({
    key: "schema",
    label: "Strukturirani podatki (schema.org) so na strani",
    ok: !!biz,
    detail: blocks.length
      ? `${blocks.length} blok(ov) JSON-LD${bad ? `, ${bad} z napako` : ""}${biz ? "" : ", a nobeden s podatki podjetja"}`
      : "JSON-LD ni najden",
  });
  if (biz) {
    const diffs: string[] = [];
    if (phone && digits(String(biz.telephone || "")) !== phone) diffs.push("telefon");
    const street = (card.address || "").toLowerCase().replace(/\s+/g, " ").trim();
    const theirs = String(biz.address?.streetAddress || "").toLowerCase().replace(/\s+/g, " ").trim();
    if (street && theirs !== street) diffs.push("naslov");
    if (!card.open24h && !biz.openingHoursSpecification && !biz.openingHours) diffs.push("delovni čas");
    checks.push({
      key: "schema-match",
      label: "Podatki v schemi se ujemajo s kartico",
      ok: diffs.length === 0,
      detail: diffs.length ? `Ne ujema se: ${diffs.join(", ")}` : "Ime, naslov, telefon in delovni čas so usklajeni",
    });
  }

  // Footer NAP
  const text = page.text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const phoneOnPage = phone && digits(text).includes(phone);
  checks.push({
    key: "nap",
    label: "Telefon je zapisan na strani (noga)",
    ok: !!phoneOnPage,
    detail: phoneOnPage ? "Najden" : "Telefona iz kartice ni na domači strani",
  });

  // llms.txt
  const llms = await get(`${url}/llms.txt`);
  const llmsOk = llms.status === 200 && /^#\s+\S/m.test(llms.text) && !/<html/i.test(llms.text);
  checks.push({
    key: "llms",
    label: "llms.txt je dosegljiv",
    ok: llmsOk,
    detail: llmsOk ? "Najden" : llms.status ? `HTTP ${llms.status}${/<html/i.test(llms.text) ? " (vrne HTML stran)" : ""}` : "Ni odziva",
  });

  // robots.txt
  const robots = await get(`${url}/robots.txt`);
  const blocked = robots.status === 200 ? AI_BOTS.filter((b) => !robotsAllows(robots.text, b)) : [];
  checks.push({
    key: "robots",
    label: "robots.txt dovoli AI robote",
    ok: blocked.length === 0,
    detail: robots.status === 200 ? (blocked.length ? `Blokirani: ${blocked.join(", ")}` : "Vsi dovoljeni") : "robots.txt ga ni (to pomeni, da je dovoljeno)",
  });

  return { at: new Date().toISOString(), url, ok: checks.every((c) => c.ok), checks };
}
