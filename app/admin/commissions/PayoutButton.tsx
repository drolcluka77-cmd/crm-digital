"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { TrashIcon } from "@/components/icons";
import { recordPayout, deletePayout } from "./actions";
import { formatDate, formatMoney } from "@/lib/format";

export default function PayoutButton({
  userId,
  name,
  period,
  balance,
  payouts,
}: {
  userId: string;
  name: string;
  period: string;
  balance: number;
  payouts: { id: string; amount: number; paidAt: string; note: string | null }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await recordPayout(userId, period, Number(amount), note);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        className={balance > 0.005 ? "btn-primary py-1.5" : "btn-ghost py-1.5"}
        onClick={() => {
          setAmount(balance > 0 ? String(Math.round(balance * 100) / 100) : "");
          setNote("");
          setError(null);
          setOpen(true);
        }}
      >
        {balance > 0.005 ? "Mark paid" : "Payouts"}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Payout — ${name}`}>
        <div className="space-y-4">
          {error && <div className="error-box">{error}</div>}
          {payouts.length > 0 && (
            <div className="space-y-1.5">
              <div className="section-title">Already paid for this month</div>
              {payouts.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span>
                    {formatMoney(p.amount)} · {formatDate(p.paidAt)}
                    {p.note && <span className="text-black/45"> · {p.note}</span>}
                  </span>
                  <button
                    className="text-black/30 hover:text-rose-500"
                    onClick={async () => {
                      if (!confirm("Delete this payout record?")) return;
                      await deletePayout(p.id);
                      router.refresh();
                    }}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="label">Amount paid (€)</label>
            <input type="number" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="text-xs text-black/40 mt-1">Open balance: {formatMoney(balance)}</p>
          </div>
          <div>
            <label className="label">Note (optional)</label>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Bank transfer 12.12." />
          </div>
          <button className="btn-primary w-full" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Record payout"}
          </button>
        </div>
      </Modal>
    </>
  );
}
