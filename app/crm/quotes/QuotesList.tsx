"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Badge from "@/components/Badge";
import { PlusIcon, FileIcon } from "@/components/icons";
import { formatMoney, formatDate } from "@/lib/format";
import { QUOTE_STATUSES, QUOTE_STATUS_LABEL } from "@/lib/constants";

type Quote = {
  id: string;
  number: string;
  customerName: string;
  status: string;
  annualNet: number;
  commission: number;
  itemCount: number;
  createdAt: string;
  validUntil: string | null;
};

export default function QuotesList({ quotes }: { quotes: Quote[] }) {
  const [tab, setTab] = useState("ALL");
  const filtered = useMemo(() => (tab === "ALL" ? quotes : quotes.filter((q) => q.status === tab)), [quotes, tab]);
  const now = Date.now();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="text-black/50 text-sm mt-1">Values are first-year, excl. VAT.</p>
        </div>
        <Link href="/crm/quotes/new" className="btn-primary">
          <PlusIcon className="h-4 w-4" />
          New quote
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {["ALL", ...QUOTE_STATUSES].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "chip-active" : "chip"}>
            {t === "ALL" ? "All" : QUOTE_STATUS_LABEL[t]}
            <span className="ml-1.5 opacity-60">
              {t === "ALL" ? quotes.length : quotes.filter((q) => q.status === t).length}
            </span>
          </button>
        ))}
      </div>

      <div className="card divide-y divide-black/5">
        {filtered.map((q) => {
          const expired = q.status === "SENT" && q.validUntil && new Date(q.validUntil).getTime() < now;
          return (
            <Link
              key={q.id}
              href={`/crm/quotes/${q.id}`}
              className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-sand-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="h-9 w-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <FileIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{q.customerName}</div>
                  <div className="text-xs text-black/40">
                    {q.number} · {q.itemCount} line{q.itemCount === 1 ? "" : "s"} · {formatDate(q.createdAt)}
                    {expired && <span className="text-rose-500"> · expired</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <div className="text-sm font-medium">{formatMoney(q.annualNet)}</div>
                  {q.commission > 0 && (
                    <div className="text-[11px] text-emerald-600">{formatMoney(q.commission)} commission</div>
                  )}
                </div>
                <Badge variant={q.status}>{QUOTE_STATUS_LABEL[q.status]}</Badge>
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center text-black/40 text-sm">
            No quotes {tab !== "ALL" ? `marked ${QUOTE_STATUS_LABEL[tab].toLowerCase()}` : "yet"}.
          </div>
        )}
      </div>
    </div>
  );
}
