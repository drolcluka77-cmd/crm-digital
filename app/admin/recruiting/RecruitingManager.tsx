"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CANDIDATE_STAGE_LABEL } from "@/lib/recruiting-labels";
import { inviteMany, rejectMany, saveRecruitingSettings } from "./actions";
import { DEFAULT_REJECT_BODY, DEFAULT_REJECT_SUBJECT } from "@/lib/recruiting-labels";

type C = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  status: string | null;
  hours: string | null;
  workMode: string | null;
  source: string | null;
  stage: string;
  rating: number | null;
  hasCv: boolean;
  createdAt: string;
  invitedAt: string | null;
  clickedAt: string | null;
  bookedAt: string | null;
};

const STAGES = ["OPEN", "NEW", "INVITED", "BOOKED", "INTERVIEWED", "ONBOARDING", "HIRED", "REJECTED", "ALL"];
const fmt = (d: string) => new Date(d).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric" });
const fmtTime = (d: string) => new Date(d).toLocaleString("sl-SI", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export default function RecruitingManager({
  notice,
  formUrl,
  settings,
  candidates,
}: {
  notice?: string | null;
  formUrl: string;
  settings: { calendly: string; autoInvite: boolean; autoReminder: boolean; subject: string; body: string; retention: number };
  candidates: C[];
}) {
  const router = useRouter();
  const [stage, setStage] = useState("OPEN");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejSubject, setRejSubject] = useState(DEFAULT_REJECT_SUBJECT);
  const [rejBody, setRejBody] = useState(DEFAULT_REJECT_BODY);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: candidates.length, OPEN: 0 };
    for (const x of candidates) {
      c[x.stage] = (c[x.stage] || 0) + 1;
      if (!["HIRED", "REJECTED"].includes(x.stage)) c.OPEN++;
    }
    return c;
  }, [candidates]);

  const rows = candidates.filter((c) => {
    if (stage === "OPEN" && ["HIRED", "REJECTED"].includes(c.stage)) return false;
    if (!["OPEN", "ALL"].includes(stage) && c.stage !== stage) return false;
    const s = q.trim().toLowerCase();
    return !s || [c.name, c.email, c.phone, c.city].filter(Boolean).some((v) => v!.toLowerCase().includes(s));
  });

  async function act(key: string, fn: () => Promise<any>) {
    setBusy(key);
    setMsg(null);
    const res = await fn();
    setBusy(null);
    setMsg(res || null);
    router.refresh();
    return res;
  }

  const notInvited = rows.filter((r) => selected.has(r.id) && !r.invitedAt).map((r) => r.id);
  const openSelected = candidates.filter((r) => selected.has(r.id) && !["HIRED", "REJECTED"].includes(r.stage));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recruiting</h1>
          <p className="text-black/50 text-sm mt-1 max-w-2xl">
            Candidates who applied through the application form. They get the invitation with your booking link
            automatically; when someone books, the stage changes to <i>Meeting booked</i>.
          </p>
        </div>
        <button className="btn-secondary" onClick={() => setShowSettings((s) => !s)}>
          {showSettings ? "Close settings" : "Settings & invitation"}
        </button>
      </div>

      <div className="card p-4 mb-5 flex flex-wrap items-center gap-3">
        <div className="text-sm min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wide text-black/40 mb-0.5">Application form link (put it in the job ad)</div>
          <code className="text-[13px] break-all">{formUrl}</code>
        </div>
        <button
          className="btn-secondary py-1.5"
          onClick={() => {
            navigator.clipboard.writeText(formUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a className="btn-secondary py-1.5" href={formUrl} target="_blank" rel="noreferrer">Open form</a>
      </div>

      {notice && !msg && <div className="error-box mb-4">{notice}</div>}
      {msg?.error && <div className="error-box mb-4">{msg.error}</div>}
      {msg?.success && <div className="success-box mb-4">{msg.success}</div>}

      {showSettings && (
        <form
          className="card p-5 mb-6 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            act("settings", () => saveRecruitingSettings(fd));
          }}
        >
          <div className="grid sm:grid-cols-[1fr_200px] gap-3">
            <label className="text-sm">
              <span className="label">Booking link for the intro meeting (Calendly)</span>
              <input name="calendly" defaultValue={settings.calendly} className="input" placeholder="https://calendly.com/…" />
            </label>
            <label className="text-sm">
              <span className="label">Delete closed applications after (months)</span>
              <input name="retention" type="number" min={1} max={36} defaultValue={settings.retention} className="input" />
            </label>
          </div>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" name="autoInvite" defaultChecked={settings.autoInvite} /> Send the invitation automatically when someone applies
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" name="autoReminder" defaultChecked={settings.autoReminder} /> Send one reminder 3 days after the invitation if no meeting was booked (turn off if candidates book in ways the CRM doesn’t see)
          </label>
          <label className="text-sm">
            <span className="label">Invitation subject</span>
            <input name="subject" defaultValue={settings.subject} className="input" />
          </label>
          <label className="text-sm">
            <span className="label">Invitation text — {"{{firstName}}"} and {"{{calendlyLink}}"} are filled in</span>
            <textarea name="body" rows={16} defaultValue={settings.body} className="input font-mono text-[13px]" />
          </label>
          <p className="text-xs text-black/45">
            Candidates who were invited and haven&apos;t booked get one reminder after 3 days. Rejected applications, and
            ones that never answered, are deleted with their CV after the retention period.
          </p>
          <div>
            <button className="btn-primary" disabled={!!busy}>{busy === "settings" ? "Saving…" : "Save"}</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {STAGES.map((s) => (
          <button key={s} onClick={() => setStage(s)} className={stage === s ? "chip-active" : "chip"}>
            {s === "OPEN" ? "Open" : s === "ALL" ? "All" : CANDIDATE_STAGE_LABEL[s]}
            <span className="ml-1.5 opacity-60">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, e-mail, phone, city…" className="input max-w-sm" />
        {selected.size > 0 && (
          <button
            className="btn-primary py-1.5"
            disabled={!!busy || notInvited.length === 0}
            onClick={() => act("invite", () => inviteMany(notInvited)).then(() => setSelected(new Set()))}
          >
            {busy === "invite" ? "Sending…" : `Invite ${notInvited.length} not yet invited`}
          </button>
        )}
        {openSelected.length > 0 && (
          <button className="btn-secondary py-1.5" disabled={!!busy} onClick={() => setRejectOpen((v) => !v)}>
            Not selected… ({openSelected.length})
          </button>
        )}
        {selected.size > 0 && (
          <button className="text-sm text-black/45 hover:text-black/70" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        )}
      </div>

      {rejectOpen && openSelected.length > 0 && (
        <div className="card p-5 mb-5 space-y-3">
          <div className="font-medium">Mark {openSelected.length} as not selected</div>
          <div className="text-xs text-black/50">
            {openSelected.map((c) => c.name).join(", ")}
          </div>
          <label className="text-sm block">
            <span className="label">Subject</span>
            <input className="input" value={rejSubject} onChange={(e) => setRejSubject(e.target.value)} />
          </label>
          <label className="text-sm block">
            <span className="label">Message — {"{{firstName}}"}, {"{{senderName}}"} and {"{{company}}"} are filled in for each candidate</span>
            <textarea className="input" rows={14} value={rejBody} onChange={(e) => setRejBody(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-primary"
              disabled={!!busy}
              onClick={() => {
                if (!confirm(`Send this e-mail to ${openSelected.length} candidate(s) and mark them as not selected?`)) return;
                act("reject", () => rejectMany(openSelected.map((c) => c.id), true, rejSubject, rejBody)).then((r: any) => {
                  if (!r?.error) {
                    setRejectOpen(false);
                    setSelected(new Set());
                  }
                });
              }}
            >
              {busy === "reject" ? "Sending…" : `Send e-mail and mark ${openSelected.length} as not selected`}
            </button>
            <button
              className="btn-secondary"
              disabled={!!busy}
              onClick={() =>
                act("reject", () => rejectMany(openSelected.map((c) => c.id), false)).then((r: any) => {
                  if (!r?.error) {
                    setRejectOpen(false);
                    setSelected(new Set());
                  }
                })
              }
            >
              Mark without e-mail
            </button>
            <button className="text-sm text-black/45 px-2" onClick={() => setRejectOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/40 border-b border-black/5">
              <th className="px-4 py-2 w-8"></th>
              <th className="px-2 py-2 font-medium">Candidate</th>
              <th className="px-3 py-2 font-medium">Availability</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Applied</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-sand-50 align-top">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(c.id)}
                    onChange={(e) => {
                      const n = new Set(selected);
                      e.target.checked ? n.add(c.id) : n.delete(c.id);
                      setSelected(n);
                    }}
                  />
                </td>
                <td className="px-2 py-3">
                  <Link href={`/admin/recruiting/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                  {c.rating ? <span className="ml-2 text-amber-500 text-xs">{"★".repeat(c.rating)}</span> : null}
                  <div className="text-xs text-black/45">{[c.email, c.phone, c.city].filter(Boolean).join(" · ")}</div>
                  <div className="text-xs text-black/35">{[c.status, c.source, c.hasCv ? "CV" : null].filter(Boolean).join(" · ")}</div>
                </td>
                <td className="px-3 py-3 text-xs text-black/60">{[c.hours, c.workMode].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-3 text-xs">
                  <div className="font-medium">{CANDIDATE_STAGE_LABEL[c.stage]}</div>
                  <div className="text-black/45">
                    {c.bookedAt
                      ? `Meeting ${fmtTime(c.bookedAt)}`
                      : c.clickedAt
                        ? "Opened the booking link"
                        : c.invitedAt
                          ? `Invited ${fmt(c.invitedAt)}`
                          : ""}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-black/50">{fmt(c.createdAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-black/40">
                  No candidates here yet. Put the application form link in your job ad.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
