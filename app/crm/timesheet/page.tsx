import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { crmCountsByDay, monthBounds, todayLjubljana } from "@/lib/worklog";
import TimesheetClient from "./TimesheetClient";

export const dynamic = "force-dynamic";

export default async function TimesheetPage({ searchParams }: { searchParams: { m?: string } }) {
  const user = await requireSales();
  const today = todayLjubljana();
  const month = /^\d{4}-\d{2}$/.test(searchParams.m || "") ? searchParams.m! : today.slice(0, 7);
  const { first, next, start, end } = monthBounds(month);
  const [entries, counts] = await Promise.all([
    prisma.workLog.findMany({
      where: { userId: user.id, day: { gte: first, lt: next } },
      orderBy: [{ day: "desc" }, { startTime: "desc" }],
      include: { approvedBy: { select: { name: true } } },
    }),
    crmCountsByDay(user.id, start, end),
  ]);
  // Today's CRM counts, even when looking at another month.
  const todayCounts = month === today.slice(0, 7) ? counts[today] : (await crmCountsByDay(user.id, monthBounds(today.slice(0, 7)).start, new Date()))[today];

  return (
    <TimesheetClient
      today={today}
      month={month}
      counts={{ ...counts, ...(todayCounts ? { [today]: todayCounts } : {}) }}
      entries={entries.map((e) => ({
        id: e.id,
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
