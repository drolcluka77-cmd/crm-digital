import { createHmac, timingSafeEqual } from "crypto";

/**
 * Revolut Merchant API — card payment links for proforma invoices.
 * Set REVOLUT_API_KEY (the Merchant API secret key) to switch it on;
 * REVOLUT_SANDBOX=1 uses the sandbox.
 */

const API_VERSION = "2024-09-01";

export const revolutEnabled = () => !!process.env.REVOLUT_API_KEY?.trim();

const base = () =>
  process.env.REVOLUT_SANDBOX === "1" ? "https://sandbox-merchant.revolut.com" : "https://merchant.revolut.com";

async function call(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${base()}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${process.env.REVOLUT_API_KEY?.trim()}`,
      "Revolut-Api-Version": API_VERSION,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* not JSON */
  }
  if (!res.ok) throw new Error(`Revolut ${res.status}: ${json?.message || json?.code || text.slice(0, 200)}`);
  return json;
}

/** Creates an order and returns its hosted checkout link. */
export async function createRevolutOrder(o: {
  amount: number; // EUR, incl. VAT
  description: string;
  reference: string;
  email: string | null;
  redirectUrl: string;
}): Promise<{ id: string; checkoutUrl: string }> {
  const r = await call("/api/orders", {
    method: "POST",
    body: {
      amount: Math.round(o.amount * 100),
      currency: "EUR",
      description: o.description.slice(0, 1000),
      merchant_order_data: { reference: o.reference },
      ...(o.email ? { customer: { email: o.email } } : {}),
      redirect_url: o.redirectUrl,
    },
  });
  if (!r?.id || !r?.checkout_url) throw new Error("Revolut didn't return a checkout link");
  return { id: r.id, checkoutUrl: r.checkout_url };
}

export async function getRevolutOrder(id: string): Promise<{ id: string; state: string }> {
  const r = await call(`/api/orders/${encodeURIComponent(id)}`);
  return { id: r.id, state: String(r.state || "").toLowerCase() };
}

/** Registers our webhook for completed orders; returns the signing secret. */
export async function registerRevolutWebhook(url: string): Promise<{ id: string; secret: string | null }> {
  const r = await call("/api/1.0/webhooks", { method: "POST", body: { url, events: ["ORDER_COMPLETED", "ORDER_AUTHORISED"] } });
  return { id: r.id, secret: r.signing_secret || null };
}

/** Checks Revolut-Signature (v1=HMAC-SHA256 of "v1.{timestamp}.{raw body}"). */
export function verifyRevolutSignature(raw: string, timestamp: string | null, header: string | null, secret: string): boolean {
  if (!timestamp || !header) return false;
  if (Math.abs(Date.now() - Number(timestamp)) > 5 * 60_000 && Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = "v1=" + createHmac("sha256", secret).update(`v1.${timestamp}.${raw}`).digest("hex");
  return header.split(",").some((sig) => {
    const a = Buffer.from(sig.trim());
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}
