"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { sendMaterials } from "@/app/crm/customers/actions";
import { MATERIAL_TYPE_LABEL } from "@/lib/constants";
import { formatFileSize } from "@/lib/format";
import type { SellerMaterial } from "@/lib/seller";

type CustomerOption = { id: string; name: string; company: string | null; email: string | null };

/**
 * Email decks / PDFs / demo links to a client. Every item goes out as a
 * tracked link, so the seller sees when the client opens it.
 */
export default function SendMaterialsModal({
  open,
  onClose,
  materials,
  customers,
  fixedCustomer,
  preselected = [],
}: {
  open: boolean;
  onClose: () => void;
  materials: SellerMaterial[];
  /** Pick-a-customer mode (from a product page). */
  customers?: CustomerOption[];
  /** Fixed-customer mode (from a customer page). */
  fixedCustomer?: CustomerOption;
  preselected?: string[];
}) {
  const router = useRouter();
  const sendable = materials.filter((m) => !m.internalOnly);
  const [customerId, setCustomerId] = useState(fixedCustomer?.id || "");
  const [selected, setSelected] = useState<Set<string>>(new Set(preselected));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const customer = fixedCustomer || customers?.find((c) => c.id === customerId);
  const firstName = customer?.name.split(" ")[0] || "";

  const grouped = useMemo(() => {
    const map = new Map<string, SellerMaterial[]>();
    for (const m of sendable) {
      const k = m.productName || "General";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return Array.from(map.entries());
  }, [sendable]);

  function close() {
    setError(null);
    setDone(null);
    onClose();
  }

  async function handleSend(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = await sendMaterials(fd);
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setDone((result && result.success) || "Sent.");
    router.refresh();
  }

  return (
    <Modal open={open} onClose={close} title="Send materials to a client" wide>
      {done ? (
        <div className="text-center py-6">
          <div className="text-emerald-600 font-medium mb-1">{done}</div>
          <p className="text-sm text-black/50">
            You&apos;ll see on the customer&apos;s timeline when they open it.
          </p>
          <button className="btn-secondary mt-4" onClick={close}>
            Close
          </button>
        </div>
      ) : (
        <form
          // Re-mount when the customer changes so the default texts update.
          key={customer?.id || "none"}
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(new FormData(e.currentTarget));
          }}
        >
          {error && <div className="error-box">{error}</div>}

          {fixedCustomer ? (
            <input type="hidden" name="customerId" value={fixedCustomer.id} />
          ) : (
            <div>
              <label className="label">Customer</label>
              <select
                name="customerId"
                className="input"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
              >
                <option value="">Choose a customer…</option>
                {(customers || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company ? `${c.company} — ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label">What to send</label>
            {sendable.length === 0 ? (
              <div className="text-sm text-black/40">No client-ready materials available yet.</div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {grouped.map(([group, list]) => (
                  <div key={group}>
                    <div className="text-xs font-medium text-black/45 mb-1">{group}</div>
                    <div className="space-y-1.5">
                      {list.map((m) => (
                        <label
                          key={m.id}
                          className="flex items-center gap-3 rounded-xl border border-black/10 px-3 py-2 text-sm cursor-pointer has-[:checked]:border-brand-300 has-[:checked]:bg-brand-50/60"
                        >
                          <input
                            type="checkbox"
                            name="materialIds"
                            value={m.id}
                            checked={selected.has(m.id)}
                            onChange={() =>
                              setSelected((prev) => {
                                const n = new Set(prev);
                                if (n.has(m.id)) n.delete(m.id);
                                else n.add(m.id);
                                return n;
                              })
                            }
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium truncate">{m.title}</span>
                            <span className="block text-xs text-black/40">
                              {MATERIAL_TYPE_LABEL[m.type]}
                              {m.fileName ? ` · ${formatFileSize(m.fileSize)}` : " · link"}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">To</label>
              <input
                name="to"
                type="email"
                required
                defaultValue={customer?.email || ""}
                className="input"
                placeholder="client@company.com"
              />
            </div>
            <div>
              <label className="label">Subject</label>
              <input
                name="subject"
                required
                className="input"
                defaultValue={`Information you asked for${customer?.company ? ` — ${customer.company}` : ""}`}
              />
            </div>
          </div>
          <div>
            <label className="label">Message</label>
            <textarea
              name="message"
              required
              className="input min-h-[120px]"
              defaultValue={`Hi${firstName ? ` ${firstName}` : ""},\n\nThanks for your time. As promised, here are the materials — the links below open them directly. Happy to walk you through a live demo whenever suits you.\n\nBest regards,`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-black/60">
            <input type="checkbox" name="attachFiles" />
            Also attach the files (up to 10 MB in total; larger files are sent as links)
          </label>
          <button type="submit" className="btn-primary w-full" disabled={busy || selected.size === 0}>
            {busy ? "Sending…" : `Send ${selected.size || ""} item${selected.size === 1 ? "" : "s"}`}
          </button>
        </form>
      )}
    </Modal>
  );
}
