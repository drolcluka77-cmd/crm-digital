import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { proformaPdfFor } from "@/lib/contract-signing";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const c = await prisma.contract.findUnique({ where: { publicToken: params.token }, select: { id: true, status: true } });
  if (!c || c.status !== "SIGNED") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const r = await proformaPdfFor(c.id);
  if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(r.bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.contract.proformaNumber}.pdf"` },
  });
}
