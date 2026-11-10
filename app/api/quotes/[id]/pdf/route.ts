import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getManagedSellerIds } from "@/lib/access";
import { renderQuotePdf } from "@/lib/quote-pdf";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: { items: true, customer: true, user: true },
  });
  if (!quote) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Sellers: own quotes only. Managers: their team's. Admins: everything.
  let allowed = quote.userId === user.id || user.role === "ADMIN";
  if (!allowed && user.role === "MANAGER") {
    allowed = (await getManagedSellerIds(user)).includes(quote.userId);
  }
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const pdfBytes = await renderQuotePdf(quote);
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.number}.pdf"`,
    },
  });
}
