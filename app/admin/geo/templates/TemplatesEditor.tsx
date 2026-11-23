"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteGeoTemplate, saveGeoTemplate } from "@/lib/geo-actions";
import { GEO_PHASES, GEO_PHASE_LABEL, GEO_TEMPLATE_GROUPS, GEO_TEMPLATE_GROUP_LABEL } from "@/lib/geo-labels";

type T = {
  id: string;
  key: string | null;
  packages: string[];
  title: string;
  description: string | null;
  phase: string;
  dueDay: number;
  needsApproval: boolean;
  technical: boolean;
  active: boolean;
  sortOrder: number;
};

const blank: T = {
  id: "",
  key: null,
  packages: ["VISIBLE", "RECOMMENDED", "CONCIERGE"],
  title: "",
  description: "",
  phase: "MONTHLY",
  dueDay: 15,
  needsApproval: false,
  technical: false,
  active: true,
  sortOrder: 999,
};

function Editor({ t, onDone }: { t: T; onDone: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  return (
    <form
      className="grid sm:grid-cols-4 gap-3 p-4 bg-sand-50 rounded-xl"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await saveGeoTemplate(new FormData(e.currentTarget));
        setBusy(false);
        setMsg(r || null);
        if (r && !r.error) {
          router.refresh();
          onDone();
        }
      }}
    >
      <input type="hidden" name="id" value={t.id} />
      <input type="hidden" name="sortOrder" value={t.sortOrder} />
      <label className="sm:col-span-4 text-sm">
        <span className="label">Title</span>
        <input name="title" defaultValue={t.title} className="input" />
      </label>
      <label className="sm:col-span-4 text-sm">
        <span className="label">Steps (one per line)</span>
        <textarea name="description" defaultValue={t.description || ""} rows={3} className="input" />
      </label>
      <label className="text-sm">
        <span className="label">Phase</span>
        <select name="phase" defaultValue={t.phase} className="input">
          {GEO_PHASES.map((p) => (
            <option key={p} value={p}>
              {GEO_PHASE_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="label">Due (days after start / day of month)</span>
        <input name="dueDay" type="number" min={0} defaultValue={t.dueDay} className="input" />
      </label>
      <div className="sm:col-span-2 flex flex-wrap items-end gap-4 text-sm pb-2">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="needsApproval" defaultChecked={t.needsApproval} /> Needs approval
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="technical" defaultChecked={t.technical} /> Technical
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={t.active} /> Active
        </label>
      </div>
      <div className="sm:col-span-4 text-sm">
        <span className="label">Applies to</span>
        <div className="flex flex-wrap gap-3 mt-1">
          {GEO_TEMPLATE_GROUPS.map((g) => (
            <label key={g} className="flex items-center gap-1.5">
              <input type="checkbox" name="packages" value={g} defaultChecked={t.packages.includes(g)} />
              {GEO_TEMPLATE_GROUP_LABEL[g]}
            </label>
          ))}
        </div>
      </div>
      <div className="sm:col-span-4 flex flex-wrap items-center gap-2">
        <button className="btn-primary py-1.5" disabled={busy}>
          Save
        </button>
        <button type="button" className="btn-ghost py-1.5" onClick={onDone}>
          Cancel
        </button>
        {t.id && !t.key && (
          <button
            type="button"
            className="btn-ghost py-1.5 text-rose-600 ml-auto"
            onClick={async () => {
              if (!confirm("Delete this template? Existing tasks stay.")) return;
              await deleteGeoTemplate(t.id);
              router.refresh();
              onDone();
            }}
          >
            Delete
          </button>
        )}
        {msg?.error && <span className="text-sm text-rose-600">{msg.error}</span>}
      </div>
      {t.key && <p className="sm:col-span-4 text-xs text-black/40">Built-in step (“{t.key}”) — the CRM closes it automatically; it can be edited or deactivated, not deleted.</p>}
    </form>
  );
}

export default function TemplatesEditor({ rows }: { rows: T[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [group, setGroup] = useState("ALL");
  const list = rows.filter((r) => group === "ALL" || r.packages.includes(group));
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        {["ALL", ...GEO_TEMPLATE_GROUPS].map((g) => (
          <button key={g} className={group === g ? "chip-active" : "chip"} onClick={() => setGroup(g)}>
            {g === "ALL" ? "All" : GEO_TEMPLATE_GROUP_LABEL[g]}
          </button>
        ))}
        <button className="btn-primary py-1.5 ml-auto" onClick={() => setEditing("new")}>
          + New template
        </button>
      </div>
      {editing === "new" && (
        <div className="card p-3 mb-4">
          <Editor t={blank} onDone={() => setEditing(null)} />
        </div>
      )}
      <div className="card divide-y divide-black/5">
        {list.map((t) => (
          <div key={t.id} className="px-4 py-3">
            {editing === t.id ? (
              <Editor t={t} onDone={() => setEditing(null)} />
            ) : (
              <button className="w-full text-left" onClick={() => setEditing(t.id)}>
                <div className={`text-sm font-medium ${t.active ? "" : "line-through text-black/40"}`}>
                  {t.title}
                  {t.technical && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">technical</span>}
                  {t.needsApproval && <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">approval</span>}
                </div>
                <div className="text-xs text-black/45 mt-0.5">
                  {GEO_PHASE_LABEL[t.phase]} ·{" "}
                  {t.phase === "MONTHLY" || t.phase === "QUARTERLY" ? (t.dueDay ? `day ${t.dueDay} of month` : "last day of month") : `day ${t.dueDay}`} ·{" "}
                  {t.packages.map((p) => GEO_TEMPLATE_GROUP_LABEL[p] || p).join(", ")}
                </div>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
