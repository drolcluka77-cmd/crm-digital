import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireGeoArea } from "@/lib/session";
import MirrorResult, { toRunView } from "@/components/MirrorResult";
import SaveAsMeasurement from "./SaveAsMeasurement";

export const dynamic = "force-dynamic";

export default async function DeliveryMirrorPage({ params }: { params: { id: string } }) {
  const user = await requireGeoArea();
  const r = await prisma.aiMirrorRun.findUnique({ where: { id: params.id } });
  if (!r || !r.geoClientId) notFound();
  const g = await prisma.geoClient.findUnique({ where: { id: r.geoClientId }, include: { measurements: { select: { month: true } } } });
  if (!g) notFound();
  if (!["ADMIN", "MANAGER"].includes(user.role) && g.assistantId !== user.id) notFound();
  const nextMonth = g.measurements.length ? Math.max(...g.measurements.map((m) => m.month)) + 1 : 0;
  return (
    <div className="space-y-4">
      <Link href={`/izvedba/stranke/${g.id}?tab=meritve`} className="text-sm text-black/50 hover:underline">
        ← {g.company} · Meritve
      </Link>
      {r.status === "DONE" && <SaveAsMeasurement runId={r.id} nextMonth={nextMonth} saved={!!r.measurementId} />}
      <MirrorResult run={toRunView(r)} />
    </div>
  );
}
