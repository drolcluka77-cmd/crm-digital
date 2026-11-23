import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getManagedSellerIds } from "@/lib/access";
import { monthBounds, todayLjubljana } from "@/lib/worklog";

export const dynamic = "force-dynamic";

const cell = (v: string | number) => {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Timesheet export for payroll (e.g. Študentski servis): one row per logged day. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const m = req.nextUrl.searchParams.get("m") || "";
  const month = /^\d{4}-\d{2}$/.test(m) ? m : todayLjubljana().slice(0, 7);
  const u = req.nextUrl.searchParams.get("u") || "";
  const { first, next } = monthBounds(month);
  const ids = user.role === "ADMIN" ? null : await getManagedSellerIds(user);
  const rows = await prisma.workLog.findMany({
    where: { day: { gte: first, lt: next }, ...(ids ? { userId: { in: ids } } : {}), ...(u ? { userId: u } : {}) },
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ userId: "asc" }, { day: "asc" }, { startTime: "asc" }],
  });
  const head = ["Prodajalec", "E-pošta", "Datum", "Od", "Do", "Odmor (min)", "Ure", "Klici", "Dosežen odločevalec", "Sestanki", "E-maili", "Opis dela", "Odobreno"];
  const lines = [head.join(";")];
  for (const r of rows) {
    lines.push(
      [
        r.user.name,
        r.user.email,
        r.day,
        r.startTime,
        r.endTime,
        r.breakMinutes,
        (r.minutes / 60).toFixed(2).replace(".", ","),
        r.calls,
        r.conversations,
        r.meetings,
        r.emails,
        r.notes.replace(/\s+/g, " "),
        r.approvedAt ? "da" : "ne",
      ]
        .map(cell)
        .join(";")
    );
  }
  // Excel (SL locale) opens ;-separated UTF-8 with BOM correctly.
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ure-${month}${u ? "-" + u.slice(0, 6) : ""}.csv"`,
    },
  });
}
