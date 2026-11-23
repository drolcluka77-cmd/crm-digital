import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { getManagedSellerIds } from "@/lib/access";
import { crmCountsByDay, monthBounds, todayLjubljana } from "@/lib/worklog";
import TimesheetsAdmin from "./TimesheetsAdmin";

export const dynamic = "force-dynamic";

export default async function AdminTimesheetsPage({ searchParams }: { searchParams: { m?: string; u?: string } }) {
  const user = await requireStaff();
  const month = /^\d{4}-\d{2}$/.test(searchParams.m || "") ? searchParams.m! : todayLjubljana().slice(0, 7);
  const { first, next, start, end } = monthBounds(month);
  const sellerIds = await getManagedSellerIds(user);
  const scope = user.role === "ADMIN" ? undefined : { in: sellerIds };
  const entries = await prisma.workLog.findMany({
    where: { day: { gte: first, lt: next }, ...(scope ? { userId: scope } : {}), ...(searchParams.u ? { userId: searchParams.u } : {}) },
    include: { user: { select: { id: true, name: true } }, approvedBy: { select: { name: true } } },
    orderBy: [{ day: "desc" }, { startTime: "desc" }],
  });
  const people = Array.from(new Map(entries.map((e) => [e.user.id, e.user.name])).entries());
  const allSellers = await prisma.user.findMany({
    where: { role: "SALES", active: true, ...(scope ? { id: scope } : {}) },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const counts: Record<string, Record<string, { calls: number; emails: number; meetings: number; leadsClaimed: number }>> = {};
  for (const [id] of people) counts[id] = await crmCountsByDay(id, start, end);

  return (
    <TimesheetsAdmin
      month={month}
      sellerFilter={searchParams.u || ""}
      sellers={allSellers}
      counts={counts}
      entries={entries.map((e) => ({
        id: e.id,
        userId: e.user.id,
        userName: e.user.name,
        day: e.day,
        startTime: e.startTime,
        endTime: e.endTime,
        breakMinutes: e.breakMinutes,
        minutes: e.minutes,
        calls: e.calls,
        conversations: e.conversations,
        meetings: e.meetings,
        emails: e.emails,
        notes: e.notes,
        approved: !!e.approvedAt,
        approvedBy: e.approvedBy?.name ?? null,
        managerNote: e.managerNote,
      }))}
    />
  );
}
