"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addActivity, deleteActivity } from "../actions";
import {
  ACTIVITY_TYPE_LABEL,
  LEAD_STATUSES,
  LEAD_STATUS_LABEL,
  MANUAL_ACTIVITY_TYPES,
} from "@/lib/constants";
import { formatDateTime, timeAgo } from "@/lib/format";
import { TrashIcon } from "@/components/icons";

type Activity = {
  id: string;
  type: string;
  body: string | null;
  userName: string | null;
  mine: boolean;
  createdAt: string;
};

const DOT: Record<string, string> = {
  CALL: "bg-sky-500",
  MEETING: "bg-violet-500",
  DEMO: "bg-indigo-500",
  EMAIL: "bg-brand-500",
  NOTE: "bg-slate-400",
  MATERIALS_SENT: "bg-brand-400",
  MATERIAL_VIEWED: "bg-emerald-500",
  QUOTE_SENT: "bg-sky-600",
  QUOTE_ACCEPTED: "bg-emerald-600",
  QUOTE_REJECTED: "bg-rose-500",
  STATUS_CHANGE: "bg-amber-500",
};

const PLACEHOLDER: Record<string, string> = {
  CALL: "Spoke with… They currently use… Next step…",
  MEETING: "Who was there, what was agreed…",
  DEMO: "What they liked, questions, objections…",
  EMAIL: "Emailed them about…",
  NOTE: "Anything worth remembering…",
};

export default function ActivityPanel({
  customerId,
  currentStatus,
  activities,
}: {
  customerId: string;
  currentStatus: string;
  activities: Activity[];
}) {
  const router = useRouter();
  const [type, setType] = useState<string>("CALL");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  async function handleSubmit(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = await addActivity(fd);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setFormKey((k) => k + 1);
    router.refresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this entry?")) return;
    await deleteActivity(id);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="px-5 pt-5">
        <div className="flex flex-wrap gap-1.5 mb-3">
          {MANUAL_ACTIVITY_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={type === t ? "chip-active text-xs px-3 py-1" : "chip text-xs px-3 py-1"}
            >
              {ACTIVITY_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <form
          key={formKey}
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(new FormData(e.currentTarget));
          }}
        >
          {error && <div className="error-box">{error}</div>}
          <input type="hidden" name="customerId" value={customerId} />
          <input type="hidden" name="type" value={type} />
          <textarea
            name="body"
            required
            className="input min-h-[80px]"
            placeholder={PLACEHOLDER[type]}
          />
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Next follow-up</label>
              <input name="nextFollowUpAt" type="date" className="input py-2" />
            </div>
            <div>
              <label className="label">Move to stage</label>
              <select name="status" defaultValue="" className="input py-2">
                <option value="">— keep {LEAD_STATUS_LABEL[currentStatus]} —</option>
                {LEAD_STATUSES.filter((s) => s !== currentStatus).map((s) => (
                  <option key={s} value={s}>
                    {LEAD_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary ml-auto" disabled={busy}>
              {busy ? "Saving…" : `Log ${ACTIVITY_TYPE_LABEL[type].toLowerCase()}`}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-5 border-t border-black/5 px-5 py-4">
        <div className="section-title mb-3">Timeline</div>
        {activities.length === 0 ? (
          <div className="text-sm text-black/40 py-4 text-center">No activity yet.</div>
        ) : (
          <ol className="relative border-l border-black/10 ml-1.5 space-y-4">
            {activities.map((a) => (
              <li key={a.id} className="pl-5 relative group">
                <span
                  className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                    DOT[a.type] || "bg-slate-400"
                  }`}
                />
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium">{ACTIVITY_TYPE_LABEL[a.type] || a.type}</span>
                  <span className="text-xs text-black/35" title={formatDateTime(a.createdAt)}>
                    {timeAgo(a.createdAt)}
                    {a.userName ? ` · ${a.userName}` : ""}
                  </span>
                  {a.mine && (MANUAL_ACTIVITY_TYPES as readonly string[]).includes(a.type) && (
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="ml-auto opacity-0 group-hover:opacity-100 text-black/30 hover:text-rose-500"
                      title="Delete"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {a.body && <p className="text-sm text-black/60 whitespace-pre-wrap mt-0.5">{a.body}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
