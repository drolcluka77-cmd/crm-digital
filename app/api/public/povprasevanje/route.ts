import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";
import { assignWarmLead } from "@/lib/warm-leads";
import { mirrorEngines, runMirror } from "@/lib/ai-mirror";

export const dynamic = "force-dynamic";

/**
 * Public inquiry form for product websites (e.g. simpleimport.eu). No secret: it is an ordinary contact form.
 *
 *   POST /api/public/povprasevanje?produkt=simpleimport
 *   Body: HTML form (application/x-www-form-urlencoded or multipart) or JSON.
 *
 * Fields: ime*, email*, podjetje, telefon, kraj, dejavnost, izdelek, kolicina, rok, sporocilo, vrsta (e.g. "iskanje" | "vprasanje"),
 *         jezik, stran (page the form is on), hvala (thank-you URL to redirect to after a form post),
 *         website (honeypot — must stay empty), cf-turnstile-response (only if TURNSTILE_SECRET_KEY is set).
 * Answers JSON for fetch()/JSON requests; redirects to `hvala` (or a simple thank-you page) for normal form posts.
 * Creates a warm website lead with the product and offers it to a seller (72 h to accept); an e-mail already in
 * the CRM is not duplicated — its seller is told instead.
 * Mr. Picked inquiries with kraj + dejavnost also get an automatic AI Mirror analysis, ready before the first call.
 */

const PRODUCTS: Record<string, { match: RegExp; label: string }> = {
  simpleimport: { match: /simple\s*import/i, label: "SimpleImport" },
  picked: { match: /picked/i, label: "Mr. Picked" },
  unbusyness: { match: /unbusyness/i, label: "Unbusyness" },
};

// Origins allowed to post (CORS + thank-you redirect). Extra ones: PUBLIC_FORM_ORIGINS="https://a.si,https://b.eu"
function allowedOrigins() {
  return [
    "https://simpleimport.eu",
    "https://www.simpleimport.eu",
    "https://mrpicked.eu",
    "https://www.mrpicked.eu",
    "https://unbusyness.com",
    "https://www.unbusyness.com",
    ...(process.env.PUBLIC_FORM_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
  ];
}
function originOk(origin: string | null) {
  if (!origin) return false;
  if (allowedOrigins().includes(origin)) return true;
  // Preview builds on Cloudflare Pages / Netlify / Vercel and local testing.
  return /^https:\/\/[a-z0-9-]+\.(pages\.dev|netlify\.app|vercel\.app)$/i.test(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
function cors(req: NextRequest) {
  const origin = req.headers.get("origin");
  return {
    "Access-Control-Allow-Origin": originOk(origin) ? origin! : "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

// Simple in-memory rate limit: 5 inquiries per IP per 10 minutes (per server instance).
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 5;
}

const clip = (v: unknown, n = 200) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, n) : null;
};

async function readBody(req: NextRequest): Promise<{ data: Record<string, string>; json: boolean }> {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    const b = await req.json().catch(() => ({}));
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(b || {})) data[k] = Array.isArray(v) ? v.join(", ") : String(v ?? "");
    return { data, json: true };
  }
  const fd = await req.formData().catch(() => null);
  const data: Record<string, string> = {};
  fd?.forEach((v, k) => {
    if (typeof v === "string") data[k] = data[k] ? `${data[k]}, ${v}` : v;
  });
  return { data, json: false };
}

function thanks(req: NextRequest, d: Record<string, string>, ok: boolean, message: string) {
  const back = d.hvala;
  if (back) {
    try {
      const u = new URL(back);
      if (originOk(u.origin)) {
        if (!ok) u.searchParams.set("napaka", message);
        return NextResponse.redirect(u.toString(), 303);
      }
    } catch {
      /* ignore bad URL */
    }
  }
  const html = `<!doctype html><html lang="sl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${ok ? "Hvala" : "Napaka"}</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f5f2;color:#1b1b1b;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px}main{max-width:460px;background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,.08)}h1{font-size:22px;margin:0 0 8px}p{color:#555;line-height:1.5}a{color:#1b1b1b}</style></head>
<body><main><h1>${ok ? "Hvala za povpraševanje!" : "Povpraševanja nismo prejeli"}</h1><p>${message}</p>${
    req.headers.get("referer") ? `<p><a href="${String(req.headers.get("referer")).replace(/"/g, "")}">← Nazaj na stran</a></p>` : ""
  }</main></body></html>`;
  return new NextResponse(html, { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } });
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}

export async function POST(req: NextRequest) {
  const headers = cors(req);
  const { data: d, json } = await readBody(req);
  const reply = (ok: boolean, message: string, status = 200, extra: Record<string, unknown> = {}) =>
    json ? NextResponse.json({ ok, message, ...extra }, { status: ok ? 200 : status, headers }) : thanks(req, d, ok, message);

  // Honeypot: real people never fill the hidden "website" field. Pretend success.
  if ((d.website || "").trim()) return reply(true, "Hvala, oglasili se bomo v enem delovnem dnevu.");

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  if (limited(ip)) return reply(false, "Preveč oddaj v kratkem času. Poskusite znova čez nekaj minut.", 429);

  if (process.env.TURNSTILE_SECRET_KEY) {
    const token = d["cf-turnstile-response"] || "";
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
    })
      .then((r) => r.json())
      .catch(() => ({ success: false }));
    if (!res?.success) return reply(false, "Preverjanje proti robotom ni uspelo. Osvežite stran in poskusite znova.", 400);
  }

  const key = (req.nextUrl.searchParams.get("produkt") || d.produkt || "simpleimport").toLowerCase();
  const prod = PRODUCTS[key] || PRODUCTS.simpleimport;
  const email = (clip(d.email, 200) || "").toLowerCase();
  const name = clip(d.ime, 120);
  if (!name) return reply(false, "Vpišite ime.", 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(false, "Vpišite veljaven e-naslov.", 400);

  const kind = clip(d.vrsta, 40);
  const lines = [
    `Povpraševanje s spletne strani ${prod.label}${d.stran ? ` (${clip(d.stran, 120)})` : ""}${kind ? ` · ${kind}` : ""}${d.jezik ? ` · jezik ${clip(d.jezik, 5)}` : ""}`,
    d.dejavnost ? `Dejavnost: ${clip(d.dejavnost, 80)}` : null,
    d.izdelek ? `Izdelek: ${clip(d.izdelek, 300)}` : null,
    d.kolicina ? `Količina: ${clip(d.kolicina, 100)}` : null,
    d.rok ? `Želeni rok: ${clip(d.rok, 60)}` : null,
    d.sporocilo ? `Sporočilo: ${clip(d.sporocilo, 2000)}` : null,
  ].filter(Boolean) as string[];
  const summary = lines.join("\n");

  const existing = await prisma.customer.findFirst({ where: { email } });
  if (existing) {
    await logActivity(existing.id, null, "WEBSITE_SIGNUP", summary);
    await prisma.customer.update({
      where: { id: existing.id },
      data: { note: [existing.note, summary].filter(Boolean).join("\n\n").slice(0, 8000) },
    });
    const to = existing.ownerId
      ? [existing.ownerId]
      : (await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } })).map((u) => u.id);
    await notify(to, {
      type: "WARM_LEAD",
      title: `${existing.company || existing.name}: novo povpraševanje (${prod.label})`,
      body: d.izdelek ? `Izdelek: ${clip(d.izdelek, 120)}` : "Oddal(a) je obrazec na spletni strani.",
      link: `/crm/customers/${existing.id}`,
    });
    return reply(true, "Hvala, oglasili se bomo v enem delovnem dnevu.", 200, { duplicate: true });
  }

  const products = await prisma.product.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { sortOrder: "asc" } });
  const product = products.find((p) => prod.match.test(p.name)) || null;

  const customer = await prisma.customer.create({
    data: {
      name,
      company: clip(d.podjetje, 160),
      email,
      phone: clip(d.telefon, 60),
      city: clip(d.kraj, 80),
      country: "Slovenia",
      segment: product?.name || null,
      size: clip(d.kolicina, 80),
      source: `Website (${prod.label})`,
      leadType: "WARM_WEB",
      note: summary,
      status: "NEW",
      interests: product ? { create: [{ productId: product.id }] } : undefined,
    },
  });
  await logActivity(customer.id, null, "WEBSITE_SIGNUP", summary);
  await assignWarmLead(customer.id);

  // Mr. Picked: run the AI Mirror analysis in the background so the seller sees it on the customer page.
  const city = clip(d.kraj, 80);
  const category = clip(d.dejavnost, 80);
  if (key === "picked" && city && category && mirrorEngines().length) {
    runMirror({ kind: "FULL", company: clip(d.podjetje, 120) || name, city, category, customerId: customer.id }, null).catch(() => {
      /* budget reached or AI unavailable — the seller can run it by hand */
    });
  }
  return reply(true, "Hvala, oglasili se bomo v enem delovnem dnevu.");
}
