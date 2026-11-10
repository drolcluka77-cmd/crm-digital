"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { PlusIcon, PencilIcon } from "@/components/icons";
import { savePool } from "./actions";

export default function PoolForm({
  isAdmin,
  managers,
  pool,
}: {
  isAdmin: boolean;
  managers: { id: string; name: string }[];
  pool?: {
    id: string;
    name: string;
    description: string | null;
    claimable: boolean;
    claimLimit: number | null;
    managerId: string | null;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(fd: FormData) {
    setBusy(true);
    setError(null);
    const result = await savePool(fd); // new pools redirect
    setBusy(false);
    if (result && result.error) return setError(result.error);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {pool ? (
        <button className="btn-ghost" onClick={() => setOpen(true)}>
          <PencilIcon className="h-4 w-4" /> Edit pool
        </button>
      ) : (
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <PlusIcon className="h-4 w-4" /> New pool
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={pool ? "Edit pool" : "New lead pool"}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          {error && <div className="error-box">{error}</div>}
          {pool && <input type="hidden" name="id" value={pool.id} />}
          <div>
            <label className="label">Name</label>
            <input name="name" required defaultValue={pool?.name} className="input" placeholder="Property managers — Ljubljana" />
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea name="description" defaultValue={pool?.description || ""} className="input min-h-[60px]" />
          </div>
          {isAdmin && (
            <div>
              <label className="label">For</label>
              <select name="scope" defaultValue={pool?.managerId || "COMPANY"} className="input">
                <option value="COMPANY">Company-wide (all sellers)</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}&apos;s team
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="flex items-start gap-2.5 text-sm">
            <input type="checkbox" name="claimable" defaultChecked={pool?.claimable} className="mt-0.5" />
            <span>
              Sellers can claim leads themselves
              <span className="block text-xs text-black/40">Otherwise only you hand them out.</span>
            </span>
          </label>
          <div>
            <label className="label">Max open claimed leads per seller (optional)</label>
            <input name="claimLimit" type="number" min={1} defaultValue={pool?.claimLimit ?? ""} className="input" placeholder="e.g. 20" />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? "Saving…" : pool ? "Save" : "Create pool"}
          </button>
        </form>
      </Modal>
    </>
  );
}
