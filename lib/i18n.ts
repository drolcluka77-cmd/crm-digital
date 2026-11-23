import { SL } from "@/lib/i18n-sl";

/**
 * Seller-side translations. Text is written in English in the code and
 * looked up here by that English text; anything missing falls back to
 * English. {name} placeholders are filled from `vars`.
 */
export type Locale = "sl" | "en";
export const LOCALES: { value: Locale; label: string }[] = [
  { value: "sl", label: "Slovenščina" },
  { value: "en", label: "English" },
];

export type TFunc = (text: string | null | undefined, vars?: Record<string, string | number>) => string;

export function makeT(locale: Locale): TFunc {
  return (text, vars) => {
    if (text == null) return "";
    const key = String(text);
    let out = locale === "sl" ? SL[key] ?? SL[key.trim()] ?? key : key;
    // Keep the source's leading/trailing spaces (JSX text around {values}).
    if (locale === "sl" && out !== key && key.trim() !== key) {
      const lead = key.match(/^\s*/)![0];
      const trail = key.match(/\s*$/)![0];
      out = lead + out.trim() + trail;
    }
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    return out;
  };
}
