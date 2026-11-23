// TEMPORARY admin-only end-to-end test helper for GEO delivery. Remove after testing.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { saveHandover } from "@/lib/geo-actions";
import { geoDailyJob } from "@/lib/geo";

export const dynamic = "force-dynamic";
const NAME = "TEST — GEO selftest d.o.o.";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ error: "admin only" }, { status: 403 });
  const step = req.nextUrl.searchParams.get("step");

  if (step === "create") {
    const customer = await prisma.customer.create({
      data: { name: "Testna Oseba", company: NAME, email: "test@example.com", phone: "040 000 000", status: "WON", ownerId: user.id, note: "Testna stranka za preizkus GEO izvedbe — izbriši." },
    });
    const partial = new FormData();
    partial.set("company", NAME);
    const r1 = await saveHandover(customer.id, partial, true);
    const fd = new FormData();
    for (const [k, v] of Object.entries({
      company: NAME, industry: "TOWING", package: "RECOMMENDED", monthlyPrice: "690", setupFee: "", startDate: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
      contactName: "Testna Oseba", contactPhone: "040 000 000", contactEmail: "test@example.com", webManager: "sami",
      customerValue: "150", mainProblem: "Premalo klicev ponoči", promised: "nič posebnega", specialNotes: "TEST",
    })) fd.set(k, v);
    fd.append("languages", "SL");
    fd.append("languages", "EN");
    fd.append("addons", "VIDEOS");
    const r2 = await saveHandover(customer.id, fd, true);
    const c = await prisma.geoClient.findUnique({ where: { customerId: customer.id } });
    return NextResponse.json({ customerId: customer.id, clientId: c?.id, status: c?.status, incompleteSubmit: r1, fullSubmit: r2 });
  }
  if (step === "daily") {
    return NextResponse.json(await geoDailyJob(new Date()));
  }
  if (step === "status") {
    const c = await prisma.geoClient.findFirst({ where: { company: NAME }, include: { tasks: true, accesses: true, measurements: true, logs: true } });
    if (!c) return NextResponse.json({ none: true });
    const by = (k: string) => c.tasks.reduce((m: Record<string, number>, t: any) => ((m[t[k]] = (m[t[k]] || 0) + 1), m), {});
    return NextResponse.json({
      status: c.status, tasks: c.tasks.length, byPhase: by("phase"), byStatus: by("status"),
      accesses: c.accesses.map((a) => `${a.platform}:${a.status}`), measurements: c.measurements.length,
      logs: c.logs.map((l) => `${l.action}: ${l.detail}`).slice(-30),
      titles: c.tasks.map((t) => `${t.phase}|${t.period || ""}|${t.dueDate?.toISOString().slice(0, 10)}|${t.status}|${t.title}`),
    });
  }
  if (step === "cleanup") {
    const cs = await prisma.customer.findMany({ where: { company: NAME }, select: { id: true } });
    await prisma.customer.deleteMany({ where: { id: { in: cs.map((c) => c.id) } } });
    const n = await prisma.notification.deleteMany({ where: { OR: [{ title: { contains: NAME } }, { body: { contains: NAME } }] } });
    return NextResponse.json({ deletedCustomers: cs.length, deletedNotifications: n.count });
  }
  return NextResponse.json({ steps: ["create", "status", "daily", "cleanup"] });
}
