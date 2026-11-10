import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderQuotePdf } from "@/lib/quote-pdf";

export const dynamic = "force-dynamic";

/** PDF of a quote for the client, via its public link. */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const quote = await prisma.quote.findUnique({
    where: { publicToken: params.token },
    include: { items: true, customer: true, user: true },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const bytes = await renderQuotePdf(quote);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
