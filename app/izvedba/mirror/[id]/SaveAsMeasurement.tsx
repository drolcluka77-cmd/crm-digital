"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveMirrorAsMeasurement } from "@/lib/mirror-actions";

export default function SaveAsMeasurement({ runId, nextMonth, saved }: { runId: string; nextMonth: number; saved: boolean }) {
  const router = useRouter();
  const [month, setMonth] = useState(nextMonth);
  const [ranks, setRanks] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  if (saved) return <div className="card p-4 text-sm text-emerald-700">✓ Shranjeno kot meritev.</div>;
  return (
    <div className="card p-4 flex flex-wrap items-center gap-3 text-sm">
      <span>Shrani kot meritev za mesec</span>
      <input type="number" min={0} value={month} onChange={(e) => setMonth(Number(e.target.value))} className="input w-20 py-1" />
      <span className="text-black/45">{month === 0 ? "(izhodišče)" : ""}</span>
      <button
        className="btn-primary py-1.5"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await saveMirrorAsMeasurement(runId, month, ranks);
          setBusy(false);
          setMsg(r);
          if (!r.error) router.refresh();
        }}
      >
        {busy ? "Shranjujem …" : "Shrani"}
      </button>
      <span className="text-xs text-black/45">Napačni podatki postanejo naloge.</span>
      <label className="w-full">
        <span className="label">Mesta na Google Zemljevidih (neobvezno) — »iskanje | mesto« v vsaki vrstici</span>
        <textarea value={ranks} onChange={(e) => setRanks(e.target.value)} rows={3} className="input font-mono text-[13px]" placeholder={"gostilna kamnik | 3"} />
      </label>
      {msg?.error && <span className="text-rose-600">{msg.error}</span>}
    </div>
  );
}
