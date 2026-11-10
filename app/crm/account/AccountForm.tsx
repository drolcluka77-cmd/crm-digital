"use client";

import { useState } from "react";
import { changeMyPassword } from "./actions";

export default function AccountForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const result = await changeMyPassword(formData);
    setBusy(false);
    if (result && "error" in result && result.error) {
      setError(result.error);
      return;
    }
    setSuccess((result as any)?.success || "Updated.");
  }

  return (
    <div className="card p-6 max-w-md">
      <h2 className="font-semibold mb-1">Change password</h2>
      <p className="text-sm text-black/50 mb-4">Update your own login password.</p>
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-4">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 mb-4">
          {success}
        </div>
      )}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          handleSubmit(new FormData(form));
          form.reset();
        }}
      >
        <div>
          <label className="label">Current password</label>
          <input name="currentPassword" type="password" required className="input" />
        </div>
        <div>
          <label className="label">New password</label>
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            className="input"
          />
        </div>
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
