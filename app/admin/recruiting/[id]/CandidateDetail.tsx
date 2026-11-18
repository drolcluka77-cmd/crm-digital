"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CANDIDATE_STAGES, CANDIDATE_STAGE_LABEL } from "@/lib/recruiting-labels";
import { deleteCandidate, hireCandidate, rejectCandidate, resendInvite, updateCandidate } from "../actions";

type Cand = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  status: string | null;
  hours: string | null;
  from: string | null;
  workMode: string | null;
  languages: string | null;
  experience: string | null;
  motivation: string | null;
  source: string | null;
  cvName: string | null;
  hasCv: boolean;
  stage: string;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  consentAt: string;
  invitedAt: string | null;
  reminderAt: string | null;
  clickedAt: string | null;
  bookedAt: string | null;
  hiredUser: { id: string; name: string } | null;
};

const dt = (d: string | null) =>
  d ? new Date(d).toLocaleString("sl-SI", { day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

export default function CandidateDetail({
  c,
  managers,
  products,
  isAdmin,
}: {
  c: Cand;
  managers: { id: string; name: string }[];
  products: { id: string; name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string; tempPassword?: string } | null>(null);
  const [notes, setNotes] = useState(c.notes || "");
  const [hiring, setHiring] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  async function act(key: string, fn: () => Promise<any>) {
    setBusy(key);
    setMsg(null);
    const res = await fn();
    setBusy(null);
    setMsg(res || null);
    router.refresh();
    return res;
  }

  const Field = ({ label, value }: { label: string; value: string | null }) =>
    value ? (
      <div>
        <div className="text-[11px] uppercase tracking-wide text-black/40">{label}</div>
        <div className="text-sm whitespace-pre-line">{value}</div>
      </div>
    ) : null;

  const closed = ["HIRED", "REJECTED"].includes(c.stage);

  return (
    <div>
      <Link href="/admin/recruiting" className="text-sm text-black/50 hover:underline">← Recruiting</Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
          <div className="text-sm text-black/55 mt-1">
            <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a>
            {c.phone && (
              <>
                {" · "}
                <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:underline">{c.phone}</a>
              </>
            )}
            {c.city ? ` · ${c.city}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.hasCv && (
            <a className="btn-secondary" href={`/api/recruiting/cv/${c.id}`} target="_blank" rel="noreferrer">
              Open CV
            </a>
          )}
          {!closed && (
            <button className="btn-secondary" disabled={!!busy} onClick={() => act("invite", () => resendInvite(c.id))}>
              {busy === "invite" ? "Sending…" : c.invitedAt ? "Resend invitation" : "Send invitation"}
            </button>
          )}
          {!closed && <button className="btn-primary" onClick={() => { setHiring(true); setRejecting(false); }}>Hire…</button>}
        </div>
      </div>

      {msg?.error && <div className="error-box mb-4">{msg.error}</div>}
      {msg?.success && (
        <div className="success-box mb-4">
          {msg.success}
          {msg.tempPassword && (
            <div className="mt-1">
              Temporary password: <code className="font-semibold">{msg.tempPassword}</code> — the seller changes it after the first login.
            </div>
          )}
        </div>
      )}

      {hiring && (
        <form
          className="card p-5 mb-6 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            act("hire", () => hireCandidate(c.id, fd)).then((r) => !r?.error && setHiring(false));
          }}
        >
          <h2 className="font-semibold">Hire {c.name}</h2>
          <p className="text-sm text-black/55">Creates a seller account with this e-mail and gives access to the products you tick.</p>
          {isAdmin && managers.length > 0 && (
            <label className="text-sm max-w-sm">
              <span className="label">Manager</span>
              <select name="managerId" className="input" defaultValue="">
                <option value="">No manager</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
          )}
          <div>
            <div className="label">Products</div>
            <div className="grid sm:grid-cols-2 gap-1.5 mt-1">
              {products.map((p) => (
                <label key={p.id} className="text-sm flex items-center gap-2">
                  <input type="checkbox" name="productIds" value={p.id} /> {p.name}
                </label>
              ))}
            </div>
          </div>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" name="sendLogin" defaultChecked /> E-mail the login details to {c.email}
          </label>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={!!busy}>{busy === "hire" ? "Creating…" : "Create seller account"}</button>
            <button type="button" className="btn-secondary" onClick={() => setHiring(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="card p-5 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Status" value={c.status} />
            <Field label="Hours per week" value={c.hours} />
            <Field label="Can start" value={c.from} />
            <Field label="Where" value={c.workMode} />
            <Field label="Languages" value={c.languages} />
            <Field label="Source" value={c.source} />
          </div>
          <Field label="Experience" value={c.experience} />
          <Field label="Why this job" value={c.motivation} />
          {c.hasCv && <Field label="CV" value={c.cvName} />}

          <div>
            <div className="label">Notes after the meeting</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} className="input" />
            <button
              className="btn-secondary mt-2 py-1.5"
              disabled={!!busy || notes === (c.notes || "")}
              onClick={() => act("notes", () => updateCandidate(c.id, { notes }))}
            >
              {busy === "notes" ? "Saving…" : "Save notes"}
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5 space-y-3">
            <label className="block text-sm">
              <span className="label">Stage</span>
              <select
                className="input"
                value={c.stage}
                disabled={!!busy || c.stage === "HIRED"}
                onChange={(e) => act("stage", () => updateCandidate(c.id, { stage: e.target.value }))}
              >
                {CANDIDATE_STAGES.filter((s) => s !== "HIRED" || c.stage === "HIRED").map((s) => (
                  <option key={s} value={s}>{CANDIDATE_STAGE_LABEL[s]}</option>
                ))}
              </select>
            </label>
            <div>
              <div className="label">Rating</div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    className={`text-xl ${c.rating && n <= c.rating ? "text-amber-500" : "text-black/15"}`}
                    onClick={() => act("rate", () => updateCandidate(c.id, { rating: c.rating === n ? null : n }))}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            {c.hiredUser && (
              <div className="text-sm">
                Seller account: <Link href="/admin/team" className="underline">{c.hiredUser.name}</Link>
              </div>
            )}
          </div>

          <div className="card p-5 text-sm space-y-1.5">
            <div className="font-semibold mb-1">Timeline</div>
            <div><span className="text-black/45">Applied:</span> {dt(c.createdAt)}</div>
            {c.invitedAt && <div><span className="text-black/45">Invited:</span> {dt(c.invitedAt)}</div>}
            {c.reminderAt && <div><span className="text-black/45">Reminder:</span> {dt(c.reminderAt)}</div>}
            {c.clickedAt && <div><span className="text-black/45">Opened booking link:</span> {dt(c.clickedAt)}</div>}
            {c.bookedAt && <div><span className="text-black/45">Meeting:</span> {dt(c.bookedAt)}</div>}
            <div className="text-xs text-black/40 pt-1">Consent given {dt(c.consentAt)}</div>
          </div>

          <div className="card p-5 text-sm space-y-2">
            {!closed &&
              (rejecting ? (
                <div className="space-y-2">
                  <div>Mark as not selected?</div>
                  <button className="btn-secondary w-full justify-center" disabled={!!busy} onClick={() => act("rej", () => rejectCandidate(c.id, true)).then(() => setRejecting(false))}>
                    Yes, and send a polite e-mail
                  </button>
                  <button className="btn-secondary w-full justify-center" disabled={!!busy} onClick={() => act("rej", () => rejectCandidate(c.id, false)).then(() => setRejecting(false))}>
                    Yes, without e-mail
                  </button>
                  <button className="text-black/45 w-full" onClick={() => setRejecting(false)}>Cancel</button>
                </div>
              ) : (
                <button className="btn-secondary w-full justify-center" onClick={() => { setRejecting(true); setHiring(false); }}>
                  Not selected…
                </button>
              ))}
            <button
              className="text-xs text-rose-700 underline"
              disabled={!!busy}
              onClick={() => {
                if (confirm(`Delete ${c.name} and the CV for good? Use this when the candidate asks to be erased.`)) {
                  act("del", () => deleteCandidate(c.id)).then((r) => !r?.error && router.push("/admin/recruiting"));
                }
              }}
            >
              Delete candidate (GDPR request)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
