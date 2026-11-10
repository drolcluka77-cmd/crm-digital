import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { ChevronRightIcon, UsersIcon } from "@/components/icons";
import Badge from "@/components/Badge";
import PoolForm from "./PoolForm";

export const dynamic = "force-dynamic";

export default async function LeadPoolsPage() {
  const user = await requireStaff();
  const isAdmin = user.role === "ADMIN";
  const [pools, managers] = await Promise.all([
    prisma.leadPool.findMany({
      where: isAdmin ? {} : { managerId: user.id },
      orderBy: { createdAt: "desc" },
      include: { manager: { select: { name: true } } },
    }),
    isAdmin
      ? prisma.user.findMany({ where: { role: "MANAGER", active: true }, select: { id: true, name: true } })
      : Promise.resolve([]),
  ]);
  const counts = await prisma.customer.groupBy({
    by: ["poolId"],
    where: { poolId: { in: pools.map((p) => p.id) }, ownerId: null },
    _count: { _all: true },
  });
  const assigned = await prisma.customer.groupBy({
    by: ["poolId"],
    where: { poolId: { in: pools.map((p) => p.id) }, ownerId: { not: null } },
    _count: { _all: true },
  });
  const open = new Map(counts.map((c) => [c.poolId, c._count._all]));
  const done = new Map(assigned.map((c) => [c.poolId, c._count._all]));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lead pools</h1>
          <p className="text-black/50 text-sm mt-1">
            Import lead lists (e.g. property managers in one region), then hand them out to sellers — or let sellers
            claim them themselves.
          </p>
        </div>
        <PoolForm isAdmin={isAdmin} managers={managers} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pools.map((p) => (
          <Link key={p.id} href={`/admin/leads/${p.id}`} className="card p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-black/45 mt-0.5">
                  {p.managerId ? `${p.manager?.name}'s team` : "Company-wide"}
                </div>
              </div>
              {p.claimable && <Badge variant="INFO">Sellers can claim</Badge>}
            </div>
            {p.description && <p className="text-sm text-black/55 mt-2 line-clamp-2">{p.description}</p>}
            <div className="mt-4 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <UsersIcon className="h-4 w-4 text-black/35" /> <strong>{open.get(p.id) || 0}</strong> unassigned
              </span>
              <span className="text-black/45">{done.get(p.id) || 0} handed out</span>
              <ChevronRightIcon className="h-4 w-4 ml-auto text-black/30" />
            </div>
          </Link>
        ))}
        {pools.length === 0 && (
          <div className="card p-10 text-center text-sm text-black/40 md:col-span-2">
            No pools yet. Create one, then import a CSV of leads into it.
          </div>
        )}
      </div>
    </div>
  );
}
