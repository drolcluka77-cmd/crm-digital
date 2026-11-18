"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  runImport,
  saveFinderSettings,
  saveRule,
  deleteRule,
  rematchAvailable,
  setSellerQuota,
  setProspectStatus,
} from "./actions";

const STATUS_LABEL: Record<string, string> = {
  NEW: "Available",
  RECOMMENDED: "Recommended",
  CLAIMED: "Claimed",
  REJECTED: "Not a fit",
  DO_NOT_CONTACT: "Do not contact",
};

type Rule = { id: string; productId: string; productName: string; keywords: string; exclude: string | null; priority: number; active: boolean };

export default function LeadFinderManager(props: {
  isAdmin: boolean;
  attribution: string;
  googleReady: boolean;
  aiReady: boolean;
  settings: { daily: number; expiry: number; lookupCap: number; autoImport: boolean; lastImportAt: string | null; lastImportNote: string | null };
  lookupsToday: number;
  statusCounts: Record<string, number>;
  availableByProduct: { name: string; count: number }[];
  products: { id: string; name: string }[];
  rules: Rule[];
  sellers: { id: string; name: string; quota: number | null; open: number; claimed: number }[];
  filters: { q: string; status: string; product: string };
  prospects: { id: string; name: string; town: string | null; legalForm: string | null; product: string | null; keyword: string | null; status: string; who: string | null; phone: string | null; email: string | null; reason: string | null }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [editing, setEditing] = useState<Rule | "new" | null>(null);

  async function act(key: string, fn: () => Promise<any>) {
    setBusy(key);
    setMsg(null);
    const res = await fn();
    setBusy(null);
    setMsg(res || null);
    router.refresh();
    return res;
  }

  const s = props.settings;
  const total = Object.values(props.statusCounts).reduce((a, b) => a + b, 0);

  function filterHref(patch: Partial<typeof props.filters>) {
    const f = { ...props.filters, ...patch };
    const p = new URLSearchParams();
    if (f.q) p.set("q", f.q);
    if (f.status !== "ALL") p.set("status", f.status);
    if (f.product !== "ALL") p.set("product", f.product);
    return `/admin/lead-finder${p.toString() ? "?" + p.toString() : ""}`;
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lead finder</h1>
          <p className="text-black/50 text-sm mt-1 max-w-2xl">
            Finds companies in the Slovenian Business Register (AJPES open data), suggests a product from keywords in
            their name, and recommends a few to each seller every day. Sellers look up the contact and claim the ones
            worth calling.
          </p>
        </div>
        <button className="btn-primary" disabled={!!busy} onClick={() => act("import", runImport)}>
          {busy === "import" ? "Importing… (about a minute)" : "Run import now"}
        </button>
      </div>

      {msg?.error && <div className="error-box mb-4">{msg.error}</div>}
      {msg?.success && <div className="success-box mb-4">{msg.success}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {(["NEW", "RECOMMENDED", "CLAIMED", "REJECTED"] as const).map((k) => (
          <a key={k} href={filterHref({ status: k })} className="card p-4 hover:bg-sand-50">
            <div className="text-xs text-black/45">{STATUS_LABEL[k]}</div>
            <div className="text-2xl font-semibold mt-1">{(props.statusCounts[k] || 0) + (k === "REJECTED" ? props.statusCounts.DO_NOT_CONTACT || 0 : 0)}</div>
          </a>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-6">
        <div className="card p-5">
          <h2 className="font-semibold mb-1">Last import</h2>
          <p className="text-sm text-black/60">
            {s.lastImportAt ? `${new Date(s.lastImportAt).toLocaleString("sl-SI")} — ${s.lastImportNote}` : "No import yet. Run one to fill the pool."}
          </p>
          <p className="text-xs text-black/40 mt-2">The AJPES list is refreshed twice a month. {total} companies in the lead finder so far.</p>
          {props.availableByProduct.length > 0 && (
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-black/40 mb-1.5">Available by product</div>
              <div className="flex flex-wrap gap-2">
                {props.availableByProduct.map((p) => (
                  <span key={p.name} className="chip">{p.name} <span className="ml-1.5 opacity-60">{p.count}</span></span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-4 text-xs text-black/55 space-y-1">
            <div>Contact look-up: Google Places {props.googleReady ? "✓ connected" : "— not set up"} · AI {props.aiReady ? "✓ connected" : "— not set up (add ANTHROPIC_API_KEY)"}</div>
            <div>Look-ups today: {props.lookupsToday} / {s.lookupCap}</div>
          </div>
        </div>

        <form
          className="card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            act("settings", () => saveFinderSettings(fd));
          }}
        >
          <h2 className="font-semibold mb-3">How it works</h2>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="label">New leads per seller per day</span>
              <input name="daily" type="number" min={0} max={100} defaultValue={s.daily} className="input" />
            </label>
            <label className="text-sm">
              <span className="label">Unclaimed go back after (days)</span>
              <input name="expiry" type="number" min={1} max={60} defaultValue={s.expiry} className="input" />
            </label>
            <label className="text-sm">
              <span className="label">Contact look-ups per day (company)</span>
              <input name="lookupCap" type="number" min={0} max={5000} defaultValue={s.lookupCap} className="input" />
            </label>
            <label className="text-sm flex items-end gap-2 pb-2">
              <input name="autoImport" type="checkbox" defaultChecked={s.autoImport} />
              Import automatically (with the daily job, every 2 weeks)
            </label>
          </div>
          <button className="btn-secondary mt-4" disabled={!!busy}>{busy === "settings" ? "Saving…" : "Save"}</button>
        </form>
      </div>

      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-black/5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Rules — which companies go to which product</h2>
            <p className="text-xs text-black/45 mt-0.5">
              Keywords are matched against the start of words in the registered name, without accents (“instalacije” also matches “inštalacije”). Comma-separated.
            </p>
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary py-1.5" disabled={!!busy} onClick={() => act("rematch", rematchAvailable)}>
              {busy === "rematch" ? "Re-matching…" : "Re-match available leads"}
            </button>
            <button className="btn-primary py-1.5" onClick={() => setEditing("new")}>Add rule</button>
          </div>
        </div>
        {editing && (
          <form
            key={editing === "new" ? "new" : editing.id}
            className="px-5 py-4 border-b border-black/5 bg-sand-50 grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const res = await act("rule", () => saveRule(fd));
              if (!res?.error) setEditing(null);
            }}
          >
            <input type="hidden" name="id" value={editing === "new" ? "" : editing.id} />
            <div className="grid sm:grid-cols-[1fr_120px_auto] gap-3 items-end">
              <label className="text-sm">
                <span className="label">Product</span>
                <select name="productId" className="input" defaultValue={editing === "new" ? "" : editing.productId} required>
                  <option value="" disabled>Choose…</option>
                  {props.products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="label">Priority</span>
                <input name="priority" type="number" min={-10} max={10} defaultValue={editing === "new" ? 0 : editing.priority} className="input" />
              </label>
              <label className="text-sm flex items-center gap-2 pb-2">
                <input name="active" type="checkbox" defaultChecked={editing === "new" ? true : editing.active} /> Active
              </label>
            </div>
            <label className="text-sm">
              <span className="label">Keywords in the company name</span>
              <textarea name="keywords" rows={2} className="input" defaultValue={editing === "new" ? "" : editing.keywords} placeholder="hotel, penzion, garni" required />
            </label>
            <label className="text-sm">
              <span className="label">Exclude if the name contains</span>
              <input name="exclude" className="input" defaultValue={editing === "new" ? "" : editing.exclude || ""} placeholder="trgovina" />
            </label>
            <div className="flex gap-2">
              <button className="btn-primary" disabled={!!busy}>{busy === "rule" ? "Saving…" : "Save rule"}</button>
              <button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        )}
        <div className="divide-y divide-black/5">
          {props.rules.map((r) => (
            <div key={r.id} className={`px-5 py-3 flex flex-wrap items-start justify-between gap-3 ${r.active ? "" : "opacity-50"}`}>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm">
                  {r.productName}
                  <span className="text-xs text-black/40 font-normal ml-2">priority {r.priority}{r.active ? "" : " · off"}</span>
                </div>
                <div className="text-sm text-black/65 mt-0.5">{r.keywords}</div>
                {r.exclude && <div className="text-xs text-black/45 mt-0.5">Not if: {r.exclude}</div>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="btn-secondary py-1" onClick={() => setEditing(r)}>Edit</button>
                <button
                  className="btn-secondary py-1 text-rose-700"
                  disabled={!!busy}
                  onClick={() => {
                    if (confirm("Delete this rule? Leads already found stay.")) act("del" + r.id, () => deleteRule(r.id));
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {props.rules.length === 0 && <div className="px-5 py-6 text-sm text-black/40 text-center">No rules yet.</div>}
        </div>
      </div>

      {props.sellers.length > 0 && (
        <div className="card mb-6">
          <div className="px-5 py-4 border-b border-black/5">
            <h2 className="font-semibold">Sellers</h2>
            <p className="text-xs text-black/45 mt-0.5">Leave empty to use the default ({s.daily} a day). 0 = no recommendations. Sellers only get leads for products they may sell.</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40 border-b border-black/5">
                <th className="px-5 py-2 font-medium">Seller</th>
                <th className="px-3 py-2 font-medium">Leads per day</th>
                <th className="px-3 py-2 font-medium">Open now</th>
                <th className="px-3 py-2 font-medium">Claimed</th>
              </tr>
            </thead>
            <tbody>
              {props.sellers.map((u) => (
                <tr key={u.id} className="border-b border-black/5 last:border-0">
                  <td className="px-5 py-2">{u.name}</td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={u.quota ?? ""}
                      placeholder={String(s.daily)}
                      className="input w-24 py-1"
                      onBlur={(e) => {
                        const v = e.target.value;
                        if (v !== String(u.quota ?? "")) act("q" + u.id, () => setSellerQuota(u.id, v));
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">{u.open}</td>
                  <td className="px-3 py-2">{u.claimed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="px-5 py-4 border-b border-black/5 flex flex-wrap items-center gap-3">
          <h2 className="font-semibold mr-auto">Leads</h2>
          <form action="/admin/lead-finder" className="flex flex-wrap gap-2">
            <input name="q" defaultValue={props.filters.q} placeholder="Search name…" className="input py-1.5 w-48" />
            <select name="status" defaultValue={props.filters.status} className="input py-1.5 w-auto">
              <option value="ALL">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select name="product" defaultValue={props.filters.product} className="input py-1.5 w-auto">
              <option value="ALL">All products</option>
              {props.products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button className="btn-secondary py-1.5">Filter</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-black/40 border-b border-black/5">
                <th className="px-5 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {props.prospects.map((p) => (
                <tr key={p.id} className="border-b border-black/5 last:border-0 align-top">
                  <td className="px-5 py-2.5">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-black/45">{[p.legalForm, p.town].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {p.product || "—"}
                    {p.keyword && <div className="text-black/40">“{p.keyword}”</div>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {STATUS_LABEL[p.status] || p.status}
                    {p.who && <div className="text-black/45">{p.who}</div>}
                    {p.reason && <div className="text-black/45">{p.reason}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-xs">{[p.phone, p.email].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap">
                    {p.status !== "CLAIMED" && p.status !== "NEW" && (
                      <button className="text-xs underline text-black/55 mr-2" onClick={() => act("s" + p.id, () => setProspectStatus(p.id, "NEW"))}>
                        Make available
                      </button>
                    )}
                    {p.status !== "CLAIMED" && p.status !== "DO_NOT_CONTACT" && (
                      <button className="text-xs underline text-rose-700" onClick={() => act("s" + p.id, () => setProspectStatus(p.id, "DO_NOT_CONTACT"))}>
                        Do not contact
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {props.prospects.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-black/40">No leads match.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-black/35 mt-6">{props.attribution}</p>
    </div>
  );
}
