import crypto from "crypto";

/**
 * Google Search Console + Bing Webmaster Tools for client websites.
 *
 * Google: a service account (GOOGLE_SERVICE_ACCOUNT_JSON) gets a META verification token, verifies the site
 * (Site Verification API), adds it to Search Console and submits the sitemap. People in GOOGLE_OWNER_EMAILS
 * (comma-separated) are added as owners so they can open the property in Search Console.
 * Bing: BING_WEBMASTER_API_KEY — AddSite, the account's msvalidate.01 code, VerifySite, SubmitSiteMap.
 */

export type EngineState = {
  code?: string | null; // verification meta content
  added?: boolean;
  verified?: boolean;
  sitemap?: string | null;
  error?: string | null;
  at?: string;
};
export type WebmasterState = { siteUrl: string; google?: EngineState; bing?: EngineState };

export const googleConfigured = () => !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
export const bingConfigured = () => !!process.env.BING_WEBMASTER_API_KEY;

const UA = "Mozilla/5.0 (compatible; MrPickedCRM/1.0; +https://mrpicked.eu)";

async function fetchT(url: string, init: RequestInit = {}, ms = 20_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

/** The URL-prefix property must match the address the site really answers on (https, www or not). */
export async function canonicalSiteUrl(website: string): Promise<string> {
  const start = website.startsWith("http") ? website : `https://${website}`;
  try {
    const r = await fetchT(start, { redirect: "follow", headers: { "user-agent": UA } }, 15_000);
    const u = new URL(r.url || start);
    return `${u.protocol}//${u.host}/`;
  } catch {
    const u = new URL(start);
    return `${u.protocol}//${u.host}/`;
  }
}

/** robots.txt "Sitemap:" lines first, then the usual paths (Wix, WordPress core, Yoast/Rank Math). */
export async function findSitemap(siteUrl: string): Promise<string | null> {
  const base = siteUrl.replace(/\/$/, "");
  const candidates: string[] = [];
  try {
    const r = await fetchT(`${base}/robots.txt`, { headers: { "user-agent": UA } }, 10_000);
    if (r.ok) for (const m of (await r.text()).matchAll(/^\s*sitemap:\s*(\S+)/gim)) candidates.push(m[1]);
  } catch {
    /* no robots.txt */
  }
  candidates.push(`${base}/sitemap.xml`, `${base}/sitemap_index.xml`, `${base}/wp-sitemap.xml`, `${base}/sitemap-index.xml`);
  for (const url of Array.from(new Set(candidates))) {
    try {
      const r = await fetchT(url, { headers: { "user-agent": UA } }, 10_000);
      if (!r.ok) continue;
      const head = (await r.text()).slice(0, 2000);
      if (/<urlset|<sitemapindex/i.test(head)) return url;
    } catch {
      /* try next */
    }
  }
  return null;
}

// ─── Google ───────────────────────────────────────────────────────────────

let cachedToken: { token: string; exp: number } | null = null;

async function googleToken(): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "");
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON ni veljaven JSON.");
  }
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/siteverification https://www.googleapis.com/auth/webmasters",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key.replace(/\\n/g, "\n"), "base64url");
  const r = await fetchT("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Google prijava ni uspela: ${j.error_description || j.error || r.status}`);
  cachedToken = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return cachedToken.token;
}

async function gapi(method: string, url: string, body?: unknown) {
  const r = await fetchT(url, {
    method,
    headers: { authorization: `Bearer ${await googleToken()}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j: any = {};
  try {
    j = text ? JSON.parse(text) : {};
  } catch {
    j = { raw: text };
  }
  if (!r.ok) throw new Error(j?.error?.message || `Google ${r.status}`);
  return j;
}

/** Returns the content of the google-site-verification meta tag. */
export async function googleVerificationCode(siteUrl: string): Promise<string> {
  const j = await gapi("POST", "https://www.googleapis.com/siteVerification/v1/token", {
    site: { type: "SITE", identifier: siteUrl },
    verificationMethod: "META",
  });
  const m = String(j.token || "").match(/content="([^"]+)"/);
  if (!m) throw new Error("Google ni vrnil verifikacijske kode.");
  return m[1];
}

/** Verify, add to Search Console, add owners, submit sitemap. */
export async function googleSubmit(siteUrl: string, sitemap: string | null): Promise<EngineState> {
  const res = await gapi("POST", "https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=META", {
    site: { type: "SITE", identifier: siteUrl },
  });
  const owners = (process.env.GOOGLE_OWNER_EMAILS || "aureliaracuni@gmail.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (res.id && owners.length) {
    const all = Array.from(new Set([...(res.owners || []), ...owners]));
    if (all.length > (res.owners || []).length) {
      await gapi("PUT", `https://www.googleapis.com/siteVerification/v1/webResource/${res.id}`, { site: res.site, owners: all }).catch(() => null);
    }
  }
  const site = encodeURIComponent(siteUrl);
  await gapi("PUT", `https://www.googleapis.com/webmasters/v3/sites/${site}`);
  if (sitemap) await gapi("PUT", `https://www.googleapis.com/webmasters/v3/sites/${site}/sitemaps/${encodeURIComponent(sitemap)}`);
  return { verified: true, added: true, sitemap, error: null, at: new Date().toISOString() };
}

// ─── Bing ─────────────────────────────────────────────────────────────────

async function bing(method: string, body?: unknown) {
  const url = `https://ssl.bing.com/webmaster/api.svc/json/${method}?apikey=${encodeURIComponent(process.env.BING_WEBMASTER_API_KEY || "")}`;
  const r = await fetchT(url, {
    method: body ? "POST" : "GET",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j: any = {};
  try {
    j = text ? JSON.parse(text) : {};
  } catch {
    j = { raw: text };
  }
  if (!r.ok) throw new Error(`Bing: ${j?.Message || j?.ErrorCode || r.status}`);
  return j?.d;
}

const sameSite = (a: string, b: string) => a.replace(/\/$/, "").toLowerCase() === b.replace(/\/$/, "").toLowerCase();

/** Adds the site (if needed) and returns the msvalidate.01 code. */
export async function bingVerificationCode(siteUrl: string): Promise<{ code: string; verified: boolean }> {
  let sites: any[] = (await bing("GetUserSites")) || [];
  let s = sites.find((x) => sameSite(String(x.Url), siteUrl));
  if (!s) {
    await bing("AddSite", { siteUrl });
    sites = (await bing("GetUserSites")) || [];
    s = sites.find((x) => sameSite(String(x.Url), siteUrl));
  }
  if (!s?.AuthenticationCode) throw new Error("Bing ni vrnil verifikacijske kode.");
  return { code: String(s.AuthenticationCode), verified: !!s.IsVerified };
}

export async function bingSubmit(siteUrl: string, sitemap: string | null): Promise<EngineState> {
  const sites: any[] = (await bing("GetUserSites")) || [];
  let verified = !!sites.find((x) => sameSite(String(x.Url), siteUrl))?.IsVerified;
  if (!verified) verified = !!(await bing("VerifySite", { siteUrl }));
  if (!verified) return { added: true, verified: false, sitemap: null, error: "Bing še ne najde kode na strani.", at: new Date().toISOString() };
  if (sitemap) await bing("SubmitSiteMap", { siteUrl, feedUrl: sitemap });
  return { added: true, verified: true, sitemap, error: null, at: new Date().toISOString() };
}

/** Meta tags for <head>, from the stored state. */
export function verificationMetaTags(state: WebmasterState | null | undefined): string {
  if (!state) return "";
  return [
    state.google?.code ? `<meta name="google-site-verification" content="${state.google.code}">` : null,
    state.bing?.code ? `<meta name="msvalidate.01" content="${state.bing.code}">` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
