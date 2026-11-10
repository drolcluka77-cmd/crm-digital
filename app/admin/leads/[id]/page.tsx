import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { getManagedSellerIds } from "@/lib/access";
import PoolForm from "../PoolForm";
import PoolLeads from "./PoolLeads";

export const dynamic = "force-dynamic";

export default async function PoolPage({ params }: { params: { id: string } }) {
  const user = await requireStaff();
  const pool = await prisma.leadPool.findUnique({ where: { id: params.id } });
  if (!pool || (user.role !== "ADMIN" && pool.managerId !== user.id)) notFound();

  const sellerIds = await getManagedSellerIds(user);
  const [leads, sellers, managers, handedOut] = await Promise.all([
    prisma.customer.findMany({
      where: { poolId: pool.id, ownerId: null },
      orderBy: { createdAt: "asc" },
      take: 1000,
    }),
    prisma.user.findMany({
      where: { id: { in: sellerIds }, active: true, ...(pool.managerId ? { managerId: pool.managerId } : {}) },
      select: { id: true, name: true, _count: { select: { customers: true } } },
      orderBy: { name: "asc" },
    }),
    user.role === "ADMIN"
      ? prisma.user.findMany({ where: { role: "MANAGER", active: true }, select: { id: true, name: true } })
      : Promise.resolve([]),
    prisma.customer.groupBy({
      by: ["ownerId"],
      where: { poolId: pool.id, ownerId: { not: null } },
      _count: { _all: true },
    }),
  ]);
  const sellerName = new Map(sellers.map((s) => [s.id, s.name]));

  return (
    <div>
      <Link href="/admin/leads" className="text-sm text-black/40 hover:text-black/60">
        ← Lead pools
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mt-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{pool.name}</h1>
          <p className="text-black/50 text-sm mt-1">
            {pool.description ? `${pool.description} · ` : ""}
            {pool.claimable
              ? `Sellers can claim${pool.claimLimit ? ` (max ${pool.claimLimit} open each)` : ""}`
              : "Only managers hand out leads"}
          </p>
          {handedOut.length > 0 && (
            <p className="text-xs text-black/40 mt-1">
              Handed out:{" "}
              {handedOut.map((h) => `${sellerName.get(h.ownerId!) || "other"} ${h._count._all}`).join(" · ")}
            </p>
          )}
        </div>
        <PoolForm
          isAdmin={user.role === "ADMIN"}
          managers={managers}
          pool={{
            id: pool.id,
            name: pool.name,
            description: pool.description,
            claimable: pool.claimable,
            claimLimit: pool.claimLimit,
            managerId: pool.managerId,
          }}
        />
      </div>

      <PoolLeads
        poolId={pool.id}
        sellers={sellers.map((s) => ({ id: s.id, name: s.name, leads: s._count.customers }))}
        leads={leads.map((l) => ({
          id: l.id,
          name: l.name,
          company: l.company,
          segment: l.segment,
          city: l.city,
          email: l.email,
          phone: l.phone,
        }))}
      />
    </div>
  );
}
