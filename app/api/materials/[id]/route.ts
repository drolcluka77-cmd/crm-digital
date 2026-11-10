import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canAccessMaterial } from "@/lib/access";
import { readPrivateFile } from "@/lib/upload";

export const dynamic = "force-dynamic";

/**
 * Downloads a sales material for a signed-in user, enforcing product
 * access: a seller can only open materials of products assigned to them.
 * Add ?download=1 to force a download instead of opening in the browser.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const material = await prisma.salesMaterial.findUnique({ where: { id: params.id } });
  if (!material || !(await canAccessMaterial(user, material))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!material.storagePath) {
    if (material.linkUrl) return NextResponse.redirect(material.linkUrl);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readPrivateFile(material.storagePath);
  } catch {
    return NextResponse.json({ error: "File missing on server" }, { status: 404 });
  }

  const download = req.nextUrl.searchParams.get("download") === "1";
  const filename = (material.fileName || "file").replace(/"/g, "");
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": material.fileType || "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
