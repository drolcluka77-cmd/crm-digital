"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addActivity } from "@/app/crm/customers/actions";
import { ACTIVITY_TYPE_LABEL, LEAD_STATUSES, LEAD_STATUS_LABEL, MANUAL_ACTIVITY_TYPES } from "@/lib/constants";
import { toDateInput } from "@/lib/format";
import { SearchIcon, PhoneIcon } from "@/components/icons";

type C = { id: string; name: string; company: string | null; phone: string | null; status: string };

const FOLLOW = [
  ["None", null],
  ["Tomorrow", 1],
  ["3 days", 3],
  ["1 week", 7],
  ["2 weeks", 14],
] as const;

export default function QuickLog({ customers, initialCustomerId }: { customers: C[]; initialCustomerId?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<C | null>(customers.find((c) => c.id === initialCustomerId) || null);
  const [type, setType] = useState<string>("CALL");
  const [body, setBody] = useState("");
  const [follow, setFollow] = useState<number | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? customers.filter((c) => [c.name, c.company, c.phone].filter(Boolean).some((v) => v!.toLowerCase().includes(q)))
      : customers;
    return list.slice(0, 30);
  }, [customers, query]);

  async function save() {
    if (!customer) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("customerId", customer.id);
    fd.set("type", type);
    fd.set("body", body);
    if (follow) {
      const d = new Date();
      d.setDate(d.getDate() + follow);
      fd.set("nextFollowUpAt", toDateInput(d));
    }
    if (status) fd.set("status", status);
    const result = await addActivity(fd);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setDone(customer.company || customer.name);
    setBody("");
    setFollow(null);
    setStatus("");
    setCustomer(null);
    setQuery("");
    router.refresh();
  }

  if (!customer) {
    return (
      <div className="max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Quick log</h1>
        <p className="text-black/50 text-sm mb-4">Who did you just talk to?</p>
        {done && (
          <div className="success-box mb-4">
            Logged for {done}. ✔
          </div>
        )}
        <div className="relative mb-3">
          <SearchIcon className="h-5 w-5 text-black/30 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, company or phone"
            className="input pl-12 py-3.5 text-base"
          />
        </div>
        <div className="card divide-y divide-black/5">
          {matches.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setDone(null);
                setCustomer(c);
              }}
              className="w-full text-left px-4 py-3.5 flex items-center justify-between gap-3 hover:bg-sand-50 active:bg-sand-100"
            >
              <span className="min-w-0">
                <span className="block font-medium truncate">{c.company || c.name}</span>
                <span className="block text-xs text-black/45 truncate">
                  {c.company ? `${c.name} · ` : ""}
                  {LEAD_STATUS_LABEL[c.status]}
                </span>
              </span>
              <span className="text-black/30 text-lg">›</span>
            </button>
          ))}
          {matches.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-black/40">
              No match.{" "}
              <Link href="/crm/customers" className="text-brand-600 underline">
                Add a new customer
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <button onClick={() => setCustomer(null)} className="text-sm text-black/45 mb-3">
        ← Change customer
      </button>
      <div className="card p-4 mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold truncate">{customer.company || customer.name}</div>
          <div className="text-xs text-black/45">{LEAD_STATUS_LABEL[customer.status]}</div>
        </div>
        {customer.phone && (
          <a href={`tel:${customer.phone}`} className="btn-secondary">
            <PhoneIcon className="h-4 w-4" /> Call
          </a>
        )}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
        {MANUAL_ACTIVITY_TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-xl py-3 text-sm font-medium border ${
              type === t ? "bg-ink-900 text-white border-ink-900" : "bg-white border-black/10 text-black/65"
            }`}
          >
            {ACTIVITY_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="input min-h-[140px] text-base mb-4"
        placeholder="What happened? What's next?"
      />

      <div className="section-title mb-2">Follow up</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {FOLLOW.map(([label, days]) => (
          <button
            key={label}
            onClick={() => setFollow(days)}
            className={`${follow === days ? "chip-active" : "chip"} py-2 px-4`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="section-title mb-2">Stage</div>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="input py-3 mb-5">
        <option value="">Keep “{LEAD_STATUS_LABEL[customer.status]}”</option>
        {LEAD_STATUSES.filter((s) => s !== customer.status).map((s) => (
          <option key={s} value={s}>
            {LEAD_STATUS_LABEL[s]}
          </option>
        ))}
      </select>

      {error && <div className="error-box mb-3">{error}</div>}
      <button className="btn-primary w-full py-3.5 text-base" disabled={busy || !body.trim()} onClick={save}>
        {busy ? "Saving…" : `Save ${ACTIVITY_TYPE_LABEL[type].toLowerCase()}`}
      </button>
      <Link href={`/crm/customers/${customer.id}`} className="block text-center text-sm text-black/45 mt-4">
        Open full customer page
      </Link>
    </div>
  );
}
