"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { claimLead } from "./actions";

type Pool = {
  id: string;
  name: string;
  description: string | null;
  claimLimit: number | null;
  leads: { id: string; name: string; company: string | null; segment: string | null; city: string | null; size: string | null }[];
};

export default function PoolBrowser({ pools }: { pools: Pool[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);

  async function claim(id: string) {
    setBusy(id);
    setMsg(null);
    const result = await claimLead(id);
    setBusy(null);
    setMsg(result || null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Lead pool</h1>
        <p className="text-black/50 text-sm mt-1">
          Unassigned leads your managers have opened up for claiming. Claim one and it becomes your customer — contact
          details appear once it&apos;s yours.
        </p>
      </div>
      {msg?.error && <div className="error-box mb-4">{msg.error}</div>}
      {msg?.success && (
        <div className="success-box mb-4">
          {msg.success}{" "}
          <Link href="/crm/customers?stage=NEW" className="underline">
            Open your new leads →
          </Link>
        </div>
      )}
      {pools.length === 0 && (
        <div className="card p-10 text-center text-sm text-black/40">No open lead pools right now.</div>
      )}
      <div className="space-y-6">
        {pools.map((p) => (
          <div key={p.id} className="card">
            <div className="px-5 py-4 border-b border-black/5">
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-black/45">
                {p.leads.length} available{p.claimLimit ? ` · max ${p.claimLimit} open per seller` : ""}
                {p.description ? ` · ${p.description}` : ""}
              </div>
            </div>
            <div className="divide-y divide-black/5">
              {p.leads.map((l) => (
                <div key={l.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{l.company || l.name}</div>
                    <div className="text-xs text-black/45">
                      {[l.segment, l.size, l.city].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                  <button className="btn-secondary py-1.5 shrink-0" disabled={busy === l.id} onClick={() => claim(l.id)}>
                    {busy === l.id ? "Claiming…" : "Claim"}
                  </button>
                </div>
              ))}
              {p.leads.length === 0 && <div className="px-5 py-6 text-sm text-black/40 text-center">All taken.</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
