"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/Badge";
import { PackageIcon, TrashIcon, LayersIcon } from "@/components/icons";
import { toggleProductActive, duplicateProduct, deleteProduct } from "../actions";

export default function ProductHeader({
  product,
  quoteLines,
}: {
  product: {
    id: string;
    name: string;
    family: string | null;
    active: boolean;
    color: string | null;
    imageUrl: string | null;
  };
  quoteLines: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await toggleProductActive(product.id, !product.active);
    setBusy(false);
    router.refresh();
  }

  async function duplicate() {
    if (!confirm(`Create a copy of "${product.name}" as a new edition? It starts hidden.`)) return;
    setBusy(true);
    await duplicateProduct(product.id); // redirects to the copy
    setBusy(false);
  }

  async function remove() {
    if (!confirm(`Delete "${product.name}" with its plans and materials? This can't be undone.`)) return;
    setBusy(true);
    const result = await deleteProduct(product.id);
    setBusy(false);
    if (result && result.error) alert(result.error);
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mt-3 mb-5">
      <div className="flex items-center gap-4">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 text-white"
          style={{ background: product.color || "#4f46e5" }}
        >
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <PackageIcon className="h-6 w-6" />
          )}
        </div>
        <div>
          {product.family && <div className="section-title mb-0.5">{product.family}</div>}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
            <Badge variant={product.active ? "WON" : "MUTED"}>
              {product.active ? "Live for sellers" : "Hidden"}
            </Badge>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={toggle} disabled={busy}>
          {product.active ? "Hide from sellers" : "Make live"}
        </button>
        <button className="btn-ghost" onClick={duplicate} disabled={busy} title="Duplicate as a new edition">
          <LayersIcon className="h-4 w-4" />
          Duplicate
        </button>
        <button
          className="btn-danger"
          onClick={remove}
          disabled={busy}
          title={quoteLines > 0 ? "Used in quotes — hide it instead" : "Delete product"}
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
