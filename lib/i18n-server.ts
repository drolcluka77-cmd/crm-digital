import { getCurrentUser } from "@/lib/session";
import { makeT, type Locale, type TFunc } from "@/lib/i18n";

/** The current user's language (sellers default to Slovenian; staff screens stay English). */
export async function getLocale(): Promise<Locale> {
  const u = await getCurrentUser();
  return u?.locale === "en" ? "en" : "sl";
}

export async function getT(): Promise<TFunc> {
  return makeT(await getLocale());
}
