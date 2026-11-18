"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import { LEAD_TYPE_BADGE, LEAD_TYPE_LABEL } from "@/lib/constants";
import { addPayment, deletePayment, saveCommissionRules } from "./actions";

type Row = {
  quoteId: string;
  number: string;
  customer: string;
  customerId: string;
  leadType: string;
  seller: string;
  acceptedAt: string;
  windowEnd: string;
  inWindow: boolean;
  rate: number;
  annualNet: number;
  monthlyNet: number;
  paidTotal: number;
  commissionTotal: number;
  payments: { id: string; amount: number; paidAt: string; commission: number; rate: number; note: string | null }[];
};

const eur = (n: number) => n.toLocaleString("sl-SI", { style: "currency", currency: "EUR" });
const day = (d: string) => new Date(d).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric", year: "numeric" });
const today = () => new Date().toISOString().slice(0, 10);

export default function PaymentsManager({
  isAdmin,
  ownRate,
  months,
  rows,
}: {
  isAdmin: boolean;
  ownRate: number;
  months: number;
  rows: Row[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<{ amount: string; date: string; note: string }>({ amount: "", date: today(), note: "" });
  const [rules, setRules] = useState({ own: String(ownRate), months: String(months) });
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<any>) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fn();
      setMsg(r || null);
      if (!r?.error) router.refresh();
      return r;
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter((r) => `${r.customer} ${r.number} ${r.seller}`.toLowerCase().includes(s)) : rows;
  }, [q, rows]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Customer payments</h1>
        <p className="text-black/50 text-sm mt-1">
          Sellers earn commission on what customers actually pay: each payment × the deal's rate, for the first {months} months after
          the quote was accepted (own leads at least {ownRate}%). Enter amounts <strong>net, excl. VAT</strong>. Bank-statement import comes later.
        </p>
      </div>
      {msg && <div className={`${msg.error ? "error-box" : "success-box"} mb-4`}>{msg.error || msg.success}</div>}

      {isAdmin && (
        <div className="card p-4 mb-5 flex flex-wrap items-end gap-3 text-sm">
          <div>
            <label className="label">Own-lead commission (%)</label>
            <input className="input w-28" value={rules.own} onChange={(e) => setRules({ ...rules, own: e.target.value })} />
          </div>
          <div>
            <label className="label">Commission months</label>
            <input className="input w-28" value={rules.months} onChange={(e) => setRules({ ...rules, months: e.target.value })} />
          </div>
          <button className="btn-secondary" disabled={busy === "rules"} onClick={() => run("rules", () => saveCommissionRules(rules.own, rules.months))}>
            Save rules
          </button>
          <span className="text-xs text-black/40">The standard rate (e.g. 15 %) is set per product under Products → Commission.</span>
        </div>
      )}

      <input className="input mb-4 max-w-sm" placeholder="Search customer, quote or seller…" value={q} onChange={(e) => setQ(e.target.value)} />

      <div className="card divide-y divide-black/5">
        {filtered.length === 0 && <div className="px-5 py-10 text-center text-sm text-black/40">No accepted quotes yet.</div>}
        {filtered.map((r) => (
          <div key={r.quoteId} className="px-5 py-4 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.customer}</span>
                  <Badge variant={LEAD_TYPE_BADGE[r.leadType] || "MUTED"}>{LEAD_TYPE_LABEL[r.leadType] || r.leadType}</Badge>
                </div>
                <div className="text-xs text-black/45 mt-0.5">
                  {r.number} · {r.seller} · accepted {day(r.acceptedAt)} ·{" "}
                  {r.inWindow ? `commission ${r.rate}% until ${day(r.windowEnd)}` : `commission period ended ${day(r.windowEnd)}`}
                </div>
                <div className="text-xs text-black/45">
                  First-year value {eur(r.annualNet)}
                  {r.monthlyNet > 0 ? ` · ${eur(r.monthlyNet)} / month` : ""}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{eur(r.paidTotal)} paid</div>
                <div className="text-xs text-emerald-700">{eur(r.commissionTotal)} commission</div>
                {isAdmin && (
                  <button
                    className="btn-secondary !py-1.5 text-xs mt-2"
                    onClick={() => {
                      setOpen(open === r.quoteId ? null : r.quoteId);
                      setForm({ amount: r.monthlyNet ? String(Math.round(r.monthlyNet * 100) / 100) : "", date: today(), note: "" });
                    }}
                  >
                    + Payment
                  </button>
                )}
              </div>
            </div>

            {open === r.quoteId && isAdmin && (
              <div className="mt-3 flex flex-wrap items-end gap-2 bg-sand-50 rounded-xl p-3">
                <div>
                  <label className="label">Amount (net €)</label>
                  <input className="input w-32" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                </div>
                <div>
                  <label className="label">Paid on</label>
                  <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="label">Note</label>
                  <input className="input" value={form.note} placeholder="e.g. invoice 2026-041, November" onChange={(e) => setForm({ ...form, note: e.target.value })} />
                </div>
                <button
                  className="btn-primary"
                  disabled={busy === r.quoteId}
                  onClick={async () => {
                    const res = await run(r.quoteId, () => addPayment(r.quoteId, form.amount, form.date, form.note));
                    if (res && !res.error) setOpen(null);
                  }}
                >
                  Save
                </button>
              </div>
            )}

            {r.payments.length > 0 && (
              <div className="mt-3 space-y-1">
                {r.payments.map((p) => (
                  <div key={p.id} className="flex justify-between gap-2 text-xs text-black/60">
                    <span>
                      {day(p.paidAt)} · {eur(p.amount)}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="text-emerald-700">
                        {eur(p.commission)} ({p.rate}%)
                      </span>
                      {isAdmin && (
                        <button
                          className="text-rose-500 hover:underline"
                          disabled={!!busy}
                          onClick={() => confirm("Delete this payment? The seller's commission is removed too.") && run(p.id, () => deletePayment(p.id))}
                        >
                          delete
                        </button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
