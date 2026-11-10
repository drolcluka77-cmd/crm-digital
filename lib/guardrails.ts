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

export type GuardrailIssue = { name: string; discount: number; max: number };

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
  return { needsApproval: issues.length > 0, issues };
}

export function describeIssues(issues: GuardrailIssue[]): string {
  return issues.map((i) => `${i.name}: ${i.discount}% off (limit ${i.max}%)`).join("; ");
}
