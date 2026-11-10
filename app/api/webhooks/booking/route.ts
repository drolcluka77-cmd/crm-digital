import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Booking webhook for Calendly, Cal.com, Zapier/Make etc.
 *   POST /api/webhooks/booking?secret=BOOKING_WEBHOOK_SECRET
 * When a lead books a meeting, the lead with that email moves to
 * "Demo scheduled", the demo time is saved and the seller is notified.
 * Accepts the common payload shapes, or a simple {"email","start_time"}.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.BOOKING_WEBHOOK_SECRET;
  if (!secret || req.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  // Calendly: event "invitee.canceled" — ignore cancellations quietly.
  const event = String(body?.event || body?.triggerEvent || "").toLowerCase();
  if (event.includes("cancel")) return NextResponse.json({ ok: true, ignored: "cancellation" });

  const p = body?.payload ?? body;
  const email: string | undefined = (
    p?.email ||
    p?.invitee?.email ||
    p?.attendees?.[0]?.email ||
    p?.responses?.email?.value ||
    body?.email ||
    ""
  )
    .toString()
    .trim()
    .toLowerCase();
  const startRaw =
    p?.scheduled_event?.start_time || p?.event?.start_time || p?.startTime || p?.start_time || body?.start_time || body?.startTime;
  const start = startRaw ? new Date(startRaw) : null;

  if (!email) return NextResponse.json({ error: "No email in payload" }, { status: 400 });
  const customer = await prisma.customer.findFirst({ where: { email }, include: { owner: { select: { id: true } } } });
  if (!customer || !customer.owner) return NextResponse.json({ ok: true, matched: false });

  const when = start && !Number.isNaN(start.getTime()) ? start : null;
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      ...(when ? { demoAt: when, nextFollowUpAt: when } : {}),
      status: ["NEW", "CONTACTED"].includes(customer.status) ? "DEMO_SCHEDULED" : customer.status,
    },
  });
  const label = when ? when.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "a time";
  await logActivity(customer.id, null, "DEMO_BOOKED", `Client booked a demo for ${label}`);
  await notify([customer.owner.id], {
    type: "DEMO_BOOKED",
    title: `📅 ${customer.company || customer.name} booked a demo`,
    body: `For ${label}.`,
    link: `/crm/customers/${customer.id}`,
  });
  return NextResponse.json({ ok: true, matched: true });
}
