"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteWorkLog, saveWorkLog } from "./actions";

type Counts = { calls: number; emails: number; meetings: number; leadsClaimed: number };
type Entry = {
  id: string;
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

export default function TimesheetClient({
  today,
  month,
  counts,
  entries,
}: {
  today: string;
  month: string;
  counts: Record<string, Counts>;
  entries: Entry[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Entry | null>(null);
  const [day, setDay] = useState(today);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const crm = counts[day];

  const totals = useMemo(
    () =>
      entries.reduce(
        (t, e) => ({
          minutes: t.minutes + e.minutes,
          calls: t.calls + e.calls,
          conversations: t.conversations + e.conversations,
          meetings: t.meetings + e.meetings,
          emails: t.emails + e.emails,
          days: t.days.add(e.day),
        }),
        { minutes: 0, calls: 0, conversations: 0, meetings: 0, emails: 0, days: new Set<string>() }
      ),
    [entries]
  );

  const formKey = editing ? editing.id : `new-${day}-${crm?.calls ?? 0}`;
  const v = editing || {
    startTime: "09:00",
    endTime: "13:00",
    breakMinutes: 0,
    calls: crm?.calls ?? 0,
    conversations: 0,
    meetings: crm?.meetings ?? 0,
    emails: crm?.emails ?? 0,
    notes: "",
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Timesheet</h1>
        <p className="text-black/50 text-sm mt-1">
          Log your hours and what you did each day you work. Calls, e-mails and meetings are filled in from what you
          logged in the CRM — correct them if needed.
        </p>
      </div>

      <form
        key={formKey}
        className="card p-5 mb-6 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setMsg(null);
          const r = await saveWorkLog(new FormData(e.currentTarget));
          setBusy(false);
          setMsg(r || null);
          if (!r?.error) setEditing(null);
          router.refresh();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-medium">{editing ? `Edit ${dayLabel(editing.day)}` : "Log a day"}</div>
          {editing && (
            <button type="button" className="text-sm text-black/45" onClick={() => setEditing(null)}>
              Cancel editing
            </button>
          )}
        </div>
        {editing && <input type="hidden" name="id" value={editing.id} />}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="text-sm">
            <span className="label">Date</span>
            <input
              type="date"
              name="day"
              className="input"
              max={today}
              defaultValue={editing ? editing.day : day}
              readOnly={!!editing}
              onChange={(e) => !editing && setDay(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="label">From</span>
            <input type="time" name="startTime" className="input" defaultValue={v.startTime} required />
          </label>
          <label className="text-sm">
            <span className="label">To</span>
            <input type="time" name="endTime" className="input" defaultValue={v.endTime} required />
          </label>
          <label className="text-sm">
            <span className="label">Break (min)</span>
            <input type="number" name="breakMinutes" min={0} max={240} className="input" defaultValue={v.breakMinutes} />
          </label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="text-sm">
            <span className="label">Calls made</span>
            <input type="number" name="calls" min={0} className="input" defaultValue={v.calls} />
          </label>
          <label className="text-sm">
            <span className="label">Reached decision maker</span>
            <input type="number" name="conversations" min={0} className="input" defaultValue={v.conversations} />
          </label>
          <label className="text-sm">
            <span className="label">Meetings booked</span>
            <input type="number" name="meetings" min={0} className="input" defaultValue={v.meetings} />
          </label>
          <label className="text-sm">
            <span className="label">E-mails sent</span>
            <input type="number" name="emails" min={0} className="input" defaultValue={v.emails} />
          </label>
        </div>
        {!editing && crm && (
          <div className="text-xs text-black/45">
            Logged in the CRM on this day: {crm.calls} calls · {crm.emails} e-mails · {crm.meetings} meetings booked ·{" "}
            {crm.leadsClaimed} leads claimed
          </div>
        )}
        <label className="text-sm block">
          <span className="label">What did you do?</span>
          <textarea
            name="notes"
            rows={4}
            className="input"
            defaultValue={v.notes}
            placeholder="e.g. Called dentists in Ljubljana (Picked), 2 interested — sent the AI report e-mail; booked a meeting with Zobna ordinacija X for Thursday 10:00."
            required
          />
        </label>
        {msg?.error && <div className="error-box">{msg.error}</div>}
        {msg?.success && <div className="success-box">{msg.success}</div>}
        <button className="btn-primary" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Save day"}
        </button>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <button className="btn-secondary py-1" onClick={() => router.push(`/crm/timesheet?m=${shiftMonth(month, -1)}`)}>
            ←
          </button>
          <div className="font-semibold">
            {new Date(`${month}-15T12:00:00`).toLocaleDateString("sl-SI", { month: "long", year: "numeric" })}
          </div>
          <button className="btn-secondary py-1" onClick={() => router.push(`/crm/timesheet?m=${shiftMonth(month, 1)}`)}>
            →
          </button>
        </div>
        <div className="text-sm text-black/60">
          <b>{hours(totals.minutes)} h</b> in {totals.days.size} day{totals.days.size === 1 ? "" : "s"} · {totals.calls} calls ·{" "}
          {totals.meetings} meetings
          {totals.minutes > 0 ? ` · ${(totals.calls / (totals.minutes / 60)).toFixed(1)} calls/h` : ""}
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="card p-8 text-center text-sm text-black/40">Nothing logged this month yet.</div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => {
            const c = counts[e.day];
            return (
              <div key={e.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {dayLabel(e.day)} · {e.startTime}–{e.endTime}
                      {e.breakMinutes ? ` (break ${e.breakMinutes} min)` : ""} · <b>{hours(e.minutes)} h</b>
                    </div>
                    <div className="text-sm text-black/60 mt-0.5">
                      {e.calls} calls · {e.conversations} reached · {e.meetings} meetings · {e.emails} e-mails
                      {c ? (
                        <span className="text-black/40">
                          {" "}
                          (CRM: {c.calls} calls, {c.meetings} meetings)
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.approved ? (
                      <span className="text-xs rounded-full bg-emerald-50 text-emerald-700 px-2.5 py-1">
                        Approved{e.approvedBy ? ` by ${e.approvedBy}` : ""}
                      </span>
                    ) : (
                      <>
                        <button className="text-sm text-brand-700 hover:underline" onClick={() => { setEditing(e); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                          Edit
                        </button>
                        <button
                          className="text-sm text-black/40 hover:text-rose-700"
                          onClick={async () => {
                            if (!confirm("Delete this day?")) return;
                            const r = await deleteWorkLog(e.id);
                            setMsg(r || null);
                            router.refresh();
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-sm text-black/75 mt-2 whitespace-pre-wrap">{e.notes}</div>
                {e.managerNote && <div className="text-xs mt-2 rounded-lg bg-amber-50 text-amber-800 px-3 py-2">Manager: {e.managerNote}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
