"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateGeoTask, returnGeoTask } from "@/lib/geo-actions";
import { GEO_PHASE_LABEL, GEO_TASK_STATUS_LABEL, fmtDay } from "@/lib/geo-labels";

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  phase: string;
  dueDate: string | null;
  status: string;
  note: string | null;
  needsApproval: boolean;
  technical: boolean;
  clientId: string;
  company?: string;
  assignee?: string | null;
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: "bg-slate-100 text-slate-600",
  IN_PROGRESS: "bg-sky-100 text-sky-700",
  WAITING_CLIENT: "bg-amber-100 text-amber-700",
  WAITING_APPROVAL: "bg-violet-100 text-violet-700",
  DONE: "bg-emerald-100 text-emerald-700",
  NOT_POSSIBLE: "bg-black/5 text-black/45",
};


function Row({ t, isAdmin, showClient }: { t: TaskRow; isAdmin: boolean; showClient: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(t.note || "");
  const [err, setErr] = useState<string | null>(null);
  const overdue = t.dueDate && new Date(t.dueDate) < new Date() && !["DONE", "NOT_POSSIBLE", "WAITING_APPROVAL"].includes(t.status);

  async function set(status: string) {
    setBusy(true);
    setErr(null);
    const r = await updateGeoTask(t.id, status, note);
    setBusy(false);
    if (r?.error) setErr(r.error);
    else router.refresh();
  }
  async function sendBack() {
    if (!note.trim()) return setErr("Napiši, kaj je treba popraviti.");
    setBusy(true);
    const r = await returnGeoTask(t.id, note);
    setBusy(false);
    if (r?.error) setErr(r.error);
    else router.refresh();
  }

  const done = t.status === "DONE" || t.status === "NOT_POSSIBLE";
  return (
    <li className={`px-4 py-3 ${done ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start gap-3">
        <button className="flex-1 min-w-[220px] text-left" onClick={() => setOpen((o) => !o)}>
          <div className="text-sm font-medium leading-snug">
            {t.title}
            {t.technical && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 align-middle">tehnično</span>}
            {t.needsApproval && <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 align-middle">potrditev</span>}
          </div>
          <div className="text-xs text-black/45 mt-0.5">
            {showClient && t.company ? (
              <>
                <Link href={`/izvedba/stranke/${t.clientId}?tab=naloge`} className="text-brand-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                  {t.company}
                </Link>
                {" · "}
              </>
            ) : null}
            {GEO_PHASE_LABEL[t.phase] || t.phase} · rok <span className={overdue ? "text-rose-600 font-medium" : ""}>{fmtDay(t.dueDate)}</span>
            {t.assignee && isAdmin ? ` · ${t.assignee}` : ""}
          </div>
          {t.note && !open && <div className="text-xs text-black/55 mt-1 italic">{t.note}</div>}
        </button>
        <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${STATUS_STYLE[t.status] || ""}`}>{GEO_TASK_STATUS_LABEL[t.status] || t.status}</span>
      </div>
      {open && (
        <div className="mt-3 pl-0 sm:pl-2 space-y-3">
          {t.description && (
            <ul className="text-sm text-black/65 space-y-1 list-disc pl-5">
              {t.description.split("\n").filter(Boolean).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
          <textarea
            className="input text-sm"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Opomba (npr. kaj čakamo od stranke, zakaj ni izvedljivo)"
          />
          {err && <div className="error-box text-sm">{err}</div>}
          <div className="flex flex-wrap gap-2">
            {t.status === "WAITING_APPROVAL" && isAdmin ? (
              <>
                <button className="btn-primary py-1.5" disabled={busy} onClick={() => set("DONE")}>
                  Potrdi
                </button>
                <button className="btn-secondary py-1.5" disabled={busy} onClick={sendBack}>
                  Vrni v delo
                </button>
              </>
            ) : (
              <>
                {!done && t.status !== "WAITING_APPROVAL" && (
                  <button className="btn-primary py-1.5" disabled={busy} onClick={() => set("DONE")}>
                    {t.needsApproval && !isAdmin ? "Končano — pošlji v potrditev" : "Končano"}
                  </button>
                )}
                {t.status !== "IN_PROGRESS" && (
                  <button className="btn-secondary py-1.5" disabled={busy} onClick={() => set("IN_PROGRESS")}>
                    {done ? "Ponovno odpri" : "V delu"}
                  </button>
                )}
                {!done && t.status !== "WAITING_CLIENT" && (
                  <button className="btn-secondary py-1.5" disabled={busy} onClick={() => set("WAITING_CLIENT")}>
                    Čaka stranko
                  </button>
                )}
                {!done && (
                  <button className="btn-ghost py-1.5" disabled={busy} onClick={() => set("NOT_POSSIBLE")}>
                    Ni izvedljivo
                  </button>
                )}
                {t.note !== note && (
                  <button className="btn-ghost py-1.5" disabled={busy} onClick={() => set(t.status)}>
                    Shrani opombo
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export default function TaskList({
  tasks,
  isAdmin,
  showClient = true,
  empty = "Ni nalog.",
}: {
  tasks: TaskRow[];
  isAdmin: boolean;
  showClient?: boolean;
  empty?: string;
}) {
  if (!tasks.length) return <div className="px-4 py-6 text-sm text-black/40 text-center">{empty}</div>;
  return (
    <ul className="divide-y divide-black/5">
      {tasks.map((t) => (
        <Row key={t.id} t={t} isAdmin={isAdmin} showClient={showClient} />
      ))}
    </ul>
  );
}
