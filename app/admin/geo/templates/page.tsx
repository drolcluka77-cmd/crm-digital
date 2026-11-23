import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { ensureGeoTemplates } from "@/lib/geo";
import TemplatesEditor from "./TemplatesEditor";

export const dynamic = "force-dynamic";

export default async function GeoTemplatesPage() {
  await requireAdmin();
  await ensureGeoTemplates();
  const rows = await prisma.geoTaskTemplate.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  return (
    <div>
      <Link href="/admin/geo" className="text-sm text-black/40 hover:text-black/60">
        ← GEO delivery
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight mt-3">Task templates</h1>
      <p className="text-black/50 text-sm mt-1 mb-6">
        When a client is assigned to an assistant, the CRM creates tasks from these templates for the client's package and add-ons.
        One-off tasks: due = start date + days. Monthly/quarterly: due day of the month (0 = last day). Changes apply to new clients
        and to recurring tasks from the next month.
      </p>
      <TemplatesEditor
        rows={rows.map((r) => ({
          id: r.id,
          key: r.key,
          packages: (r.packages as string[]) || [],
          title: r.title,
          description: r.description,
          phase: r.phase,
          dueDay: r.dueDay,
          needsApproval: r.needsApproval,
          technical: r.technical,
          active: r.active,
          sortOrder: r.sortOrder,
        }))}
      />
    </div>
  );
}
