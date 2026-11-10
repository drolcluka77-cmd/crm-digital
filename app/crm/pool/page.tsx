import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import PoolBrowser from "./PoolBrowser";

export const dynamic = "force-dynamic";

export default async function SellerPoolPage() {
  const user = await requireSales();
  const pools = await prisma.leadPool.findMany({
    where: {
      claimable: true,
      OR: [{ managerId: null }, ...(user.managerId ? [{ managerId: user.managerId }] : [])],
    },
    include: {
      leads: {
        where: { ownerId: null },
        select: { id: true, name: true, company: true, segment: true, city: true, size: true },
        orderBy: { createdAt: "asc" },
        take: 300,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PoolBrowser
      pools={pools.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        claimLimit: p.claimLimit,
        leads: p.leads,
      }))}
    />
  );
}
