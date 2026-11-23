"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { assignAssistant, cancelGeoClient, closePilot, setGeoStatus } from "@/lib/geo-actions";
import { LINE_STATUSES, GEO_STATUS_LABEL } from "@/lib/geo-labels";

export default function AdminControls({
  clientId,
  line,
  status,
  assistantId,
  assistants,
}: {
  clientId: string;
  line: string;
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
        <span className="label">{line === "UNBUSYNESS" ? "Forward deployment engineer" : "GEO asistent"}</span>
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
          {(LINE_STATUSES[line] || LINE_STATUSES.PICKED).map((s) => (
            <option key={s} value={s}>
              {GEO_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      {line === "UNBUSYNESS" && status === "REVIEW" && (
        <div className="pt-2 space-y-2 border-t border-black/5">
          <div className="font-medium">Zaključi pilot</div>
          <textarea id="pilot-note" className="input py-1.5" rows={2} placeholder="Rezultat in dogovor (npr. 85 % brez lastnika; nadaljuje od 1. 2. za 120 €/mesec)" />
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary py-1.5"
              disabled={busy}
              onClick={() => run(() => closePilot(clientId, "CONVERTED", (document.getElementById("pilot-note") as HTMLTextAreaElement)?.value || ""))}
            >
              Nadaljuje (plačljivo)
            </button>
            <button
              className="btn-secondary py-1.5"
              disabled={busy}
              onClick={() => run(() => closePilot(clientId, "ENDED", (document.getElementById("pilot-note") as HTMLTextAreaElement)?.value || ""))}
            >
              Konec brez nadaljevanja
            </button>
          </div>
        </div>
      )}
      {msg?.error && <div className="text-rose-600">{msg.error}</div>}
      {msg?.success && <div className="text-emerald-700">{msg.success}</div>}
    </div>
  );
}
