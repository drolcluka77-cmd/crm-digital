import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { DELIVERY_LINE_LABEL, GEO_PACKAGE_LABEL, GEO_STATUS_LABEL, LINE_STATUSES } from "@/lib/geo-labels";
import TaskList, { type TaskRow } from "@/app/izvedba/TaskList";

export const dynamic = "force-dynamic";


export default async function GeoBoardPage({ searchParams }: { searchParams: { view?: string; line?: string } }) {
  const user = await requireStaff();
  const isAdmin = user.role === "ADMIN";
  const view = searchParams.view === "approve" ? "approve" : "board";
  const line = searchParams.line === "UNBUSYNESS" ? "UNBUSYNESS" : "PICKED";
  const COLUMNS = LINE_STATUSES[line].filter((s) => !["DRAFT", "CANCELLED"].includes(s));
  const now = new Date();

  const [clients, lateCounts, approvals, drafts, cancelled] = await Promise.all([
    prisma.geoClient.findMany({
      where: { line, status: { in: COLUMNS } },
      include: { assistant: { select: { name: true } }, seller: { select: { name: true } } },
      orderBy: { statusAt: "asc" },
    }),
    prisma.geoTask.groupBy({
      by: ["clientId"],
      where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"] }, dueDate: { lt: now } },
      _count: { _all: true },
    }),
    prisma.geoTask.findMany({
      where: { status: "WAITING_APPROVAL" },
      include: { client: { select: { company: true } }, assignee: { select: { name: true } } },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.geoClient.count({ where: { line, status: "DRAFT" } }),
    prisma.geoClient.findMany({ where: { line, status: "CANCELLED" }, select: { id: true, company: true, endsAt: true } }),
  ]);
  const late = new Map(lateCounts.map((c) => [c.clientId, c._count._all]));
  const approvalRows: TaskRow[] = approvals.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    phase: t.phase,
    dueDate: t.dueDate?.toISOString() ?? null,
    status: t.status,
    note: t.note,
    needsApproval: t.needsApproval,
    technical: t.technical,
    clientId: t.clientId,
    company: t.client.company,
    assignee: t.assignee?.name ?? null,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Delivery</h1>
          <p className="text-black/50 text-sm mt-1">
            Clients after the seller's handover: Mr. Picked → GEO assistant, Unbusyness pilots → forward deployment engineer. Open a client to assign who works on it (tasks are created then).
            {drafts ? ` ${drafts} handover draft(s) not submitted yet.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["PICKED", "UNBUSYNESS"] as const).map((l) => (
            <Link key={l} href={`/admin/geo?line=${l}`} className={view === "board" && line === l ? "chip-active" : "chip"}>
              {DELIVERY_LINE_LABEL[l]}
            </Link>
          ))}
          <Link href="/admin/geo?view=approve" className={view === "approve" ? "chip-active" : "chip"}>
            Waiting for approval <span className="ml-1.5 opacity-60">{approvals.length}</span>
          </Link>
          <Link href="/izvedba" className="chip">
            All tasks
          </Link>
          {isAdmin && (
            <Link href="/admin/geo/templates" className="chip">
              Task templates
            </Link>
          )}
        </div>
      </div>

      {view === "approve" ? (
        <div className="card">
          <TaskList tasks={approvalRows} isAdmin={isAdmin} empty="Nothing waiting for approval." />
        </div>
      ) : (
        <>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {COLUMNS.map((s) => {
              const list = clients.filter((c) => c.status === s);
              return (
                <div key={s} className="w-60 shrink-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-black/45 mb-2">
                    {GEO_STATUS_LABEL[s]} <span className="font-normal">{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((c) => (
                      <Link key={c.id} href={`/izvedba/stranke/${c.id}`} className="card p-3 block hover:border-brand-300">
                        <div className="font-medium text-sm leading-snug">{c.company}</div>
                        <div className="text-xs text-black/45 mt-1">
                          {line === "PICKED" ? `${GEO_PACKAGE_LABEL[c.package || ""] || "—"} · ` : ""}
                          {c.assistant?.name || <span className="text-amber-600">not assigned</span>}
                        </div>
                        {late.get(c.id) ? <div className="text-xs text-rose-600 mt-1">{late.get(c.id)} overdue</div> : null}
                        {s === "HANDED_OVER" && <div className="text-xs text-brand-600 mt-1">Assign →</div>}
                      </Link>
                    ))}
                    {list.length === 0 && <div className="text-xs text-black/30 px-1">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
          {cancelled.length > 0 && (
            <div className="mt-6 text-sm text-black/50">
              Cancelled:{" "}
              {cancelled.map((c, i) => (
                <span key={c.id}>
                  {i ? ", " : ""}
                  <Link href={`/izvedba/stranke/${c.id}`} className="underline">
                    {c.company}
                  </Link>
                  {c.endsAt ? ` (until ${c.endsAt.toLocaleDateString("sl-SI")})` : ""}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
