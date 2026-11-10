"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { quickUpdateCustomer, scheduleDemo, clearDemo } from "../actions";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/constants";
import { followUpLabel, formatDate, formatDateTime, timeAgo, toDateInput } from "@/lib/format";

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toDateInput(d);
}

export default function StagePanel({
  customerId,
  status,
  nextFollowUpAt,
  lastContactAt,
  demoAt,
}: {
  customerId: string;
  status: string;
  nextFollowUpAt: string | null;
  lastContactAt: string | null;
  demoAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const f = nextFollowUpAt ? followUpLabel(nextFollowUpAt) : null;
  const [demoWhen, setDemoWhen] = useState("");
  const [demoNote, setDemoNote] = useState("");
  const [demoMsg, setDemoMsg] = useState<string | null>(null);
  const demoUpcoming = demoAt && new Date(demoAt).getTime() > Date.now() - 3 * 3600_000;

  async function bookDemo() {
    setBusy(true);
    setDemoMsg(null);
    const result = await scheduleDemo(customerId, demoWhen, demoNote);
    setBusy(false);
    if (result && result.error) return setDemoMsg(result.error);
    setDemoWhen("");
    setDemoNote("");
    router.refresh();
  }

  async function update(patch: { status?: string; nextFollowUpAt?: string | null }) {
    setBusy(true);
    await quickUpdateCustomer(customerId, patch);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card p-5 space-y-4">
      <div>
        <div className="section-title mb-2">Stage</div>
        <select
          className="input"
          value={status}
          disabled={busy}
          onChange={(e) => update({ status: e.target.value })}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="section-title mb-2">Next follow-up</div>
        {f ? (
          <div
            className={`text-sm font-medium mb-2 ${
              f.overdue ? "text-rose-600" : f.today ? "text-amber-600" : "text-ink-900"
            }`}
          >
            {formatDate(nextFollowUpAt!)} · {f.text}
          </div>
        ) : (
          <div className="text-sm text-black/40 mb-2">Not scheduled</div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {[
            ["Tomorrow", 1],
            ["In 3 days", 3],
            ["Next week", 7],
            ["In 2 weeks", 14],
          ].map(([label, days]) => (
            <button
              key={label as string}
              className="chip text-xs px-2.5 py-1"
              disabled={busy}
              onClick={() => update({ nextFollowUpAt: addDays(days as number) })}
            >
              {label}
            </button>
          ))}
          <input
            type="date"
            className="input py-1 px-2 text-xs w-auto"
            value={toDateInput(nextFollowUpAt)}
            disabled={busy}
            onChange={(e) => update({ nextFollowUpAt: e.target.value || null })}
          />
          {nextFollowUpAt && (
            <button className="text-xs text-black/40 hover:text-black/70 px-1" onClick={() => update({ nextFollowUpAt: null })}>
              clear
            </button>
          )}
        </div>
      </div>

      <div>
        <div className="section-title mb-2">Demo</div>
        {demoUpcoming ? (
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="font-medium text-violet-700">📅 {formatDateTime(demoAt!)}</span>
            <button className="text-xs text-black/40 hover:text-black/70" onClick={async () => { await clearDemo(customerId); router.refresh(); }}>
              clear
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="datetime-local"
              className="input py-1.5 text-sm"
              value={demoWhen}
              onChange={(e) => setDemoWhen(e.target.value)}
            />
            {demoWhen && (
              <>
                <input
                  className="input py-1.5 text-sm"
                  placeholder="Note (online / on site, who joins…)"
                  value={demoNote}
                  onChange={(e) => setDemoNote(e.target.value)}
                />
                <button className="btn-primary w-full py-1.5" disabled={busy} onClick={bookDemo}>
                  Schedule demo
                </button>
              </>
            )}
            {demoMsg && <div className="text-xs text-rose-600">{demoMsg}</div>}
          </div>
        )}
      </div>

      <div className="text-xs text-black/40">
        Last contact: {lastContactAt ? timeAgo(lastContactAt) : "never"}
      </div>
    </div>
  );
}
