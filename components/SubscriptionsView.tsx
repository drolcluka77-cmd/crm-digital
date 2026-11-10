"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import StatCard from "@/components/StatCard";
import { ChartIcon, ClockIcon, CoinsIcon, XIcon } from "@/components/icons";
import { renewSubscription, cancelSubscription, reactivateSubscription } from "@/app/crm/subscriptions/actions";
import { followUpLabel, formatDate, formatMoney } from "@/lib/format";
import { SUBSCRIPTION_STATUS_LABEL } from "@/lib/constants";
import type { SubscriptionData } from "@/lib/subscriptions";

type Row = SubscriptionData["rows"][number];

export default function SubscriptionsView({
  data,
  showSeller,
  customerBase,
}: {
  data: SubscriptionData;
  showSeller: boolean;
  /** Link prefix for customers, or null when the viewer can't open them. */
  customerBase: string | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"ACTIVE" | "CANCELLED">("ACTIVE");
  const [renewing, setRenewing] = useState<Row | null>(null);
  const [cancelling, setCancelling] = useState<Row | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rows = data.rows.filter((r) => r.status === tab);
  const s = data.stats;

  async function doRenew() {
    if (!renewing) return;
    setBusy(true);
    setError(null);
    const result = await renewSubscription(renewing.id, Number(value) || undefined);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setRenewing(null);
    router.refresh();
  }
  async function doCancel() {
    if (!cancelling) return;
    setBusy(true);
    const result = await cancelSubscription(cancelling.id, reason);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setCancelling(null);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Subscriptions</h1>
        <p className="text-black/50 text-sm mt-1">
          Recurring revenue from won quotes. Record renewals here — renewal commission goes onto the seller&apos;s
          statement for that month.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard tone="dark" label="MRR" value={formatMoney(s.mrr)} sublabel={`ARR ${formatMoney(s.arr)}`} icon={<ChartIcon className="h-5 w-5" />} />
        <StatCard label="Active" value={s.active} sublabel="subscriptions" icon={<CoinsIcon className="h-5 w-5" />} />
        <StatCard label="Renewing in 30 days" value={s.dueSoon} sublabel="follow up early" icon={<ClockIcon className="h-5 w-5" />} />
        <StatCard
          label="Churn (90 days)"
          value={`${s.churnRate90.toFixed(1)}%`}
          sublabel={`${s.churned90} cancelled`}
          icon={<XIcon className="h-5 w-5" />}
        />
      </div>

      <div className="flex gap-2 mb-4">
        {(["ACTIVE", "CANCELLED"] as const).map((t) => (
          <button key={t} className={tab === t ? "chip-active" : "chip"} onClick={() => setTab(t)}>
            {SUBSCRIPTION_STATUS_LABEL[t]} <span className="opacity-60 ml-1">{data.rows.filter((r) => r.status === t).length}</span>
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/40 border-b border-black/5">
              <th className="px-5 py-3 font-medium">Customer</th>
              {showSeller && <th className="px-3 py-3 font-medium">Seller</th>}
              <th className="px-3 py-3 font-medium text-right">MRR</th>
              <th className="px-3 py-3 font-medium">{tab === "ACTIVE" ? "Renews" : "Cancelled"}</th>
              <th className="px-3 py-3 font-medium text-right">Renewal commission</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map((r) => {
              const f = followUpLabel(r.renewalDate);
              const days = Math.round((new Date(r.renewalDate).getTime() - Date.now()) / 86_400_000);
              return (
                <tr key={r.id}>
                  <td className="px-5 py-3">
                    {customerBase ? (
                      <Link href={`${customerBase}/${r.customerId}`} className="font-medium hover:text-brand-600">
                        {r.customer}
                      </Link>
                    ) : (
                      <span className="font-medium">{r.customer}</span>
                    )}
                    <div className="text-xs text-black/40">
                      {r.quoteNumber} · since {formatDate(r.startDate)} · {r.renewals} renewal{r.renewals === 1 ? "" : "s"}
                    </div>
                  </td>
                  {showSeller && <td className="px-3 py-3 text-black/60">{r.seller}</td>}
                  <td className="px-3 py-3 text-right font-medium whitespace-nowrap">{formatMoney(r.monthlyValue)}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {tab === "ACTIVE" ? (
                      <span className={days < 0 ? "text-rose-600 font-medium" : days <= 30 ? "text-amber-600" : ""}>
                        {formatDate(r.renewalDate)} <span className="text-xs opacity-70">({days < 0 ? `${-days} days late` : f.text})</span>
                      </span>
                    ) : (
                      <span className="text-black/55">
                        {r.cancelledAt ? formatDate(r.cancelledAt) : "—"}
                        {r.cancelReason && <span className="block text-xs text-black/40">{r.cancelReason}</span>}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-emerald-700 whitespace-nowrap">{formatMoney(r.renewalCommission)}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    {tab === "ACTIVE" ? (
                      <>
                        <button
                          className="btn-secondary py-1.5"
                          onClick={() => {
                            setError(null);
                            setValue(String(Math.round(r.annualValue * 100) / 100));
                            setRenewing(r);
                          }}
                        >
                          Renewed
                        </button>
                        <button
                          className="btn-ghost py-1.5"
                          onClick={() => {
                            setError(null);
                            setReason("");
                            setCancelling(r);
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        className="btn-ghost py-1.5"
                        onClick={async () => {
                          await reactivateSubscription(r.id);
                          router.refresh();
                        }}
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-black/40">
                  {tab === "ACTIVE"
                    ? "No active subscriptions yet. They appear automatically when a quote with monthly or yearly lines is accepted."
                    : "No cancellations. 🎉"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!renewing} onClose={() => setRenewing(null)} title={`Record renewal — ${renewing?.customer ?? ""}`}>
        <div className="space-y-4">
          {error && <div className="error-box">{error}</div>}
          <p className="text-sm text-black/55">
            Renews for another {renewing?.termMonths} months. Change the yearly value if the price changed.
          </p>
          <div>
            <label className="label">Yearly value (€, excl. VAT)</label>
            <input type="number" min="0" step="0.01" className="input" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={busy} onClick={doRenew}>
            {busy ? "Saving…" : "Record renewal"}
          </button>
        </div>
      </Modal>

      <Modal open={!!cancelling} onClose={() => setCancelling(null)} title={`Cancel — ${cancelling?.customer ?? ""}`}>
        <div className="space-y-4">
          {error && <div className="error-box">{error}</div>}
          <div>
            <label className="label">Why did they cancel?</label>
            <textarea className="input min-h-[80px]" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Price, switched provider, closed business…" />
          </div>
          <button className="btn-danger w-full justify-center" disabled={busy} onClick={doCancel}>
            {busy ? "Saving…" : "Mark as cancelled"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
