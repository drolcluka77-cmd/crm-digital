import Link from "next/link";
import { DELIVERY_LINE_LABEL, DELIVERY_LINE_ROLE, DELIVERY_ROLE_LABEL, GEO_STATUS_LABEL, statusNext } from "@/lib/geo-labels";

/** Seller's view of the GEO delivery for this customer: hand over, then read-only progress. */
export default function GeoPanel({
  customerId,
  line,
  geo,
}: {
  customerId: string;
  line: string;
  geo: { id: string; status: string; assistant: string | null; tasksDone: number; tasksTotal: number } | null;
}) {
  return (
    <div className="card p-5">
      <div className="section-title mb-2">Izvedba · {DELIVERY_LINE_LABEL[line] || line}</div>
      {!geo ? (
        <>
          <p className="text-sm text-black/55 mb-3">
            {line === "UNBUSYNESS"
              ? "Ko se stranka strinja s pilotom, ga predaj forward deployment engineerju. Izpolniti moraš vsa obvezna polja."
              : line === "IMPORT"
                ? "Ko stranka podpiše pogodbo o proviziji in plača 149 € za iskanje, jo predaj koordinatorju uvoza."
                : "Ko stranka podpiše, jo predaj GEO asistentu. Izpolniti moraš vsa obvezna polja."}
          </p>
          <Link href={`/crm/customers/${customerId}/predaja?line=${line}`} className="btn-primary w-full justify-center">
            Predaj v izvedbo
          </Link>
        </>
      ) : geo.status === "DRAFT" ? (
        <>
          <p className="text-sm text-black/55 mb-3">Predaja je shranjena kot osnutek in še ni oddana.</p>
          <Link href={`/crm/customers/${customerId}/predaja?line=${line}`} className="btn-primary w-full justify-center">
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
            <dt className="text-black/45">{DELIVERY_ROLE_LABEL[DELIVERY_LINE_ROLE[line]] || "GEO asistent"}</dt>
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
          {statusNext(line, geo.status) && <p className="text-xs text-black/45 pt-1">Naprej, ko: {statusNext(line, geo.status)}</p>}
          <p className="text-xs text-black/40 pt-1">Po predaji podatkov ne urejaš več; zapiske dodaj na časovnico.</p>
        </dl>
      )}
    </div>
  );
}
