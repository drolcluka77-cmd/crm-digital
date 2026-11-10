"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import Badge from "@/components/Badge";
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from "@/components/icons";
import MaterialIcon from "@/components/MaterialIcon";
import { createMaterial, updateMaterial, deleteMaterial } from "./actions";
import { MATERIAL_TYPES, MATERIAL_TYPE_LABEL } from "@/lib/constants";
import { formatDate, formatFileSize } from "@/lib/format";

export type AdminMaterial = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  productId: string | null;
  productName: string | null;
  fileName: string | null;
  fileSize: number | null;
  linkUrl: string | null;
  internalOnly: boolean;
  sortOrder: number;
  uploadedAt: string;
  shareCount: number;
};

type ProductOption = { id: string; name: string };

export default function MaterialsManager({
  materials,
  products,
  fixedProductId,
  compact = false,
}: {
  materials: AdminMaterial[];
  products: ProductOption[];
  /** When set (product editor), new materials are attached to this product. */
  fixedProductId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<AdminMaterial | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState("ALL");

  const filtered = useMemo(() => {
    if (fixedProductId || productFilter === "ALL") return materials;
    if (productFilter === "GENERAL") return materials.filter((m) => !m.productId);
    return materials.filter((m) => m.productId === productFilter);
  }, [materials, productFilter, fixedProductId]);

  async function submit(fd: FormData, isEdit: boolean) {
    setBusy(true);
    setError(null);
    const result = isEdit ? await updateMaterial(fd) : await createMaterial(fd);
    setBusy(false);
    if (result && result.error) {
      setError(result.error);
      return;
    }
    setAddOpen(false);
    setEditing(null);
    router.refresh();
  }

  async function handleDelete(m: AdminMaterial) {
    if (!confirm(`Delete "${m.title}"? Links already sent to clients will stop working.`)) return;
    await deleteMaterial(m.id);
    router.refresh();
  }

  const openHref = (m: AdminMaterial) => (m.fileName ? `/api/materials/${m.id}` : m.linkUrl || "#");

  return (
    <div>
      <div className={`flex flex-wrap items-center justify-between gap-3 ${compact ? "mb-3" : "mb-6"}`}>
        {compact ? (
          <h2 className="font-semibold">Sales materials</h2>
        ) : (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Sales materials</h1>
            <p className="text-black/50 text-sm mt-1">
              Decks, PDFs, demo videos and live-demo links. Sellers only see materials for products
              they have access to; &ldquo;General&rdquo; materials are visible to everyone.
            </p>
          </div>
        )}
        <button
          className={compact ? "btn-secondary" : "btn-primary"}
          onClick={() => {
            setError(null);
            setAddOpen(true);
          }}
        >
          <PlusIcon className="h-4 w-4" />
          Add material
        </button>
      </div>

      {!fixedProductId && (
        <div className="flex flex-wrap gap-2 mb-5">
          {[{ id: "ALL", name: "All" }, { id: "GENERAL", name: "General" }, ...products].map((p) => (
            <button
              key={p.id}
              onClick={() => setProductFilter(p.id)}
              className={productFilter === p.id ? "chip-active" : "chip"}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="card divide-y divide-black/5">
        {filtered.map((m) => (
          <div key={m.id} className="px-5 py-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
              <MaterialIcon type={m.type} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium truncate">{m.title}</span>
                <Badge variant="MUTED">{MATERIAL_TYPE_LABEL[m.type] || m.type}</Badge>
                {m.internalOnly && <Badge variant="WARN">Internal only</Badge>}
              </div>
              <div className="text-xs text-black/40 mt-0.5 truncate">
                {!fixedProductId && <>{m.productName || "General"} · </>}
                {m.fileName ? `${m.fileName} ${formatFileSize(m.fileSize)}` : "Link"}
                {m.fileName && m.linkUrl ? " + link" : ""} · added {formatDate(m.uploadedAt)}
                {m.shareCount > 0 && ` · sent to clients ${m.shareCount}×`}
              </div>
              {m.description && <p className="text-sm text-black/50 mt-1 line-clamp-1">{m.description}</p>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <a href={openHref(m)} target="_blank" rel="noreferrer" className="btn-ghost" title="Open">
                <EyeIcon className="h-4 w-4" />
              </a>
              <button
                className="btn-ghost"
                onClick={() => {
                  setError(null);
                  setEditing(m);
                }}
                title="Edit"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
              <button className="btn-danger" onClick={() => handleDelete(m)} title="Delete">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-5 py-10 text-center text-black/40 text-sm">
            No materials yet. Add a presentation, a one-pager PDF or a demo video link.
          </div>
        )}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add sales material" wide>
        <MaterialForm
          products={products}
          fixedProductId={fixedProductId}
          busy={busy}
          error={error}
          onSubmit={(fd) => submit(fd, false)}
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit material" wide>
        {editing && (
          <MaterialForm
            material={editing}
            products={products}
            fixedProductId={fixedProductId}
            busy={busy}
            error={error}
            onSubmit={(fd) => submit(fd, true)}
          />
        )}
      </Modal>
    </div>
  );
}

function MaterialForm({
  material,
  products,
  fixedProductId,
  busy,
  error,
  onSubmit,
}: {
  material?: AdminMaterial;
  products: ProductOption[];
  fixedProductId?: string;
  busy: boolean;
  error: string | null;
  onSubmit: (fd: FormData) => void;
}) {
  const [type, setType] = useState(material?.type || "PRESENTATION");
  const linkFirst = type === "DEMO_VIDEO" || type === "DEMO_LINK";

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      {error && <div className="error-box">{error}</div>}
      {material && <input type="hidden" name="id" value={material.id} />}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Title</label>
          <input
            name="title"
            required
            defaultValue={material?.title}
            className="input"
            placeholder="e.g. Unbusyness — sales deck 2026"
          />
        </div>
        <div>
          <label className="label">Type</label>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">
            {MATERIAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {MATERIAL_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {fixedProductId ? (
        <input type="hidden" name="productId" value={fixedProductId} />
      ) : (
        <div>
          <label className="label">Product</label>
          <select name="productId" defaultValue={material?.productId || "GENERAL"} className="input">
            <option value="GENERAL">General — visible to all sellers</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="label">Description (optional)</label>
        <textarea
          name="description"
          defaultValue={material?.description || ""}
          className="input min-h-[60px]"
          placeholder="When to use it, which client it suits…"
        />
      </div>

      <div className={`grid gap-4 ${linkFirst ? "" : "grid-cols-1"}`}>
        <div>
          <label className="label">
            Link {linkFirst ? "" : "(optional)"} — YouTube, Loom, Google Slides, live demo…
          </label>
          <input
            name="linkUrl"
            defaultValue={material?.linkUrl || ""}
            className="input"
            placeholder="https://"
          />
        </div>
        <div>
          <label className="label">
            File {linkFirst ? "(optional)" : ""} — PDF, PPTX, video, image
          </label>
          <input
            name="file"
            type="file"
            className="block w-full text-sm text-black/60 rounded-xl border border-black/10 bg-white px-3.5 py-2.5"
          />
          {material?.fileName && (
            <div className="flex items-center justify-between mt-1.5 text-xs text-black/45">
              <span>Current: {material.fileName} — leave empty to keep it.</span>
              <label className="flex items-center gap-1.5">
                <input type="checkbox" name="removeFile" /> remove file
              </label>
            </div>
          )}
        </div>
      </div>

      <label className="flex items-start gap-2.5 text-sm text-black/70">
        <input
          type="checkbox"
          name="internalOnly"
          defaultChecked={material?.internalOnly || type === "SALES_SCRIPT"}
          disabled={type === "SALES_SCRIPT"}
          className="mt-0.5"
        />
        <span>
          Internal only — sellers can read it but can&apos;t send it to clients
          <span className="block text-xs text-black/40">
            Use for scripts, battle cards, internal price floors.
          </span>
        </span>
      </label>

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Saving…" : material ? "Save changes" : "Add material"}
      </button>
    </form>
  );
}
