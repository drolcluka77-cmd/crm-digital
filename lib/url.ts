import { headers } from "next/headers";

/**
 * The app's public base URL, used in links emailed to clients.
 * Set APP_URL (e.g. https://crm.yourcompany.com) in production; otherwise
 * it's worked out from the current request.
 */
export function getBaseUrl(): string {
  const fromEnv = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const h = headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
