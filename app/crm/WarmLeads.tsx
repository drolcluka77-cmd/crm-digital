"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { acceptWarm, passWarm } from "@/app/crm/customers/actions";
import { useT } from "@/components/LocaleProvider";

type Lead = {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  product: string | null;
  ugc: boolean;
  freeMonth: boolean;
  deadline: string;
};

function left(deadline: string) {
  const h = Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 3_600_000));
  return h >= 24 ? `${Math.floor(h / 24)} d ${h % 24} h left` : `${h} h left`;
}

/** Warm leads offered to this seller, waiting to be accepted. Shown at the top of Today. */
export default function WarmLeads({ leads }: { leads: Lead[] }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  if (leads.length === 0 && !msg) return null;

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    const r = await fn();
    setMsg(r || null);
    setBusy(null);
    router.refresh();
  };

  return (
    <div className="card border-2 border-orange-200 mb-6">
      <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
        <div className="font-semibold">{t("🔥 Warm leads for you (")}{leads.length})</div>
        <span className="text-xs text-black/45">{t("They signed up on the website — accept and call today.")}</span>
      </div>
      {msg && <div className={`${msg.error ? "error-box" : "success-box"} m-4`}>{msg.error || msg.success}</div>}
      <div className="divide-y divide-black/5">
        {leads.map((l) => (
          <div key={l.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-sm">
            <Link href={`/crm/customers/${l.id}`} className="min-w-0 hover:underline">
              <span className="font-medium">{l.company || l.name}</span>
              <span className="block text-xs text-black/45">
                {[l.product, l.ugc ? "via UGC video" : "website", l.freeMonth && "1st month free (code)", l.phone].filter(Boolean).join(" · ")}
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-700">{left(l.deadline)}</span>
              <button className="btn-primary !py-1.5 text-xs" disabled={!!busy} onClick={() => run(l.id, () => acceptWarm(l.id))}>
                {t("Accept")}
              </button>
              <button
                className="btn-ghost !py-1.5 text-xs"
                disabled={!!busy}
                onClick={() => confirm("Pass this lead to another seller?") && run(`p${l.id}`, () => passWarm(l.id))}
              >
                {t("Not for me")}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
