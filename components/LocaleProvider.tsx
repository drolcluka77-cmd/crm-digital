"use client";

import { createContext, useContext, useMemo } from "react";
import { makeT, type Locale, type TFunc } from "@/lib/i18n";

const Ctx = createContext<{ locale: Locale; t: TFunc }>({ locale: "en", t: makeT("en") });

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: makeT(locale) }), [locale]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Translate seller-side text: t("Save") → "Shrani" for Slovenian users. */
export function useT(): TFunc {
  return useContext(Ctx).t;
}

export function useLocale(): Locale {
  return useContext(Ctx).locale;
}
