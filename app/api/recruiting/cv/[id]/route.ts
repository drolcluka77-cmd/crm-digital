import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { readPrivateFile } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** A candidate's CV — admins and managers only. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }
  const c = await prisma.candidate.findUnique({ where: { id: params.id }, select: { cvKey: true, cvName: true } });
  if (!c?.cvKey) return NextResponse.json({ error: "No CV" }, { status: 404 });
  const bytes = await readPrivateFile(c.cvKey);
  const name = c.cvName || "cv";
  const ext = name.split(".").pop()?.toLowerCase() || "";
  const type =
    ext === "pdf" ? "application/pdf"
    : ext === "png" ? "image/png"
    : ext === "jpg" || ext === "jpeg" ? "image/jpeg"
    : ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : ext === "doc" ? "application/msword"
    : "application/octet-stream";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename="${name.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
