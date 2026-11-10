"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import Badge from "@/components/Badge";
import { PlusIcon, SearchIcon, CalendarIcon } from "@/components/icons";
import { createCustomer, importMyLeads } from "./actions";
import CsvImport from "@/components/CsvImport";
import CustomerForm from "./CustomerForm";
import { LEAD_STATUSES, LEAD_STATUS_LABEL } from "@/lib/constants";
import { followUpLabel, formatMoney, timeAgo } from "@/lib/format";

type Row = {
  id: string;
  name: string;
  jobTitle: string | null;
  company: string | null;
  segment: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: string;
  estimatedValue: number | null;
  nextFollowUpAt: string | null;
  lastContactAt: string | null;
  updatedAt: string;
  quoteCount: number;
  products: { id: string; name: string; color: string | null }[];
};

export default function CustomersManager({
  customers,
  products,
  initialStage,
  initialProduct,
  initialDue,
}: {
  customers: Row[];
  products: { id: string; name: string }[];
  initialStage?: string;
  initialProduct?: string;
  initialDue?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState(initialStage || "OPEN");
  const [product, setProduct] = useState(initialProduct || "ALL");
  const [dueOnly, setDueOnly] = useState(!!initialDue);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: customers.length, OPEN: 0 };
    for (const s of LEAD_STATUSES) c[s] = 0;
    for (const x of customers) {
      c[x.status] = (c[x.status] || 0) + 1;
      if (x.status !== "WON" && x.status !== "LOST") c.OPEN++;
    }
    return c;
  }, [customers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => {
      if (stage === "OPEN" && (c.status === "WON" || c.status === "LOST")) return false;
      if (stage !== "OPEN" && stage !== "ALL" && c.status !== stage) return false;
      if (product !== "ALL" && !c.products.some((p) => p.id === product)) return false;
      if (dueOnly) {
        if (!c.nextFollowUpAt) return false;
        const f = followUpLabel(c.nextFollowUpAt);
        if (!f.overdue && !f.today) return false;
      }
      if (!q) return true;
      return [c.name, c.company, c.email, c.segment, c.city, c.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q));
    });
  }, [customers, query, stage, product, dueOnly]);

  async function handleCreate(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = await createCustomer(fd); // redirects to the new customer on success
    setBusy(false);
    if (result && result.error) setError(result.error);
  }

  const stages = ["OPEN", "ALL", ...LEAD_STATUSES];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-black/50 text-sm mt-1">Your leads and clients, from first call to signed deal.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CsvImport
            onImport={importMyLeads}
            hint="Import your own lead list. Leads are added to your customers as New leads. Contacts that already exist in the CRM (same email) are skipped."
          />
          <button
            className="btn-primary"
            onClick={() => {
              setError(null);
              setAddOpen(true);
            }}
          >
            <PlusIcon className="h-4 w-4" />
            Add customer
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {stages.map((s) => (
          <button key={s} onClick={() => setStage(s)} className={stage === s ? "chip-active" : "chip"}>
            {s === "OPEN" ? "Open" : s === "ALL" ? "All" : LEAD_STATUS_LABEL[s]}
            <span className="ml-1.5 opacity-60">{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <SearchIcon className="h-4 w-4 text-black/30 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, company, city, segment…"
            className="input pl-10"
          />
        </div>
        {products.length > 1 && (
          <select value={product} onChange={(e) => setProduct(e.target.value)} className="input w-auto">
            <option value="ALL">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-black/60">
          <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} />
          Follow-up due
        </label>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/40 border-b border-black/5">
              <th className="px-5 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Products</th>
              <th className="px-3 py-3 font-medium">Stage</th>
              <th className="px-3 py-3 font-medium">Follow-up</th>
              <th className="px-3 py-3 font-medium text-right">Est. value</th>
              <th className="px-5 py-3 font-medium text-right">Last contact</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {filtered.map((c) => {
              const f = c.nextFollowUpAt ? followUpLabel(c.nextFollowUpAt) : null;
              return (
                <tr key={c.id} className="hover:bg-sand-50">
                  <td className="px-5 py-3">
                    <Link href={`/crm/customers/${c.id}`} className="block">
                      <div className="font-medium hover:text-brand-600">{c.company || c.name}</div>
                      <div className="text-xs text-black/45">
                        {c.company ? c.name : ""}
                        {c.company && c.jobTitle ? `, ${c.jobTitle}` : ""}
                        {(c.segment || c.city) && (
                          <span className="text-black/30">
                            {c.company ? " · " : ""}
                            {[c.segment, c.city].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.products.map((p) => (
                        <span
                          key={p.id}
                          className="text-[11px] px-2 py-0.5 rounded-full text-white whitespace-nowrap"
                          style={{ background: p.color || "#4f46e5" }}
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant={c.status}>{LEAD_STATUS_LABEL[c.status]}</Badge>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {f ? (
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs ${
                          f.overdue ? "text-rose-600 font-medium" : f.today ? "text-amber-600 font-medium" : "text-black/50"
                        }`}
                      >
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {f.text}
                      </span>
                    ) : (
                      <span className="text-xs text-black/25">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {c.estimatedValue ? formatMoney(c.estimatedValue) : <span className="text-black/25">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-black/45 whitespace-nowrap">
                    {c.lastContactAt ? timeAgo(c.lastContactAt) : "never"}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-black/40 text-sm">
                  {customers.length === 0
                    ? "No customers yet. Add your first lead to get started."
                    : "No customers match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add customer" wide>
        <CustomerForm
          products={products}
          busy={busy}
          error={error}
          onSubmit={handleCreate}
          submitLabel="Add customer"
          extraHidden={{ open: "1" }}
        />
      </Modal>
    </div>
  );
}
