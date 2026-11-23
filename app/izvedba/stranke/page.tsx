import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireGeoArea } from "@/lib/session";
import { GEO_PACKAGE_LABEL, GEO_STATUS_LABEL } from "@/lib/geo-labels";

export const dynamic = "force-dynamic";

export default async function GeoClientsPage() {
  const user = await requireGeoArea();
  const mine = user.role === "GEO";
  const clients = await prisma.geoClient.findMany({
    where: mine ? { assistantId: user.id } : { status: { not: "DRAFT" } },
    include: { assistant: { select: { name: true } } },
    orderBy: [{ status: "asc" }, { company: "asc" }],
  });
  const now = new Date();
  const counts = await prisma.geoTask.groupBy({
    by: ["clientId"],
    where: { clientId: { in: clients.map((c) => c.id) }, status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"] }, dueDate: { lt: now } },
    _count: { _all: true },
  });
  const late = new Map(counts.map((c) => [c.clientId, c._count._all]));
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-6">{mine ? "Moje stranke" : "Stranke v izvedbi"}</h1>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-black/40 border-b border-black/5">
              <th className="px-4 py-2 font-medium">Podjetje</th>
              <th className="px-3 py-2 font-medium">Paket</th>
              <th className="px-3 py-2 font-medium">Status</th>
              {!mine && <th className="px-3 py-2 font-medium">Asistent</th>}
              <th className="px-3 py-2 font-medium">Zamujene</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0 hover:bg-sand-50">
                <td className="px-4 py-3">
                  <Link href={`/izvedba/stranke/${c.id}`} className="font-medium hover:underline">
                    {c.company}
                  </Link>
                </td>
                <td className="px-3 py-3">{GEO_PACKAGE_LABEL[c.package || ""] || "—"}</td>
                <td className="px-3 py-3">{GEO_STATUS_LABEL[c.status]}</td>
                {!mine && <td className="px-3 py-3">{c.assistant?.name || <span className="text-amber-600">ni dodeljen</span>}</td>}
                <td className="px-3 py-3">{late.get(c.id) ? <span className="text-rose-600 font-medium">{late.get(c.id)}</span> : "—"}</td>
              </tr>
            ))}
            {clients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-black/40">
                  {mine ? "Še nimaš dodeljenih strank." : "Še ni strank v izvedbi."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
