import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { renderMirrorPdf } from "@/lib/mirror-pdf";

export const dynamic = "force-dynamic";

/** AI Mirror report for the client. The person downloading it is shown as the contact. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const r = await prisma.aiMirrorRun.findUnique({ where: { id: params.id } });
  if (!r || r.status !== "DONE") return NextResponse.json({ error: "Not found" }, { status: 404 });

  let allowed = user.role === "ADMIN" || user.role === "MANAGER" || r.userId === user.id;
  if (!allowed && r.customerId) allowed = !!(await prisma.customer.findFirst({ where: { id: r.customerId, ownerId: user.id }, select: { id: true } }));
  if (!allowed && r.geoClientId) allowed = !!(await prisma.geoClient.findFirst({ where: { id: r.geoClientId, assistantId: user.id }, select: { id: true } }));
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [settings, me] = await Promise.all([getSettings(), prisma.user.findUnique({ where: { id: user.id }, select: { name: true, email: true, phone: true } })]);
  const bytes = await renderMirrorPdf({
    company: r.company,
    city: r.city,
    category: r.category,
    kind: r.kind,
    createdAt: r.createdAt,
    score: r.score,
    mentions: r.mentions,
    answersCount: r.answersCount,
    answers: Array.isArray(r.answers) ? (r.answers as any) : [],
    summary: (r.summary as any) || {},
    seller: me,
    brand: "Mr. Picked",
    companyName: settings.companyName,
  });
  const name = `AI-vidnost-${r.company.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}.pdf`;
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${encodeURIComponent(name)}"` },
  });
}
