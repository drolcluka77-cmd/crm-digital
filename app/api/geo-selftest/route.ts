// TEMPORARY admin-only end-to-end test helper for delivery (Unbusyness pilot). Remove after testing.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { saveHandover } from "@/lib/geo-actions";

export const dynamic = "force-dynamic";
const NAME = "TEST — Unbusyness pilot selftest";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "admin only" }, { status: 403 });
  const step = req.nextUrl.searchParams.get("step");
  if (step === "create") {
    const customer = await prisma.customer.create({
      data: { name: "Testna Gostiteljica", company: NAME, email: "test@example.com", phone: "040 000 001", status: "DEMO_DONE", ownerId: user.id },
    });
    const r1 = await saveHandover(customer.id, new FormData(), true, "UNBUSYNESS");
    const fd = new FormData();
    for (const [k, v] of Object.entries({
      company: NAME, startDate: new Date().toISOString().slice(0, 10), contactName: "Testna Gostiteljica", contactPhone: "040 000 001",
      contactEmail: "test@example.com", propertyType: "APARTMENTS", units: "6", locations: "Ljubljana (4), Bled (2)", pms: "Smoobu",
      whoAnswers: "lastnica sama", pilotGoal: "80 % vprašanj brez lastnice", pilotDays: "30", priceAfterPilot: "120",
      mainProblem: "Odgovarja gostom ponoči", promised: "nič posebnega",
    })) fd.set(k, v);
    for (const v of ["AIRBNB", "BOOKING"]) fd.append("bookingChannels", v);
    for (const v of ["PLATFORM", "WHATSAPP"]) fd.append("guestChannels", v);
    fd.append("languages", "SL"); fd.append("languages", "EN");
    const r2 = await saveHandover(customer.id, fd, true, "UNBUSYNESS");
    const c = await prisma.geoClient.findFirst({ where: { customerId: customer.id } });
    return NextResponse.json({ clientId: c?.id, line: c?.line, status: c?.status, details: c?.details, r1, r2 });
  }
  if (step === "status") {
    const c = await prisma.geoClient.findFirst({ where: { company: NAME }, include: { tasks: { orderBy: { dueDate: "asc" } }, accesses: true, logs: { orderBy: { createdAt: "asc" } } } });
    if (!c) return NextResponse.json({ none: true });
    return NextResponse.json({
      id: c.id, status: c.status, details: c.details, accesses: c.accesses.map((a) => a.platform),
      tasks: c.tasks.map((t) => `${t.phase}|${t.dueDate?.toISOString().slice(0, 10)}|${t.status}|${t.title.slice(0, 50)}`),
      logs: c.logs.map((l) => `${l.action}: ${l.detail}`),
    });
  }
  if (step === "finishphase") {
    const phase = req.nextUrl.searchParams.get("phase") || "";
    const c = await prisma.geoClient.findFirst({ where: { company: NAME } });
    if (!c) return NextResponse.json({ none: true });
    const n = await prisma.geoTask.updateMany({ where: { clientId: c.id, phase }, data: { status: "DONE", doneAt: new Date() } });
    const { advanceGeoClient } = await import("@/lib/geo");
    const s = await advanceGeoClient(c.id, user);
    return NextResponse.json({ closed: n.count, status: s });
  }
  if (step === "cleanup") {
    const cs = await prisma.customer.findMany({ where: { company: NAME }, select: { id: true } });
    await prisma.customer.deleteMany({ where: { id: { in: cs.map((c) => c.id) } } });
    const n = await prisma.notification.deleteMany({ where: { OR: [{ title: { contains: NAME } }, { body: { contains: NAME } }] } });
    return NextResponse.json({ deletedCustomers: cs.length, deletedNotifications: n.count });
  }
  return NextResponse.json({ steps: ["create", "status", "finishphase", "cleanup"] });
}
