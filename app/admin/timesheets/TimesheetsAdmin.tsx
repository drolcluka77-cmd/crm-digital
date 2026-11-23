"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { approveWorkLog, approveWorkLogs } from "@/app/crm/timesheet/actions";

type Counts = { calls: number; emails: number; meetings: number; leadsClaimed: number };
type Entry = {
  id: string;
  userId: string;
  userName: string;
  day: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  minutes: number;
  calls: number;
  conversations: number;
  meetings: number;
  emails: number;
  notes: string;
  approved: boolean;
  approvedBy: string | null;
  managerNote: string | null;
};

const hours = (m: number) => (m / 60).toLocaleString("sl-SI", { maximumFractionDigits: 2 });
const dayLabel = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("sl-SI", { weekday: "short", day: "numeric", month: "numeric" });

function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function TimesheetsAdmin({
  month,
  sellerFilter,
  sellers,
  counts,
  entries,
}: {
  month: string;
  sellerFilter: string;
  sellers: { id: string; name: string }[];
  counts: Record<string, Record<string, Counts>>;
  entries: Entry[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const go = (m: string, u: string) => router.push(`/admin/timesheets?m=${m}${u ? `&u=${u}` : ""}`);

  const perSeller = useMemo(() => {
    const map = new Map<string, { name: string; minutes: number; calls: number; meetings: number; days: number; crmCalls: number; crmMeetings: number; open: number }>();
    for (const e of entries) {
      const s = map.get(e.userId) || { name: e.userName, minutes: 0, calls: 0, meetings: 0, days: 0, crmCalls: 0, crmMeetings: 0, open: 0 };
      s.minutes += e.minutes;
      s.calls += e.calls;
      s.meetings += e.meetings;
      s.days++;
      if (!e.approved) s.open++;
      map.set(e.userId, s);
    }
    for (const [id, s] of map) {
      const days = new Set(entries.filter((e) => e.userId === id).map((e) => e.day));
      for (const d of days) {
        s.crmCalls += counts[id]?.[d]?.calls || 0;
        s.crmMeetings += counts[id]?.[d]?.meetings || 0;
      }
    }
    return Array.from(map.entries());
  }, [entries, counts]);

  const unapproved = entries.filter((e) => !e.approved).map((e) => e.id);

  async function run(key: string, fn: () => Promise<any>) {
    setBusy(key);
    const r = await fn();
    setBusy(null);
    setMsg(r || null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Timesheets</h1>
        <p className="text-black/50 text-sm mt-1">
          Hours and work done, as logged by sellers. “CRM” numbers are what they actually logged in the CRM that day —
          a big gap to the reported numbers is worth a question.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button className="btn-secondary py-1" onClick={() => go(shiftMonth(month, -1), sellerFilter)}>←</button>
        <div className="font-semibold min-w-[130px] text-center">
          {new Date(`${month}-15T12:00:00`).toLocaleDateString("sl-SI", { month: "long", year: "numeric" })}
        </div>
        <button className="btn-secondary py-1" onClick={() => go(shiftMonth(month, 1), sellerFilter)}>→</button>
        <select className="input max-w-[220px] ml-2" value={sellerFilter} onChange={(e) => go(month, e.target.value)}>
          <option value="">All sellers</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <span className="flex-1" />
        <a className="btn-secondary" href={`/api/timesheets/csv?m=${month}${sellerFilter ? `&u=${sellerFilter}` : ""}`}>
          Export CSV
        </a>
        {unapproved.length > 0 && (
          <button className="btn-primary" disabled={!!busy} onClick={() => run("all", () => approveWorkLogs(unapproved))}>
            {busy === "all" ? "Approving…" : `Approve all ${unapproved.length}`}
          </button>
        )}
      </div>

      {msg?.error && <div className="error-box mb-4">{msg.error}</div>}
      {msg?.success && <div className="success-box mb-4">{msg.success}</div>}

      {perSeller.length > 0 && (
        <div className="card overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40 border-b border-black/5">
                <th className="px-4 py-2 font-medium">Seller</th>
                <th className="px-3 py-2 font-medium">Hours</th>
                <th className="px-3 py-2 font-medium">Days</th>
                <th className="px-3 py-2 font-medium">Calls (CRM)</th>
                <th className="px-3 py-2 font-medium">Meetings (CRM)</th>
                <th className="px-3 py-2 font-medium">Calls / hour</th>
                <th className="px-3 py-2 font-medium">Hours per meeting</th>
                <th className="px-4 py-2 font-medium">To approve</th>
              </tr>
            </thead>
            <tbody>
              {perSeller.map(([id, s]) => (
                <tr key={id} className="border-b border-black/5 last:border-0">
                  <td className="px-4 py-2 font-medium">{s.name}</td>
                  <td className="px-3 py-2">{hours(s.minutes)} h</td>
                  <td className="px-3 py-2">{s.days}</td>
                  <td className="px-3 py-2">{s.calls} <span className="text-black/40">({s.crmCalls})</span></td>
                  <td className="px-3 py-2">{s.meetings} <span className="text-black/40">({s.crmMeetings})</span></td>
                  <td className="px-3 py-2">{s.minutes ? (s.calls / (s.minutes / 60)).toFixed(1) : "—"}</td>
                  <td className="px-3 py-2">{s.meetings ? hours(Math.round(s.minutes / s.meetings)) : "—"}</td>
                  <td className="px-4 py-2">{s.open || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="card p-8 text-center text-sm text-black/40">Nothing logged this month.</div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const c = counts[e.userId]?.[e.day];
            const gap = c && (e.calls > c.calls * 1.5 + 5 || e.meetings > c.meetings);
            return (
              <div key={e.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {e.userName} · {dayLabel(e.day)} · {e.startTime}–{e.endTime}
                      {e.breakMinutes ? ` (break ${e.breakMinutes} min)` : ""} · <b>{hours(e.minutes)} h</b>
                    </div>
                    <div className="text-sm text-black/60 mt-0.5">
                      Reported: {e.calls} calls · {e.conversations} reached · {e.meetings} meetings · {e.emails} e-mails
                    </div>
                    <div className={`text-xs mt-0.5 ${gap ? "text-amber-700" : "text-black/40"}`}>
                      CRM: {c ? `${c.calls} calls · ${c.emails} e-mails · ${c.meetings} meetings · ${c.leadsClaimed} leads claimed` : "nothing logged that day"}
                      {gap ? " — differs from what was reported" : ""}
                    </div>
                  </div>
                  {e.approved ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1">Approved{e.approvedBy ? ` by ${e.approvedBy}` : ""}</span>
                      <button className="text-xs text-black/40 hover:text-black/70" disabled={!!busy} onClick={() => run(e.id, () => approveWorkLog(e.id, false, ""))}>
                        Undo
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="text-sm text-black/75 mt-2 whitespace-pre-wrap">{e.notes}</div>
                {e.managerNote && <div className="text-xs mt-2 rounded-lg bg-amber-50 text-amber-800 px-3 py-2">Note: {e.managerNote}</div>}
                {!e.approved && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <input
                      className="input flex-1 min-w-[200px] py-1.5"
                      placeholder="Note for the seller (optional)"
                      value={notes[e.id] || ""}
                      onChange={(ev) => setNotes((n) => ({ ...n, [e.id]: ev.target.value }))}
                    />
                    <button className="btn-primary py-1.5" disabled={!!busy} onClick={() => run(e.id, () => approveWorkLog(e.id, true, notes[e.id] || ""))}>
                      Approve
                    </button>
                    {notes[e.id]?.trim() && (
                      <button className="btn-secondary py-1.5" disabled={!!busy} onClick={() => run(e.id, () => approveWorkLog(e.id, false, notes[e.id] || ""))}>
                        Send note only
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
