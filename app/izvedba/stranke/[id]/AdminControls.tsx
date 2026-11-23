"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignAssistant, cancelGeoClient, setGeoStatus } from "@/lib/geo-actions";
import { GEO_STATUSES, GEO_STATUS_LABEL } from "@/lib/geo-labels";

export default function AdminControls({
  clientId,
  status,
  assistantId,
  assistants,
}: {
  clientId: string;
  status: string;
  assistantId: string | null;
  assistants: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  async function run(fn: () => Promise<any>) {
    setBusy(true);
    setMsg(null);
    const r = await fn();
    setBusy(false);
    setMsg(r || null);
    router.refresh();
  }
  return (
    <div className="card p-4 space-y-2 text-sm w-full sm:w-80">
      <div className="text-xs uppercase tracking-wide text-black/40">Administrator</div>
      <label className="block">
        <span className="label">GEO asistent</span>
        <select
          className="input py-1.5"
          value={assistantId || ""}
          disabled={busy || status === "DRAFT"}
          onChange={(e) => e.target.value && run(() => assignAssistant(clientId, e.target.value))}
        >
          <option value="">{status === "DRAFT" ? "predaja še ni oddana" : "Dodeli …"}</option>
          {assistants.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="label">Status (ročno)</span>
        <select
          className="input py-1.5"
          value={status}
          disabled={busy}
          onChange={(e) => {
            if (e.target.value === "CANCELLED") {
              if (confirm("Stranka je odpovedala? Naloge se ustavijo po 60-dnevnem odpovednem roku.")) run(() => cancelGeoClient(clientId));
            } else run(() => setGeoStatus(clientId, e.target.value));
          }}
        >
          {GEO_STATUSES.map((s) => (
            <option key={s} value={s}>
              {GEO_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {msg?.error && <div className="text-rose-600">{msg.error}</div>}
      {msg?.success && <div className="text-emerald-700">{msg.success}</div>}
    </div>
  );
}
