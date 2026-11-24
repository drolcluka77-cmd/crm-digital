import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import MirrorResult, { toRunView } from "@/components/MirrorResult";

export const dynamic = "force-dynamic";

export default async function MirrorRunPage({ params }: { params: { id: string } }) {
  const user = await requireSales();
  const r = await prisma.aiMirrorRun.findUnique({ where: { id: params.id } });
  if (!r) notFound();
  if (r.userId !== user.id) {
    const own = r.customerId ? await prisma.customer.findFirst({ where: { id: r.customerId, ownerId: user.id }, select: { id: true } }) : null;
    if (!own) notFound();
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/crm/mirror" className="text-sm text-black/50 hover:underline">
          ← AI Mirror
        </Link>
        <div className="flex gap-3 text-sm">
          {r.customerId && (
            <Link href={`/crm/customers/${r.customerId}`} className="text-brand-600 underline">
              Stranka
            </Link>
          )}
          <Link href={`/crm/mirror${r.customerId ? `?customer=${r.customerId}` : ""}`} className="text-brand-600 underline">
            Nova analiza
          </Link>
        </div>
      </div>
      <MirrorResult run={toRunView(r)} />
    </div>
  );
}
