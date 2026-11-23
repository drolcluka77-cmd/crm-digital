import Link from "next/link";
import { GEO_STATUS_LABEL, GEO_STATUS_NEXT } from "@/lib/geo-labels";

/** Seller's view of the GEO delivery for this customer: hand over, then read-only progress. */
export default function GeoPanel({
  customerId,
  geo,
}: {
  customerId: string;
  geo: { id: string; status: string; assistant: string | null; tasksDone: number; tasksTotal: number } | null;
}) {
  return (
    <div className="card p-5">
      <div className="section-title mb-2">Izvedba · Mr. Picked</div>
      {!geo ? (
        <>
          <p className="text-sm text-black/55 mb-3">
            Ko stranka podpiše, jo predaj GEO asistentu. Izpolniti moraš vsa obvezna polja.
          </p>
          <Link href={`/crm/customers/${customerId}/predaja`} className="btn-primary w-full justify-center">
            Predaj v izvedbo
          </Link>
        </>
      ) : geo.status === "DRAFT" ? (
        <>
          <p className="text-sm text-black/55 mb-3">Predaja je shranjena kot osnutek in še ni oddana.</p>
          <Link href={`/crm/customers/${customerId}/predaja`} className="btn-primary w-full justify-center">
            Dokončaj predajo
          </Link>
        </>
      ) : (
        <dl className="text-sm space-y-1.5">
          <div className="flex justify-between gap-3">
            <dt className="text-black/45">Status</dt>
            <dd className="font-medium">{GEO_STATUS_LABEL[geo.status] || geo.status}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-black/45">GEO asistent</dt>
            <dd>{geo.assistant || "še ni dodeljen"}</dd>
          </div>
          {geo.tasksTotal > 0 && (
            <div className="flex justify-between gap-3">
              <dt className="text-black/45">Naloge</dt>
              <dd>
                {geo.tasksDone} / {geo.tasksTotal} končanih
              </dd>
            </div>
          )}
          {GEO_STATUS_NEXT[geo.status] && <p className="text-xs text-black/45 pt-1">Naprej, ko: {GEO_STATUS_NEXT[geo.status]}</p>}
          <p className="text-xs text-black/40 pt-1">Po predaji podatkov ne urejaš več; zapiske dodaj na časovnico.</p>
        </dl>
      )}
    </div>
  );
}
