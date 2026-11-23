"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALES } from "@/lib/i18n";
import { useLocale, useT } from "@/components/LocaleProvider";
import { setMyLanguage } from "./actions";

export default function LanguageForm() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="card p-5 mb-5">
      <div className="font-medium mb-1">{t("Language")}</div>
      <p className="text-sm text-black/50 mb-3">{t("The language of your CRM. E-mails to clients are not affected.")}</p>
      <div className="flex flex-wrap gap-2">
        {LOCALES.map((l) => (
          <button
            key={l.value}
            className={locale === l.value ? "chip-active" : "chip"}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await setMyLanguage(l.value);
              setBusy(false);
              router.refresh();
            }}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}
