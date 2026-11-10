import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { OPEN_LEAD_STATUSES } from "@/lib/constants";
import QuickLog from "./QuickLog";

export const dynamic = "force-dynamic";

/** Phone-first page for logging a call or meeting right after it happens. */
export default async function QuickLogPage({ searchParams }: { searchParams: { c?: string } }) {
  const user = await requireSales();
  const customers = await prisma.customer.findMany({
    where: { ownerId: user.id },
    orderBy: [{ updatedAt: "desc" }],
    select: { id: true, name: true, company: true, phone: true, status: true, nextFollowUpAt: true },
    take: 500,
  });
  const open = new Set<string>(OPEN_LEAD_STATUSES);
  return (
    <QuickLog
      initialCustomerId={searchParams.c}
      customers={customers
        .sort((a, b) => Number(open.has(b.status)) - Number(open.has(a.status)))
        .map((c) => ({ id: c.id, name: c.name, company: c.company, phone: c.phone, status: c.status }))}
    />
  );
}
