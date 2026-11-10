"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import { decideApproval } from "./actions";
import { APPROVAL_STATUS_LABEL, BILLING_SUFFIX } from "@/lib/constants";
import { formatMoney, timeAgo } from "@/lib/format";

type Row = {
  id: string;
  number: string;
  seller: string;
  customer: string;
  status: string;
  reason: string | null;
  note: string | null;
  decidedBy: string | null;
  requestedAt: string | null;
  annualNet: number;
  discount: number;
  lines: { name: string; quantity: number; unitPrice: number; listPrice: number | null; billing: string }[];
};

const VARIANT: Record<string, string> = { PENDING: "WARN", APPROVED: "WON", REJECTED: "LOST" };

export default function ApprovalsList({ quotes }: { quotes: Row[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = quotes.filter((q) => q.status === "PENDING");
  const decided = quotes.filter((q) => q.status !== "PENDING");

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    setError(null);
    const result = await decideApproval(id, approve, notes[id] || "");
    setBusy(null);
    if (result && result.error) return setError(result.error);
    router.refresh();
  }

  const card = (q: Row, actionable: boolean) => (
    <div key={q.id} className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{q.customer}</span>
            <Badge variant={VARIANT[q.status]}>{APPROVAL_STATUS_LABEL[q.status]}</Badge>
          </div>
          <div className="text-xs text-black/45 mt-0.5">
            {q.number} · {q.seller}
            {q.requestedAt && ` · requested ${timeAgo(q.requestedAt)}`} · {formatMoney(q.annualNet)} first-year
          </div>
        </div>
        {!actionable && q.decidedBy && <div className="text-xs text-black/40">by {q.decidedBy}</div>}
      </div>
      {q.reason && <div className="mt-3 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">{q.reason}</div>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/40">
              <th className="py-1 font-medium">Line</th>
              <th className="py-1 font-medium text-right">Qty</th>
              <th className="py-1 font-medium text-right">List</th>
              <th className="py-1 font-medium text-right">Quoted</th>
            </tr>
          </thead>
          <tbody>
            {q.lines.map((l, i) => (
              <tr key={i} className="border-t border-black/5">
                <td className="py-1.5 pr-2">{l.name}</td>
                <td className="py-1.5 text-right">{l.quantity}</td>
                <td className="py-1.5 text-right text-black/45">
                  {l.listPrice !== null ? formatMoney(l.listPrice) + BILLING_SUFFIX[l.billing] : "—"}
                </td>
                <td className="py-1.5 text-right font-medium">{formatMoney(l.unitPrice) + BILLING_SUFFIX[l.billing]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {q.discount > 0 && <div className="text-xs text-black/45 mt-1">Plus {q.discount}% discount on the whole quote.</div>}
      </div>
      {q.note && <p className="text-sm text-black/60 mt-3">“{q.note}”</p>}
      {actionable && (
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <input
            className="input flex-1 min-w-[200px] py-2"
            placeholder="Note to the seller (optional)"
            value={notes[q.id] || ""}
            onChange={(e) => setNotes((n) => ({ ...n, [q.id]: e.target.value }))}
          />
          <button className="btn-primary" disabled={busy === q.id} onClick={() => decide(q.id, true)}>
            Approve
          </button>
          <button className="btn-secondary" disabled={busy === q.id} onClick={() => decide(q.id, false)}>
            Decline
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Discount approvals</h1>
        <p className="text-black/50 text-sm mt-1">
          Quotes with discounts above the product&apos;s limit wait here. Sellers can&apos;t send them or mark them won
          until you approve. Set limits per product (Products → Commission &amp; pricing rules) or a default in
          Settings.
        </p>
      </div>
      {error && <div className="error-box mb-4">{error}</div>}
      <h2 className="section-title mb-3">Waiting ({pending.length})</h2>
      <div className="space-y-4 mb-8">
        {pending.map((q) => card(q, true))}
        {pending.length === 0 && <div className="card p-8 text-center text-sm text-black/40">Nothing waiting. 👌</div>}
      </div>
      {decided.length > 0 && (
        <>
          <h2 className="section-title mb-3">Recently decided</h2>
          <div className="space-y-4">{decided.map((q) => card(q, false))}</div>
        </>
      )}
    </div>
  );
}
