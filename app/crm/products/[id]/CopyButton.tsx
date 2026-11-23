"use client";

import { useState } from "react";
import { useT } from "@/components/LocaleProvider";

export default function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="text-xs text-brand-600 hover:underline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard blocked — ignore
        }
      }}
    >
      {copied ? t("Copied") : t("Copy")}
    </button>
  );
}
