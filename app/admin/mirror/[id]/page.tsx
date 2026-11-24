import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import MirrorResult, { toRunView } from "@/components/MirrorResult";

export const dynamic = "force-dynamic";

export default async function AdminMirrorRunPage({ params }: { params: { id: string } }) {
  await requireStaff();
  const r = await prisma.aiMirrorRun.findUnique({ where: { id: params.id } });
  if (!r) notFound();
  return (
    <div className="space-y-4">
      <Link href="/admin/mirror" className="text-sm text-black/50 hover:underline">
        ← AI Mirror
      </Link>
      <MirrorResult run={toRunView(r)} />
    </div>
  );
}
