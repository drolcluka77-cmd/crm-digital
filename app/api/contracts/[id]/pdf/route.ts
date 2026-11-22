import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canSeeContract } from "@/lib/contracts";
import { contractPdfFor } from "@/lib/contract-signing";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const c = await prisma.contract.findUnique({ where: { id: params.id }, select: { id: true, userId: true } });
  if (!c || !(await canSeeContract(user, c))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await contractPdfFor(c.id);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(r.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.contract.number}.pdf"` },
  });
}
