import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readPrivateFile } from "@/lib/upload";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Public, tracked link sent to a client (no login). Every open is counted,
 * and the first open is written to the customer's timeline so the seller
 * knows it's a good moment to call.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const share = await prisma.materialShare.findUnique({
    where: { token: params.token },
    include: { material: true },
  });

  if (!share || (share.expiresAt && share.expiresAt < new Date())) {
    return new NextResponse(
      "<!doctype html><meta charset=utf-8><title>Link expired</title><body style=\"font-family:sans-serif;padding:48px;color:#334\"><h2>This link has expired</h2><p>Please ask your contact to send it again.</p></body>",
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const now = new Date();
  await prisma.materialShare.update({
    where: { id: share.id },
    data: { views: { increment: 1 }, lastViewedAt: now, firstViewedAt: share.firstViewedAt ?? now },
  });
  if (!share.firstViewedAt) {
    await logActivity(share.customerId, null, "MATERIAL_VIEWED", `Opened “${share.material.title}”`);
    const customer = await prisma.customer.findUnique({
      where: { id: share.customerId },
      select: { name: true, company: true },
    });
    await notify([share.userId], {
      type: "MATERIAL_VIEWED",
      title: `${customer?.company || customer?.name || "A client"} opened “${share.material.title}”`,
      body: "Good moment to follow up while it's fresh.",
      link: `/crm/customers/${share.customerId}`,
    });
  }

  const m = share.material;
  if (m.storagePath) {
    try {
      const bytes = await readPrivateFile(m.storagePath);
      return new NextResponse(bytes, {
        headers: {
          "Content-Type": m.fileType || "application/octet-stream",
          "Content-Disposition": `inline; filename="${(m.fileName || "file").replace(/"/g, "")}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      return NextResponse.json({ error: "File missing" }, { status: 404 });
    }
  }
  if (m.linkUrl) return NextResponse.redirect(m.linkUrl);
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
