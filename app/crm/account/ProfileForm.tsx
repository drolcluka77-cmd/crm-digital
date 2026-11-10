"use client";

import { useState } from "react";
import { updateMyProfile } from "./actions";

export default function ProfileForm({
  phone,
  bookingUrl,
  emailNotifications,
  showBooking = true,
}: {
  phone: string | null;
  bookingUrl: string | null;
  emailNotifications: boolean;
  showBooking?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);

  return (
    <form
      className="card p-6 space-y-4 mb-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg((await updateMyProfile(new FormData(e.currentTarget))) || null);
        setBusy(false);
      }}
    >
      <div>
        <h2 className="font-semibold">Profile & notifications</h2>
        <p className="text-sm text-black/45">Your phone appears in email signatures and on quotes.</p>
      </div>
      {msg?.error && <div className="error-box">{msg.error}</div>}
      {msg?.success && <div className="success-box">{msg.success}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Phone</label>
          <input name="phone" defaultValue={phone || ""} className="input" placeholder="+386 40 000 000" />
        </div>
        {showBooking && (
          <div>
            <label className="label">Your booking page</label>
            <input
              name="bookingUrl"
              defaultValue={bookingUrl || ""}
              className="input"
              placeholder="https://calendly.com/you/demo"
            />
          </div>
        )}
      </div>
      {showBooking && (
        <p className="text-xs text-black/45">
          Calendly, Cal.com, Google Calendar booking page… Use <code>{"{{bookingLink}}"}</code> in an email and each
          client gets a tracked link to it — you&apos;re notified when they open it.
        </p>
      )}
      <label className="flex items-center gap-2.5 text-sm">
        <input type="checkbox" name="emailNotifications" defaultChecked={emailNotifications} />
        Email me about important events (client opened a quote, demo booked, approvals, new leads)
      </label>
      <button type="submit" className="btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
