"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import CsvImport from "@/components/CsvImport";
import { SearchIcon, TrashIcon } from "@/components/icons";
import { assignLeads, importToPool, deletePoolLeads, deletePool } from "../actions";

type Lead = {
  id: string;
  name: string;
  company: string | null;
  segment: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
};

export default function PoolLeads({
  poolId,
  leads,
  sellers,
}: {
  poolId: string;
  leads: Lead[];
  sellers: { id: string; name: string; leads: number }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.company, l.segment, l.city, l.email].filter(Boolean).some((v) => v!.toLowerCase().includes(q))
    );
  }, [leads, query]);

  const toggle = (set: Set<string>, id: string) => {
    const n = new Set(set);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  };

  async function assign() {
    setBusy(true);
    setMsg(null);
    const result = await assignLeads(poolId, Array.from(selected), Array.from(targets));
    setBusy(false);
    setMsg(result || null);
    if (!result || !result.error) setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px]">
            <SearchIcon className="h-4 w-4 text-black/30 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by city, segment…" className="input pl-9 py-2" />
          </div>
          <button
            className="btn-ghost"
            onClick={() => setSelected(new Set(filtered.map((l) => l.id)))}
            disabled={filtered.length === 0}
          >
            Select {query ? "filtered" : "all"} ({filtered.length})
          </button>
          {selected.size > 0 && (
            <button className="btn-ghost" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          )}
          <CsvImport
            onImport={(rows) => importToPool(poolId, rows)}
            hint="Leads go into this pool unassigned. Contacts whose email is already in the CRM are skipped."
          />
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40 border-b border-black/5">
                <th className="px-4 py-3 w-8" />
                <th className="px-2 py-3 font-medium">Lead</th>
                <th className="px-2 py-3 font-medium">Segment</th>
                <th className="px-2 py-3 font-medium">City</th>
                <th className="px-4 py-3 font-medium">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {filtered.map((l) => (
                <tr key={l.id} className={selected.has(l.id) ? "bg-brand-50/50" : ""}>
                  <td className="px-4 py-2.5">
                    <input type="checkbox" checked={selected.has(l.id)} onChange={() => setSelected((s) => toggle(s, l.id))} />
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="font-medium">{l.company || l.name}</div>
                    {l.company && <div className="text-xs text-black/45">{l.name}</div>}
                  </td>
                  <td className="px-2 py-2.5 text-black/55">{l.segment}</td>
                  <td className="px-2 py-2.5 text-black/55">{l.city}</td>
                  <td className="px-4 py-2.5 text-xs text-black/50">{l.email || l.phone}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-black/40">
                    {leads.length === 0 ? "No unassigned leads. Import a CSV to fill the pool." : "Nothing matches."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <div className="card p-5 lg:sticky lg:top-6">
          <div className="font-semibold mb-1">Hand out {selected.size || ""} lead{selected.size === 1 ? "" : "s"}</div>
          <p className="text-xs text-black/45 mb-3">
            Pick one seller, or several to share them out evenly. Each seller gets a notification.
          </p>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {sellers.map((s) => (
              <label key={s.id} className="flex items-center gap-2.5 rounded-xl border border-black/10 px-3 py-2 text-sm cursor-pointer has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/60">
                <input type="checkbox" checked={targets.has(s.id)} onChange={() => setTargets((t) => toggle(t, s.id))} />
                <span className="flex-1">{s.name}</span>
                <span className="text-xs text-black/40">{s.leads} customers</span>
              </label>
            ))}
            {sellers.length === 0 && <div className="text-sm text-black/40">No sellers on this team yet.</div>}
          </div>
          {msg?.error && <div className="error-box mt-3">{msg.error}</div>}
          {msg?.success && <div className="success-box mt-3">{msg.success}</div>}
          <button className="btn-primary w-full mt-3" disabled={busy || selected.size === 0 || targets.size === 0} onClick={assign}>
            {busy
              ? "Assigning…"
              : targets.size > 1
                ? `Share ${selected.size} among ${targets.size} sellers`
                : "Assign"}
          </button>
          {selected.size > 0 && (
            <button
              className="btn-danger w-full justify-center mt-2"
              onClick={async () => {
                if (!confirm(`Delete ${selected.size} selected leads?`)) return;
                setMsg((await deletePoolLeads(poolId, Array.from(selected))) || null);
                setSelected(new Set());
                router.refresh();
              }}
            >
              <TrashIcon className="h-4 w-4" /> Delete selected
            </button>
          )}
        </div>
        <button
          className="text-xs text-black/40 hover:text-rose-600"
          onClick={async () => {
            if (!confirm("Delete this pool and its unassigned leads? Leads already handed out stay with their sellers.")) return;
            await deletePool(poolId);
          }}
        >
          Delete pool
        </button>
      </div>
    </div>
  );
}
