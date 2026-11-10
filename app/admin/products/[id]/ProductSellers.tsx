"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { setProductSellers } from "../actions";

type Seller = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  managerName: string | null;
};

export default function ProductSellers({
  productId,
  productActive,
  sellers,
  initialSelected,
}: {
  productId: string;
  productActive: boolean;
  sellers: Seller[];
  initialSelected: string[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dirty = useMemo(() => {
    if (selected.size !== initialSelected.length) return true;
    return initialSelected.some((id) => !selected.has(id));
  }, [selected, initialSelected]);

  const groups = useMemo(() => {
    const map = new Map<string, Seller[]>();
    for (const s of sellers) {
      const key = s.managerName ? `${s.managerName}'s team` : "No manager";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  }, [sellers]);

  function toggle(id: string) {
    setMessage(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setBusy(true);
    const result = await setProductSellers(productId, Array.from(selected));
    setBusy(false);
    setMessage((result && (result.error || result.success)) || "Saved.");
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold">Who can sell this</h2>
          <p className="text-sm text-black/45">
            Sellers only see products ticked here (managers can also change this for their team
            under Product access).
            {!productActive && " This product is hidden, so nobody sees it until you make it live."}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="btn-ghost text-xs"
            onClick={() => setSelected(new Set(sellers.filter((s) => s.active).map((s) => s.id)))}
          >
            Select all
          </button>
          <button className="btn-ghost text-xs" onClick={() => setSelected(new Set())}>
            Clear
          </button>
          <button className="btn-primary" onClick={save} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save access"}
          </button>
        </div>
      </div>
      {message && <div className="success-box mb-3">{message}</div>}

      <div className="card p-5 space-y-5">
        {sellers.length === 0 && (
          <div className="text-center text-black/40 text-sm py-4">
            No sellers yet — add them under Team.
          </div>
        )}
        {groups.map(([group, list]) => (
          <div key={group}>
            <div className="section-title mb-2">{group}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {list.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                    selected.has(s.id)
                      ? "border-brand-300 bg-brand-50/60"
                      : "border-black/10 hover:bg-sand-50"
                  } ${s.active ? "" : "opacity-50"}`}
                >
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">
                      {s.name}
                      {!s.active && " (deactivated)"}
                    </span>
                    <span className="block text-xs text-black/40 truncate">{s.email}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
