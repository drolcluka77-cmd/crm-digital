import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { computeQuoteBreakdown } from "@/lib/format";
import TeamManager from "./TeamManager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const actor = await requireStaff();
  const isAdmin = actor.role === "ADMIN";

  const users = await prisma.user.findMany({
    where: isAdmin ? {} : { role: "SALES", managerId: actor.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      manager: { select: { id: true, name: true } },
      productAccess: { include: { product: { select: { id: true, name: true, active: true } } } },
      quotes: { where: { status: "ACCEPTED" }, include: { items: true } },
      _count: { select: { customers: true, quotes: true, team: true } },
    },
  });

  const products = await prisma.product.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, family: true, active: true },
  });

  const data = users.map((u) => {
    const won = u.quotes.reduce(
      (acc, q) => {
        const b = computeQuoteBreakdown(q.items, q.discount, q.vatRate);
        return { value: acc.value + b.annualNet, commission: acc.commission + b.commission };
      },
      { value: 0, commission: 0 }
    );
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      active: u.active,
      isMe: u.id === actor.id,
      commissionRate: u.commissionRate,
      managerId: u.manager?.id ?? null,
      managerName: u.manager?.name ?? null,
      customerCount: u._count.customers,
      quoteCount: u._count.quotes,
      teamSize: u._count.team,
      wonValue: won.value,
      commission: won.commission,
      products: u.productAccess.map((a) => ({ id: a.product.id, name: a.product.name, active: a.product.active })),
    };
  });

  return (
    <TeamManager
      users={data}
      products={products}
      canManageRoles={isAdmin}
      managers={data.filter((u) => u.role === "MANAGER" && u.active).map((u) => ({ id: u.id, name: u.name }))}
    />
  );
}
