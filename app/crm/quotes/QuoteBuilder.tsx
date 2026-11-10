"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, TrashIcon, PackageIcon, SearchIcon, CoinsIcon } from "@/components/icons";
import { formatMoney, formatPrice, computeQuoteBreakdown, toDateInput } from "@/lib/format";
import { BILLINGS, BILLING_LABEL, BILLING_SUFFIX } from "@/lib/constants";
import { createQuote, updateQuote } from "./actions";
import { checkDiscounts } from "@/lib/guardrails";
import Link from "next/link";

export type BuilderPlan = {
  id: string;
  name: string;
  price: number;
  billing: string;
  unitLabel: string | null;
  description: string | null;
};
export type BuilderProduct = {
  id: string;
  name: string;
  family: string | null;
  color: string | null;
  imageUrl: string | null;
  commissionRate: number;
  /** Max total discount % without approval (null = no limit). */
  maxDiscount: number | null;
  /** False while the seller still has to pass the product's quiz. */
  canSell: boolean;
  plans: BuilderPlan[];
};
type Customer = { id: string; name: string; company: string | null };

export type LineItem = {
  key: string;
  productId?: string | null;
  planId?: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
  billing: string;
  unitLabel: string | null;
  listPrice?: number | null;
};

export default function QuoteBuilder({
  mode,
  customers,
  products,
  defaultVatRate,
  defaultValidUntil,
  initialCustomerId,
  initialProductId,
  quote,
  readOnly = false,
  commissionOverride = null,
}: {
  mode: "create" | "edit";
  customers: Customer[];
  products: BuilderProduct[];
  defaultVatRate: number;
  defaultValidUntil?: string;
  initialCustomerId?: string;
  initialProductId?: string;
  quote?: {
    id: string;
    customerName: string;
    items: LineItem[];
    discount: number;
    vatRate: number;
    notes: string | null;
    validUntil: string | null;
  };
  readOnly?: boolean;
  /** Seller's personal commission % (replaces the product rate when set). */
  commissionOverride?: number | null;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initialCustomerId || "");
  const [items, setItems] = useState<LineItem[]>(quote?.items || []);
  const [discount, setDiscount] = useState(quote?.discount ?? 0);
  const [vatRate, setVatRate] = useState(quote?.vatRate ?? defaultVatRate);
  const [notes, setNotes] = useState(quote?.notes || "");
  const [validUntil, setValidUntil] = useState(toDateInput(quote?.validUntil || defaultValidUntil || null));
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(initialProductId || products[0]?.id || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const commissionById = useMemo(
    () => new Map(products.map((p) => [p.id, commissionOverride ?? p.commissionRate])),
    [products, commissionOverride]
  );
  const maxById = useMemo(() => new Map(products.map((p) => [p.id, p.maxDiscount])), [products]);
  const guard = useMemo(() => {
    // Look up list prices for lines added from plans.
    const planPrice = new Map(products.flatMap((p) => p.plans.map((pl) => [pl.id, pl.price] as const)));
    return checkDiscounts(
      items.map((i) => ({
        productId: i.productId,
        name: i.name,
        unitPrice: i.unitPrice,
        listPrice: i.listPrice ?? (i.planId ? planPrice.get(i.planId) ?? null : null),
      })),
      discount,
      (pid) => (pid ? maxById.get(pid) ?? null : null)
    );
  }, [items, discount, products, maxById]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.family || "").toLowerCase().includes(q) ||
        p.plans.some((pl) => pl.name.toLowerCase().includes(q))
    );
  }, [products, search]);

  const breakdown = useMemo(
    () =>
      computeQuoteBreakdown(
        items.map((i) => ({ ...i, commissionRate: i.productId ? commissionById.get(i.productId) ?? 0 : 0 })),
        discount,
        vatRate
      ),
    [items, discount, vatRate, commissionById]
  );

  function addPlan(product: BuilderProduct, plan: BuilderPlan) {
    setSuccess(null);
    setItems((prev) => [
      ...prev,
      {
        key: `${plan.id}-${Date.now()}`,
        productId: product.id,
        planId: plan.id,
        name: `${product.name} — ${plan.name}`,
        quantity: 1,
        unitPrice: plan.price,
        billing: plan.billing,
        unitLabel: plan.unitLabel,
        listPrice: plan.price,
      },
    ]);
  }

  function addCustomLine(productId: string | null = null) {
    const product = products.find((p) => p.id === productId);
    setItems((prev) => [
      ...prev,
      {
        key: `custom-${Date.now()}`,
        productId,
        planId: null,
        name: product ? `${product.name} — ` : "",
        quantity: 1,
        unitPrice: 0,
        billing: "ONE_TIME",
        unitLabel: null,
      },
    ]);
  }

  function updateItem(key: string, patch: Partial<LineItem>) {
    setSuccess(null);
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function removeItem(key: string) {
    setSuccess(null);
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  async function handleSave() {
    setError(null);
    setSuccess(null);
    if (mode === "create" && !customerId) return setError("Choose a customer.");
    if (items.length === 0) return setError("Add at least one item.");
    if (items.some((i) => !i.name.trim())) return setError("Every line needs a name.");

    setBusy(true);
    const fd = new FormData();
    if (mode === "create") fd.set("customerId", customerId);
    else if (quote) fd.set("id", quote.id);
    fd.set(
      "items",
      JSON.stringify(
        items.map((i) => ({
          productId: i.productId || null,
          planId: i.planId || null,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          billing: i.billing,
          unitLabel: i.unitLabel,
        }))
      )
    );
    fd.set("discount", String(discount));
    fd.set("vatRate", String(vatRate));
    fd.set("notes", notes);
    fd.set("validUntil", validUntil);

    if (mode === "create") {
      const result = await createQuote(fd); // redirects on success
      setBusy(false);
      if (result && result.error) setError(result.error);
    } else {
      const result = await updateQuote(fd);
      setBusy(false);
      if (result && result.error) return setError(result.error);
      setSuccess("Saved.");
      router.refresh();
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left: customer + catalog */}
      <div className="lg:col-span-2 space-y-4">
        {mode === "create" && (
          <div className="card p-5">
            <label className="label">Customer</label>
            <select className="input" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Choose a customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company ? `${c.company} — ${c.name}` : c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!readOnly && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm">Your products</h2>
              <button type="button" className="text-xs text-brand-600 hover:underline" onClick={() => addCustomLine()}>
                + custom line
              </button>
            </div>
            <div className="relative mb-3">
              <SearchIcon className="h-4 w-4 text-black/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products & plans…"
                className="input pl-9 text-sm"
              />
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {filteredProducts.map((p) => {
                const open = expanded === p.id || !!search;
                return (
                  <div key={p.id} className="rounded-xl border border-black/5 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpanded(open && !search ? null : p.id)}
                      className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-sand-50"
                    >
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center overflow-hidden shrink-0 text-white"
                        style={{ background: p.color || "#4f46e5" }}
                      >
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <PackageIcon className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-black/40">
                          {p.plans.length} plan{p.plans.length === 1 ? "" : "s"}
                          {(commissionOverride ?? p.commissionRate) > 0
                            ? ` · ${commissionOverride ?? p.commissionRate}% commission`
                            : ""}
                          {p.maxDiscount !== null ? ` · max ${p.maxDiscount}% off` : ""}
                          {!p.canSell ? " · 🔒 quiz needed" : ""}
                        </div>
                      </div>
                      <span className="text-black/30 text-xs">{open ? "−" : "+"}</span>
                    </button>
                    {open && !p.canSell && (
                      <div className="border-t border-black/5 bg-amber-50 p-3 text-xs text-amber-800">
                        Pass the certification quiz to quote this product.{" "}
                        <Link href={`/crm/products/${p.id}/quiz`} className="font-medium underline">
                          Take the quiz →
                        </Link>
                      </div>
                    )}
                    {open && p.canSell && (
                      <div className="border-t border-black/5 bg-sand-50/50 p-2 space-y-1.5">
                        {p.plans.map((pl) => (
                          <button
                            type="button"
                            key={pl.id}
                            onClick={() => addPlan(p, pl)}
                            className="w-full flex items-center gap-3 rounded-lg bg-white border border-black/5 hover:border-brand-300 hover:bg-brand-50/40 p-2.5 text-left"
                            title={pl.description || undefined}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium truncate">{pl.name}</div>
                              <div className="text-xs text-black/45">
                                {formatPrice(pl.price, pl.billing, pl.unitLabel)}
                              </div>
                            </div>
                            <PlusIcon className="h-4 w-4 text-brand-500 shrink-0" />
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => addCustomLine(p.id)}
                          className="w-full text-xs text-black/45 hover:text-brand-600 py-1"
                        >
                          + custom line for {p.name}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <div className="text-center text-sm text-black/35 py-8">
                  {products.length === 0 ? "No products assigned to you yet." : "No products found."}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right: lines + totals */}
      <div className="lg:col-span-3 space-y-4">
        <div className="card">
          <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
            <h2 className="font-semibold text-sm">
              {mode === "edit" ? `Quote for ${quote?.customerName}` : "Quote lines"}
            </h2>
            <span className="text-xs text-black/40">
              {items.length} line{items.length === 1 ? "" : "s"}
            </span>
          </div>

          {items.length === 0 ? (
            <div className="px-5 py-12 text-center text-black/35 text-sm">
              Pick a plan on the left, or add a custom line.
            </div>
          ) : (
            <div className="divide-y divide-black/5">
              <div className="hidden md:grid grid-cols-[1fr_56px_96px_104px_88px_20px] gap-2 px-5 pt-3 text-[10px] uppercase tracking-wide text-black/35">
                <span>Item</span>
                <span className="text-center">Qty</span>
                <span>Price €</span>
                <span>Billing</span>
                <span className="text-right">Line</span>
                <span />
              </div>
              {items.map((item) => (
                <div
                  key={item.key}
                  className="px-5 py-3 grid grid-cols-1 md:grid-cols-[1fr_56px_96px_104px_88px_20px] gap-2 items-center"
                >
                  <div>
                    <input
                      value={item.name}
                      disabled={readOnly}
                      onChange={(e) => updateItem(item.key, { name: e.target.value })}
                      className="input text-sm py-2"
                      placeholder="Item name"
                    />
                    <input
                      value={item.unitLabel || ""}
                      disabled={readOnly}
                      onChange={(e) => updateItem(item.key, { unitLabel: e.target.value || null })}
                      className="mt-1 w-full text-xs text-black/50 bg-transparent px-1 focus:outline-none"
                      placeholder="per… (optional)"
                    />
                  </div>
                  <input
                    type="number"
                    min={1}
                    disabled={readOnly}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    className="input text-sm text-center py-2 px-1"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={readOnly}
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                    className="input text-sm py-2 px-2"
                  />
                  <select
                    value={item.billing}
                    disabled={readOnly}
                    onChange={(e) => updateItem(item.key, { billing: e.target.value })}
                    className="input text-sm py-2 px-2"
                  >
                    {BILLINGS.map((b) => (
                      <option key={b} value={b}>
                        {BILLING_LABEL[b]}
                      </option>
                    ))}
                  </select>
                  <div className="text-sm font-medium text-right">
                    {formatMoney(item.quantity * item.unitPrice)}
                    <span className="block text-[10px] text-black/35 font-normal">
                      {BILLING_SUFFIX[item.billing].replace(" / ", "per ")}
                    </span>
                  </div>
                  {!readOnly ? (
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="text-black/25 hover:text-red-500"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5 grid grid-cols-3 gap-4">
          <div>
            <label className="label">Discount (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.1"
              disabled={readOnly}
              value={discount}
              onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="input"
            />
          </div>
          <div>
            <label className="label">VAT (%)</label>
            <input
              type="number"
              min={0}
              step="0.1"
              disabled={readOnly}
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value) || 0)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Valid until</label>
            <input
              type="date"
              disabled={readOnly}
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="input"
            />
          </div>
          <div className="col-span-3">
            <label className="label">Notes & terms (shown on the quote)</label>
            <textarea
              value={notes}
              disabled={readOnly}
              onChange={(e) => setNotes(e.target.value)}
              className="input min-h-[70px]"
              placeholder="Onboarding included, minimum term 12 months, payment terms…"
            />
          </div>
        </div>

        <div className="card p-5">
          {breakdown.groups.length === 0 && <div className="text-sm text-black/40">No lines yet.</div>}
          <div className="space-y-4">
            {breakdown.groups.map((g) => {
              const sfx = BILLING_SUFFIX[g.billing];
              return (
                <div key={g.billing} className="space-y-1.5 text-sm">
                  {breakdown.groups.length > 1 && (
                    <div className="section-title text-brand-600">{BILLING_LABEL[g.billing]}</div>
                  )}
                  <Row label="Subtotal" value={formatMoney(g.subtotal) + sfx} />
                  {discount > 0 && (
                    <Row label={`Discount (${discount}%)`} value={`-${formatMoney(g.discountAmount)}${sfx}`} />
                  )}
                  <Row label={`VAT (${vatRate}%)`} value={formatMoney(g.vatAmount) + sfx} />
                  <div className="flex justify-between text-base font-semibold pt-1.5 border-t border-black/5">
                    <span>Total</span>
                    <span>
                      {formatMoney(g.total)}
                      {sfx}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {items.length > 0 && (
            <div className="mt-4 rounded-xl bg-sand-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-black/55">
                First-year value (excl. VAT): <strong className="text-ink-900">{formatMoney(breakdown.annualNet)}</strong>
              </span>
              {breakdown.commission > 0 && (
                <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                  <CoinsIcon className="h-4 w-4" />
                  Your commission ≈ {formatMoney(breakdown.commission)}
                </span>
              )}
            </div>
          )}

          {guard.needsApproval && !readOnly && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3">
              <div className="font-medium">Needs manager approval</div>
              <ul className="list-disc pl-5 mt-1 text-xs space-y-0.5">
                {guard.issues.map((i) => (
                  <li key={i.name}>
                    {i.name}: {i.discount}% off list (your limit is {i.max}%)
                  </li>
                ))}
              </ul>
              <div className="text-xs mt-1">You can save it — your manager is asked automatically.</div>
            </div>
          )}
          {error && <div className="error-box mt-4">{error}</div>}
          {success && <div className="success-box mt-4">{success}</div>}

          {!readOnly && (
            <button type="button" className="btn-primary w-full mt-4" disabled={busy} onClick={handleSave}>
              {busy ? "Saving…" : mode === "create" ? "Save draft quote" : "Save changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-black/55">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
