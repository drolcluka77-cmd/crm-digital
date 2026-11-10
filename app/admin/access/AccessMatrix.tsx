"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setAccess, setProductForTeam } from "./actions";

type Product = {
  id: string;
  name: string;
  family: string | null;
  active: boolean;
  color: string | null;
  requireCertification: boolean;
};
type Seller = {
  id: string;
  name: string;
  active: boolean;
  managerName: string | null;
  productIds: string[];
  certifiedIds: string[];
};

/**
 * Seller × product grid. Each tick is saved immediately; the column header
 * buttons grant/revoke a product for the whole team at once.
 */
export default function AccessMatrix({
  products,
  sellers,
  isAdmin,
}: {
  products: Product[];
  sellers: Seller[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [grid, setGrid] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(sellers.map((s) => [s.id, new Set(s.productIds)]))
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(sellerId: string, productId: string) {
    const has = grid[sellerId]?.has(productId);
    setError(null);
    setPending(`${sellerId}:${productId}`);
    // Optimistic update.
    setGrid((g) => {
      const next = new Set(g[sellerId]);
      if (has) next.delete(productId);
      else next.add(productId);
      return { ...g, [sellerId]: next };
    });
    const result = await setAccess(sellerId, productId, !has);
    setPending(null);
    if (result && result.error) {
      setError(result.error);
      router.refresh();
    }
  }

  async function column(productId: string, granted: boolean) {
    setError(null);
    setPending(`col:${productId}`);
    const result = await setProductForTeam(productId, granted);
    setPending(null);
    if (result && result.error) return setError(result.error);
    setGrid((g) => {
      const next: Record<string, Set<string>> = {};
      for (const [sid, set] of Object.entries(g)) {
        const s = new Set(set);
        if (granted) s.add(productId);
        else s.delete(productId);
        next[sid] = s;
      }
      return next;
    });
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Product access</h1>
        <p className="text-black/50 text-sm mt-1">
          Tick which products each seller sees. Sellers only get the plans, prices, playbook and
          materials of products ticked here. Changes save instantly.
          {isAdmin ? "" : " You can change this for sellers on your team."}
        </p>
      </div>

      {error && <div className="error-box mb-4">{error}</div>}

      {sellers.length === 0 || products.length === 0 ? (
        <div className="card p-10 text-center text-black/40 text-sm">
          {sellers.length === 0 ? "No sellers yet — add them under Team." : "No products yet."}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-black/5">
                <th className="text-left font-medium px-5 py-3 sticky left-0 bg-white min-w-[200px]">Seller</th>
                {products.map((p) => (
                  <th key={p.id} className="px-3 py-3 font-medium align-bottom min-w-[130px]">
                    <div className="flex flex-col items-center gap-1.5 text-center">
                      <span className="h-1.5 w-8 rounded-full" style={{ background: p.color || "#4f46e5" }} />
                      <span className="leading-tight">{p.name}</span>
                      {!p.active && <span className="text-[10px] text-black/35 font-normal">hidden</span>}
                      {p.requireCertification && (
                        <span className="text-[10px] text-amber-600 font-normal">quiz required</span>
                      )}
                      <span className="flex gap-1 text-[11px] font-normal">
                        <button
                          className="text-brand-600 hover:underline disabled:opacity-40"
                          disabled={pending === `col:${p.id}`}
                          onClick={() => column(p.id, true)}
                        >
                          all
                        </button>
                        <span className="text-black/20">/</span>
                        <button
                          className="text-black/45 hover:underline disabled:opacity-40"
                          disabled={pending === `col:${p.id}`}
                          onClick={() => column(p.id, false)}
                        >
                          none
                        </button>
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {sellers.map((s) => (
                <tr key={s.id} className={s.active ? "" : "opacity-50"}>
                  <td className="px-5 py-3 sticky left-0 bg-white">
                    <div className="font-medium">{s.name}</div>
                    {isAdmin && (
                      <div className="text-xs text-black/40">{s.managerName ? `${s.managerName}'s team` : "No manager"}</div>
                    )}
                  </td>
                  {products.map((p) => {
                    const on = grid[s.id]?.has(p.id);
                    return (
                      <td key={p.id} className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand-500 cursor-pointer"
                          checked={!!on}
                          disabled={pending === `${s.id}:${p.id}`}
                          onChange={() => toggle(s.id, p.id)}
                          aria-label={`${s.name} — ${p.name}`}
                        />
                        {on && p.requireCertification && (
                          <div className={`text-[10px] ${s.certifiedIds.includes(p.id) ? "text-emerald-600" : "text-amber-600"}`}>
                            {s.certifiedIds.includes(p.id) ? "certified" : "learning"}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
