import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Tracked Calendly link sent to candidates (/prijava/termin/<token>).
 * Records the first click and forwards to Calendly with name and e-mail
 * pre-filled, so the booking webhook can match the candidate.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const [settings, c] = await Promise.all([getSettings(), prisma.candidate.findUnique({ where: { token: params.token } })]);
  const target = settings.recruitingCalendlyUrl;
  if (!c || !target) {
    return new NextResponse(
      "<!doctype html><meta charset=utf-8><title>Termin</title><body style=\"font-family:sans-serif;padding:48px;color:#334\"><h2>Ta povezava ni več aktivna</h2><p>Odgovorite na naše sporočilo in dogovorili se bomo za termin.</p></body>",
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
  if (!c.clickedAt) await prisma.candidate.update({ where: { id: c.id }, data: { clickedAt: new Date() } });
  const url = new URL(target);
  url.searchParams.set("name", c.name);
  url.searchParams.set("email", c.email);
  return NextResponse.redirect(url.toString(), 302);
}
