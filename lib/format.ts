import { BILLINGS, BILLING_ANNUAL_FACTOR, BILLING_SUFFIX } from "@/lib/constants";

export { LEAD_STATUS_LABEL, QUOTE_STATUS_LABEL } from "@/lib/constants";

export function formatMoney(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("sl-SI", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** "€49,00 / month" */
export function formatPrice(amount: number, billing: string, unitLabel?: string | null): string {
  return `${formatMoney(amount)}${BILLING_SUFFIX[billing] || ""}${unitLabel ? ` ${unitLabel}` : ""}`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("sl-SI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** yyyy-mm-dd for <input type="date">. */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}

/** "today", "tomorrow", "in 3 days", "2 days overdue" for follow-up dates. */
export function followUpLabel(date: Date | string): { text: string; overdue: boolean; today: boolean } {
  const d = typeof date === "string" ? new Date(date) : date;
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(d) - startOf(new Date())) / 86_400_000);
  if (diffDays === 0) return { text: "today", overdue: false, today: true };
  if (diffDays === 1) return { text: "tomorrow", overdue: false, today: false };
  if (diffDays > 1) return { text: `in ${diffDays} days`, overdue: false, today: false };
  if (diffDays === -1) return { text: "1 day overdue", overdue: true, today: false };
  return { text: `${-diffDays} days overdue`, overdue: true, today: false };
}

export type QuoteTotals = {
  subtotal: number;
  discountAmount: number;
  taxable: number;
  vatAmount: number;
  total: number;
};

export function computeQuoteTotals(
  items: { quantity: number; unitPrice: number }[],
  discountPercent: number,
  vatRatePercent: number
): QuoteTotals {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const discountAmount = subtotal * (discountPercent / 100);
  const taxable = subtotal - discountAmount;
  const vatAmount = taxable * (vatRatePercent / 100);
  const total = taxable + vatAmount;
  return { subtotal, discountAmount, taxable, vatAmount, total };
}

type BillableItem = {
  quantity: number;
  unitPrice: number;
  billing?: string | null;
  commissionRate?: number | null;
};

export type QuoteBreakdown = {
  /** One totals block per billing period present on the quote. */
  groups: (QuoteTotals & { billing: string })[];
  /** First-year value excl. VAT (one-time + 12× monthly + yearly), after discount. */
  annualNet: number;
  /** Seller commission on the first-year net value. */
  commission: number;
};

/**
 * Digital products mix one-time fees with monthly/yearly subscriptions, so
 * a quote is totalled per billing period. `annualNet` is the single number
 * used for pipeline value, rankings and commission.
 */
export function computeQuoteBreakdown(
  items: BillableItem[],
  discountPercent: number,
  vatRatePercent: number
): QuoteBreakdown {
  const groups = BILLINGS.map((billing) => {
    const lines = items.filter((i) => (i.billing || "ONE_TIME") === billing);
    if (lines.length === 0) return null;
    return { billing, ...computeQuoteTotals(lines, discountPercent, vatRatePercent) };
  }).filter(Boolean) as (QuoteTotals & { billing: string })[];

  const factor = 1 - discountPercent / 100;
  let annualNet = 0;
  let commission = 0;
  for (const i of items) {
    const lineAnnual =
      i.quantity * i.unitPrice * factor * (BILLING_ANNUAL_FACTOR[i.billing || "ONE_TIME"] ?? 1);
    annualNet += lineAnnual;
    commission += lineAnnual * ((i.commissionRate || 0) / 100);
  }
  return { groups, annualNet, commission };
}

/** Normalise an optional URL typed by a user ("example.com" → "https://example.com"). */
export function normalizeUrl(raw: string | null | undefined): string | null {
  const v = (raw || "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://${v}`;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Where the "Open" button of a material goes for a signed-in user. */
export function materialHref(m: { id: string; fileName: string | null; linkUrl: string | null }): string {
  return m.fileName ? `/api/materials/${m.id}` : m.linkUrl || "#";
}
