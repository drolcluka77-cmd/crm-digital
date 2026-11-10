"use client";

import { useState } from "react";
import { acceptOnline, declineOnline } from "./actions";
import { formatDate } from "@/lib/format";

export default function AcceptPanel({
  token,
  state,
  acceptedBy,
  decidedAt,
  contactName,
}: {
  token: string;
  state: "open" | "accepted" | "declined" | "expired" | "revising";
  acceptedBy: string | null;
  decidedAt: string | null;
  contactName: string;
}) {
  const [mode, setMode] = useState<"accept" | "decline">("accept");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  const final = done || (state === "accepted" || state === "declined" ? state : null);

  if (final === "accepted") {
    return (
      <div className="card p-6 text-center">
        <div className="text-2xl mb-1">✅</div>
        <div className="font-semibold text-emerald-700">Quote accepted</div>
        <p className="text-sm text-black/55 mt-1">
          {acceptedBy && !done ? `Accepted by ${acceptedBy}${decidedAt ? ` on ${formatDate(decidedAt)}` : ""}. ` : ""}
          Thank you! {contactName} will be in touch about the next steps.
        </p>
      </div>
    );
  }
  if (final === "declined") {
    return (
      <div className="card p-6 text-center">
        <div className="font-semibold">Quote declined</div>
        <p className="text-sm text-black/55 mt-1">Thanks for letting us know. {contactName} may follow up with you.</p>
      </div>
    );
  }
  if (state === "expired" || state === "revising") {
    return (
      <div className="card p-6 text-center text-sm text-black/60">
        {state === "expired"
          ? `This quote has expired. Please ask ${contactName} for an updated one.`
          : `This quote is being revised. ${contactName} will send you an updated version.`}
      </div>
    );
  }

  async function submit(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = mode === "accept" ? await acceptOnline(token, fd) : await declineOnline(token, fd);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    if (result && result.done) setDone(result.done);
  }

  return (
    <div className="card p-6">
      <div className="flex gap-2 mb-4">
        <button className={mode === "accept" ? "chip-active" : "chip"} onClick={() => setMode("accept")}>
          Accept quote
        </button>
        <button className={mode === "decline" ? "chip-active" : "chip"} onClick={() => setMode("decline")}>
          Decline
        </button>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        {error && <div className="error-box">{error}</div>}
        {mode === "accept" ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Your full name</label>
                <input name="name" required className="input" autoComplete="name" />
              </div>
              <div>
                <label className="label">Job title (optional)</label>
                <input name="title" className="input" autoComplete="organization-title" />
              </div>
            </div>
            <label className="flex items-start gap-2.5 text-sm text-black/70">
              <input type="checkbox" name="agree" className="mt-0.5" required />
              I accept this quote and its terms on behalf of my organisation.
            </label>
            <button type="submit" className="btn-primary w-full py-3" disabled={busy}>
              {busy ? "Confirming…" : "Accept quote"}
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="label">What didn&apos;t work for you? (optional)</label>
              <textarea name="reason" className="input min-h-[90px]" placeholder="Price, timing, features…" />
            </div>
            <button type="submit" className="btn-secondary w-full py-3" disabled={busy}>
              {busy ? "Sending…" : "Decline quote"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
