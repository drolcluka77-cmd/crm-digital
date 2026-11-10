"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateSettings,
  sendTestEmailAction,
  changeOwnPassword,
} from "./actions";

type Settings = {
  companyName: string;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
  vatRate: number;
  quoteValidityDays: number;
  defaultMaxDiscount: number | null;
  commissionTiers: string | null;
  renewalTermMonths: number;
  logoUrl: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpFrom: string | null;
  hasSmtpPassword: boolean;
};

function Banner({ error, success }: { error: string | null; success: string | null }) {
  if (!error && !success) return null;
  return (
    <div
      className={`rounded-xl border text-sm px-4 py-3 mb-4 ${
        error
          ? "bg-red-50 border-red-200 text-red-700"
          : "bg-emerald-50 border-emerald-200 text-emerald-700"
      }`}
    >
      {error || success}
    </div>
  );
}

export default function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();

  const [companyBusy, setCompanyBusy] = useState(false);
  const [companyError, setCompanyError] = useState<string | null>(null);
  const [companySuccess, setCompanySuccess] = useState<string | null>(null);

  const [testBusy, setTestBusy] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<string | null>(null);

  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  async function handleSave(formData: FormData) {
    setCompanyBusy(true);
    setCompanyError(null);
    setCompanySuccess(null);
    const result = await updateSettings(formData);
    setCompanyBusy(false);
    if (result && "error" in result && result.error) {
      setCompanyError(result.error);
      return;
    }
    setCompanySuccess((result as any)?.success || "Saved.");
    router.refresh();
  }

  async function handleTestEmail(formData: FormData) {
    setTestBusy(true);
    setTestError(null);
    setTestSuccess(null);
    const result = await sendTestEmailAction(formData);
    setTestBusy(false);
    if (result && "error" in result && result.error) {
      setTestError(result.error);
      return;
    }
    setTestSuccess((result as any)?.success || "Sent.");
  }

  async function handlePasswordChange(formData: FormData) {
    setPwBusy(true);
    setPwError(null);
    setPwSuccess(null);
    const result = await changeOwnPassword(formData);
    setPwBusy(false);
    if (result && "error" in result && result.error) {
      setPwError(result.error);
      return;
    }
    setPwSuccess((result as any)?.success || "Updated.");
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="font-semibold mb-1">Company details</h2>
        <p className="text-sm text-black/50 mb-5">
          Shown in the app header and on quote PDFs sent to customers.
        </p>
        <Banner error={companyError} success={companySuccess} />
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setCompanyError(null);
            setCompanySuccess(null);
            handleSave(new FormData(e.currentTarget));
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Company name</label>
              <input
                name="companyName"
                required
                defaultValue={settings.companyName}
                className="input"
              />
            </div>
            <div>
              <label className="label">VAT rate (%)</label>
              <input
                name="vatRate"
                type="number"
                step="0.1"
                min="0"
                defaultValue={settings.vatRate}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Quotes valid for (days)</label>
              <input
                name="quoteValidityDays"
                type="number"
                min="1"
                defaultValue={settings.quoteValidityDays}
                className="input"
              />
            </div>
            <div>
              <label className="label">Subscription term (months)</label>
              <input
                name="renewalTermMonths"
                type="number"
                min="1"
                defaultValue={settings.renewalTermMonths}
                className="input"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Default max discount without approval (%)</label>
              <input
                name="defaultMaxDiscount"
                type="number"
                min="0"
                max="100"
                step="0.5"
                defaultValue={settings.defaultMaxDiscount ?? ""}
                className="input"
                placeholder="empty = no limit"
              />
              <p className="text-xs text-black/40 mt-1">Products can set their own limit.</p>
            </div>
            <div>
              <label className="label">Monthly commission bonus tiers</label>
              <input
                name="commissionTiers"
                defaultValue={settings.commissionTiers || ""}
                className="input"
                placeholder="10000:2, 25000:4"
              />
              <p className="text-xs text-black/40 mt-1">
                &ldquo;10000:2&rdquo; = +2% of the month&apos;s won value once a seller wins €10,000 in a month.
              </p>
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input
              name="companyAddress"
              defaultValue={settings.companyAddress || ""}
              className="input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Company email</label>
              <input
                name="companyEmail"
                type="email"
                defaultValue={settings.companyEmail || ""}
                className="input"
              />
            </div>
            <div>
              <label className="label">Company phone</label>
              <input
                name="companyPhone"
                defaultValue={settings.companyPhone || ""}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="label">Logo (optional)</label>
            <input
              name="logo"
              type="file"
              accept="image/*"
              className="block w-full text-sm text-black/60 rounded-xl border border-black/10 bg-white px-3.5 py-2.5"
            />
            {settings.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.logoUrl} alt="Logo" className="h-10 mt-2 rounded" />
            )}
          </div>

          <div className="pt-2 border-t border-black/5" />

          <h3 className="font-medium text-sm">Email sending (SMTP)</h3>
          <p className="text-xs text-black/45 -mt-2">
            For Gmail: use smtp.gmail.com, port 587, your Gmail address as the
            user, and a 16-character{" "}
            <a
              className="text-brand-600 underline"
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
            >
              App Password
            </a>{" "}
            (not your normal Gmail password) as the password.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SMTP host</label>
              <input
                name="smtpHost"
                defaultValue={settings.smtpHost || ""}
                className="input"
                placeholder="smtp.gmail.com"
              />
            </div>
            <div>
              <label className="label">SMTP port</label>
              <input
                name="smtpPort"
                type="number"
                defaultValue={settings.smtpPort || 587}
                className="input"
                placeholder="587"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">SMTP username</label>
              <input
                name="smtpUser"
                defaultValue={settings.smtpUser || ""}
                className="input"
                placeholder="you@gmail.com"
              />
            </div>
            <div>
              <label className="label">
                SMTP password{" "}
                {settings.hasSmtpPassword && (
                  <span className="normal-case text-black/35">
                    (set — leave blank to keep it)
                  </span>
                )}
              </label>
              <input
                name="smtpPass"
                type="password"
                className="input"
                placeholder={settings.hasSmtpPassword ? "••••••••••••" : "App password"}
              />
            </div>
          </div>
          <div>
            <label className="label">&quot;From&quot; address</label>
            <input
              name="smtpFrom"
              defaultValue={settings.smtpFrom || ""}
              className="input"
              placeholder="Distribution Hub <you@gmail.com>"
            />
          </div>

          <button type="submit" className="btn-primary" disabled={companyBusy}>
            {companyBusy ? "Saving…" : "Save settings"}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-1">Send a test email</h2>
        <p className="text-sm text-black/50 mb-4">
          Confirms your SMTP settings above actually work.
        </p>
        <Banner error={testError} success={testSuccess} />
        <form
          className="flex gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setTestError(null);
            setTestSuccess(null);
            handleTestEmail(new FormData(e.currentTarget));
          }}
        >
          <input
            name="testEmail"
            type="email"
            required
            placeholder="you@company.com"
            className="input"
          />
          <button type="submit" className="btn-secondary shrink-0" disabled={testBusy}>
            {testBusy ? "Sending…" : "Send test"}
          </button>
        </form>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold mb-1">Your password</h2>
        <p className="text-sm text-black/50 mb-4">Change your own admin password.</p>
        <Banner error={pwError} success={pwSuccess} />
        <form
          className="space-y-4 max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            setPwError(null);
            setPwSuccess(null);
            handlePasswordChange(new FormData(e.currentTarget));
            e.currentTarget.reset();
          }}
        >
          <div>
            <label className="label">Current password</label>
            <input
              name="currentPassword"
              type="password"
              required
              className="input"
            />
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
          <button type="submit" className="btn-secondary" disabled={pwBusy}>
            {pwBusy ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
