import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Tracked booking link (/b/<token>) put in emails via {{bookingLink}}.
 * Logs the click (once a day) and forwards the client to their seller's
 * booking page, with name & email pre-filled where the tool supports it.
 */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const customer = await prisma.customer.findUnique({
    where: { bookingToken: params.token },
    include: { owner: { select: { id: true, bookingUrl: true } } },
  });
  const target = customer?.owner?.bookingUrl;
  if (!customer || !target) {
    return new NextResponse(
      "<!doctype html><meta charset=utf-8><title>Booking</title><body style=\"font-family:sans-serif;padding:48px;color:#334\"><h2>This booking link isn't active</h2><p>Please reply to the email and we'll find a time together.</p></body>",
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const dayAgo = new Date(Date.now() - 86_400_000);
  const recent = await prisma.activity.count({
    where: { customerId: customer.id, type: "BOOKING_OPENED", createdAt: { gte: dayAgo } },
  });
  if (!recent) {
    await logActivity(customer.id, null, "BOOKING_OPENED", "Opened the booking page");
    await notify([customer.owner!.id], {
      type: "BOOKING_OPENED",
      title: `${customer.company || customer.name} opened your booking link`,
      body: "They may be booking a demo right now.",
      link: `/crm/customers/${customer.id}`,
    }, { email: false });
  }

  // Calendly and Cal.com both accept name/email query params for pre-filling.
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return NextResponse.redirect(target);
  }
  if (customer.email && !url.searchParams.has("email")) url.searchParams.set("email", customer.email);
  if (!url.searchParams.has("name")) url.searchParams.set("name", customer.name);
  return NextResponse.redirect(url.toString());
}
