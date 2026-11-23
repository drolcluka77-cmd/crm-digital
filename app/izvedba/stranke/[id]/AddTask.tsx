"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addGeoTask } from "@/lib/geo-actions";
import { GEO_PHASES, GEO_PHASE_LABEL } from "@/lib/geo-labels";

export default function AddTask({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!open)
    return (
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        + Dodaj nalogo
      </button>
    );
  return (
    <form
      className="card p-4 grid sm:grid-cols-[1fr_160px_150px] gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const r = await addGeoTask(clientId, new FormData(e.currentTarget));
        setBusy(false);
        if (r?.error) return setErr(r.error);
        setOpen(false);
        router.refresh();
      }}
    >
      <input name="title" className="input" placeholder="Naloga" autoFocus />
      <input name="dueDate" type="date" className="input" />
      <select name="phase" className="input" defaultValue="MONTHLY">
        {GEO_PHASES.map((p) => (
          <option key={p} value={p}>
            {GEO_PHASE_LABEL[p]}
          </option>
        ))}
      </select>
      <textarea name="description" className="input sm:col-span-3" rows={2} placeholder="Koraki (vsak v svoji vrstici) — neobvezno" />
      <div className="sm:col-span-3 flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="needsApproval" /> Potrebna potrditev
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="technical" /> Tehnično
        </label>
        <button className="btn-primary py-1.5" disabled={busy}>
          Dodaj
        </button>
        <button type="button" className="text-black/45" onClick={() => setOpen(false)}>
          Prekliči
        </button>
        {err && <span className="text-rose-600">{err}</span>}
      </div>
    </form>
  );
}
