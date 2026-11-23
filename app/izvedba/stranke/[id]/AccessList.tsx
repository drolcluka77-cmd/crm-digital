"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addAccess, saveAccess } from "@/lib/geo-actions";
import { GEO_ACCESS_STATUSES, GEO_ACCESS_STATUS_LABEL, GEO_PLATFORMS, GEO_PLATFORM_LABEL } from "@/lib/geo-labels";

type A = { id: string; platform: string; status: string; method: string | null; note: string | null; updatedAt: string };

function Row({ a }: { a: A }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form
      className="grid sm:grid-cols-[200px_150px_1fr_1fr_auto] gap-2 items-center px-4 py-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await saveAccess(a.id, new FormData(e.currentTarget));
        setBusy(false);
        setMsg(r?.error || "Shranjeno");
        router.refresh();
      }}
    >
      <div className="text-sm font-medium">{GEO_PLATFORM_LABEL[a.platform] || a.platform}</div>
      <select name="status" defaultValue={a.status} className="input py-1.5">
        {GEO_ACCESS_STATUSES.map((s) => (
          <option key={s} value={s}>
            {GEO_ACCESS_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <input name="method" defaultValue={a.method || ""} className="input py-1.5" placeholder="npr. upravitelj na info@mrpicked.eu" />
      <input name="note" defaultValue={a.note || ""} className="input py-1.5" placeholder="opomba" />
      <div className="flex items-center gap-2">
        <button className="btn-secondary py-1.5" disabled={busy}>
          Shrani
        </button>
        {msg && <span className="text-xs text-black/45">{msg}</span>}
      </div>
    </form>
  );
}

export default function AccessList({ clientId, rows }: { clientId: string; rows: A[] }) {
  const router = useRouter();
  const [platform, setPlatform] = useState("OTHER");
  return (
    <div className="space-y-4">
      <p className="text-sm text-black/55">
        Gesel ne hranimo in jih ne sprejemamo. Stranka nas povsod doda kot upravitelja (info@mrpicked.eu). Ko je dostop do Google
        profila odobren, stranka preide v Izhodišče.
      </p>
      <div className="card divide-y divide-black/5">
        {rows.map((a) => (
          <Row key={a.id} a={a} />
        ))}
        {rows.length === 0 && <div className="px-4 py-6 text-center text-sm text-black/40">Vrstice se ustvarijo, ko administrator dodeli asistenta.</div>}
      </div>
      <div className="flex items-center gap-2">
        <select className="input py-1.5 w-auto" value={platform} onChange={(e) => setPlatform(e.target.value)}>
          {GEO_PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {GEO_PLATFORM_LABEL[p]}
            </option>
          ))}
        </select>
        <button
          className="btn-secondary py-1.5"
          onClick={async () => {
            await addAccess(clientId, platform);
            router.refresh();
          }}
        >
          + Dodaj platformo
        </button>
      </div>
    </div>
  );
}
