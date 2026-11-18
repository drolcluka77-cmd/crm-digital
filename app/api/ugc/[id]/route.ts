import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canManageSeller } from "@/lib/access";
import { readPrivateFile } from "@/lib/upload";

export const dynamic = "force-dynamic";

/** An uploaded UGC video: for its creator, admins and the creator's manager. ?download=1 to download. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const v = await prisma.ugcVideo.findUnique({ where: { id: params.id } });
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const allowed =
    v.creatorId === user.id ||
    user.role === "ADMIN" ||
    (user.role === "MANAGER" && (await canManageSeller(user, v.creatorId)));
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!v.fileKey) {
    if (v.linkUrl) return NextResponse.redirect(v.linkUrl);
    return NextResponse.json({ error: "The file was removed after publishing." }, { status: 404 });
  }
  let bytes: Buffer;
  try {
    bytes = await readPrivateFile(v.fileKey);
  } catch {
    return NextResponse.json({ error: "File missing on server" }, { status: 404 });
  }
  const download = req.nextUrl.searchParams.get("download") === "1";
  const filename = (v.fileName || "video.mp4").replace(/"/g, "");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": v.fileType || "video/mp4",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
