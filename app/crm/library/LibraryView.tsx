"use client";

import { useMemo, useState } from "react";
import Badge from "@/components/Badge";
import MaterialIcon from "@/components/MaterialIcon";
import { DownloadIcon, EyeIcon, SearchIcon, SendIcon } from "@/components/icons";
import SendMaterialsModal from "@/app/crm/SendMaterialsModal";
import { MATERIAL_TYPE_LABEL } from "@/lib/constants";
import { formatDate, formatFileSize, materialHref } from "@/lib/format";
import type { SellerMaterial } from "@/lib/seller";

export default function LibraryView({
  materials,
  customers,
}: {
  materials: SellerMaterial[];
  customers: { id: string; name: string; company: string | null; email: string | null }[];
}) {
  const [type, setType] = useState("ALL");
  const [query, setQuery] = useState("");
  const [sendIds, setSendIds] = useState<string[] | null>(null);

  const types = useMemo(() => Array.from(new Set(materials.map((m) => m.type))), [materials]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = materials.filter(
      (m) =>
        (type === "ALL" || m.type === type) &&
        (!q || m.title.toLowerCase().includes(q) || (m.description || "").toLowerCase().includes(q))
    );
    const map = new Map<string, SellerMaterial[]>();
    for (const m of list) {
      const k = m.productName || "General";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return Array.from(map.entries());
  }, [materials, type, query]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Sales library</h1>
        <p className="text-black/50 text-sm mt-1">
          Decks, PDFs, demo videos and links for your products. Send them to clients as tracked links.
        </p>
      </div>

      {materials.length === 0 ? (
        <div className="card p-10 text-center text-black/40 text-sm">
          Nothing here yet — materials appear once your admin uploads them for your products.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="relative w-64 mr-2">
              <SearchIcon className="h-4 w-4 text-black/30 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="input pl-9 py-2"
              />
            </div>
            {["ALL", ...types].map((t) => (
              <button key={t} onClick={() => setType(t)} className={type === t ? "chip-active" : "chip"}>
                {t === "ALL" ? "All" : MATERIAL_TYPE_LABEL[t]}
              </button>
            ))}
          </div>

          <div className="space-y-6">
            {groups.map(([group, items]) => (
              <div key={group} className="card">
                <div className="px-5 py-4 border-b border-black/5">
                  <h2 className="font-semibold text-sm">{group}</h2>
                </div>
                <div className="divide-y divide-black/5">
                  {items.map((m) => (
                    <div key={m.id} className="px-5 py-3.5 flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                        <MaterialIcon type={m.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{m.title}</span>
                          {m.internalOnly && <Badge variant="WARN">Internal</Badge>}
                        </div>
                        <div className="text-xs text-black/40 mt-0.5">
                          {MATERIAL_TYPE_LABEL[m.type]}
                          {m.fileName ? ` · ${formatFileSize(m.fileSize)}` : " · link"} · {formatDate(m.uploadedAt)}
                        </div>
                        {m.description && <p className="text-sm text-black/50 mt-0.5 line-clamp-1">{m.description}</p>}
                      </div>
                      <a href={materialHref(m)} target="_blank" rel="noreferrer" className="btn-ghost" title="Open">
                        <EyeIcon className="h-4 w-4" />
                      </a>
                      {m.fileName && (
                        <a href={`/api/materials/${m.id}?download=1`} className="btn-ghost" title="Download">
                          <DownloadIcon className="h-4 w-4" />
                        </a>
                      )}
                      {!m.internalOnly && (
                        <button className="btn-ghost" title="Send to a client" onClick={() => setSendIds([m.id])}>
                          <SendIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <div className="card p-8 text-center text-sm text-black/40">Nothing matches.</div>
            )}
          </div>
        </>
      )}

      {sendIds && (
        <SendMaterialsModal
          open
          onClose={() => setSendIds(null)}
          materials={materials}
          customers={customers}
          preselected={sendIds}
        />
      )}
    </div>
  );
}
