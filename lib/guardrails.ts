/**
 * Price guardrails (client- and server-safe).
 *
 * A line's effective discount is measured against the plan's list price,
 * so lowering the unit price counts the same as raising the % discount:
 *   effective = 1 − unitPrice × (1 − quoteDiscount) ÷ listPrice
 */
export type GuardrailLine = {
  productId?: string | null;
  name: string;
  unitPrice: number;
  listPrice?: number | null;
};

export type GuardrailIssue = { name: string; discount: number; max: number; note?: string };

/**
 * Bundle prices: a plan whose name says "paketna cena" / "bundle price" is only valid together with one of the
 * base packages it is tied to (Mr. Picked Recommended or Concierge). Without one, the quote needs approval.
 */
const BUNDLE_PLAN = /paketna cena|bundle price/i;
const BUNDLE_BASE = /recommended|concierge/i;
const LEAD_ENGINE_PLAN = /lead engine/i;

export function checkDiscounts(
  items: GuardrailLine[],
  quoteDiscount: number,
  /** Max discount % for a product (null = no limit). Called with null for custom lines. */
  maxFor: (productId: string | null) => number | null
): { needsApproval: boolean; issues: GuardrailIssue[] } {
  const issues: GuardrailIssue[] = [];
  const d = quoteDiscount / 100;
  for (const i of items) {
    const max = maxFor(i.productId || null);
    if (max === null || max === undefined) continue;
    let effective: number;
    if (i.listPrice && i.listPrice > 0) {
      effective = (1 - (i.unitPrice * (1 - d)) / i.listPrice) * 100;
    } else {
      effective = quoteDiscount;
    }
    if (effective > max + 0.01) {
      issues.push({ name: i.name, discount: Math.round(effective * 10) / 10, max });
    }
  }
  if (items.some((i) => BUNDLE_PLAN.test(i.name)) && !items.some((i) => BUNDLE_BASE.test(i.name) && !BUNDLE_PLAN.test(i.name))) {
    for (const i of items.filter((x) => BUNDLE_PLAN.test(x.name)))
      issues.push({ name: i.name, discount: 0, max: 0, note: "paketna cena brez paketa Recommended ali Concierge" });
  }
  // Lead Engine is sold only on top of Mr. Picked Recommended or Concierge (an upsell quote without them goes to approval).
  if (items.some((i) => LEAD_ENGINE_PLAN.test(i.name)) && !items.some((i) => BUNDLE_BASE.test(i.name) && !BUNDLE_PLAN.test(i.name))) {
    for (const i of items.filter((x) => LEAD_ENGINE_PLAN.test(x.name)))
      issues.push({ name: i.name, discount: 0, max: 0, note: "Lead Engine samo s paketom Recommended ali Concierge (preveri, ali ga stranka že ima)" });
  }
  return { needsApproval: issues.length > 0, issues };
}

export function describeIssues(issues: GuardrailIssue[]): string {
  return issues.map((i) => (i.note ? `${i.name}: ${i.note}` : `${i.name}: ${i.discount}% off (limit ${i.max}%)`)).join("; ");
}
