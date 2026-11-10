/** Client- and server-safe placeholder filling for email templates. */
export type TemplateVars = {
  firstName?: string;
  name?: string;
  company?: string;
  product?: string;
  demoLink?: string;
  bookingLink?: string;
  sellerName?: string;
  sellerPhone?: string;
};

/**
 * Replaces {{placeholders}}. Unknown or empty ones are left as-is when
 * `keepMissing` is set (so the seller sees what still needs filling in),
 * otherwise removed.
 */
export function fillTemplate(text: string, vars: TemplateVars, keepMissing = true): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const v = (vars as Record<string, string | undefined>)[key];
    if (v) return v;
    return keepMissing ? match : "";
  });
}
