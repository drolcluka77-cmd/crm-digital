import { prisma } from "@/lib/prisma";

/**
 * Timesheet helpers. Days are "YYYY-MM-DD" in Ljubljana time; the CRM's own
 * activity log (calls, e-mails, booked meetings) is counted per day so what a
 * seller reports can be checked against what they logged.
 */

const TZ = "Europe/Ljubljana";

export function todayLjubljana(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** UTC instants of the start and end of a Ljubljana calendar day (handles DST). */
export function dayBounds(day: string): { start: Date; end: Date } {
  const [y, m, d] = day.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  const offset = (dt: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, hour: "2-digit", minute: "2-digit", day: "2-digit" }).formatToParts(dt);
    const h = Number(parts.find((p) => p.type === "hour")?.value) % 24;
    const dd = Number(parts.find((p) => p.type === "day")?.value);
    // Ljubljana is UTC+1 or +2, so at 00:00 UTC it is 01:00 or 02:00 the same day.
    return dd === d ? h : h - 24;
  };
  const start = new Date(guess.getTime() - offset(guess) * 3_600_000);
  const nextGuess = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
  const end = new Date(nextGuess.getTime() - offset(nextGuess) * 3_600_000);
  return { start, end };
}

export function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { first, next, start: dayBounds(first).start, end: dayBounds(next).start };
}

export function minutesBetween(start: string, end: string, breakMinutes: number) {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let diff = toMin(end) - toMin(start);
  if (diff < 0) diff += 24 * 60; // past midnight
  return Math.max(0, diff - Math.max(0, breakMinutes));
}

export const fmtHours = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
};

export type CrmCounts = { calls: number; emails: number; meetings: number; leadsClaimed: number };

/** What the CRM logged for a seller, per day, between two instants. */
export async function crmCountsByDay(userId: string, start: Date, end: Date): Promise<Record<string, CrmCounts>> {
  const [acts, booked, claimed] = await Promise.all([
    prisma.activity.findMany({
      where: { userId, createdAt: { gte: start, lt: end }, type: { in: ["CALL", "EMAIL", "DEMO_BOOKED"] } },
      select: { type: true, createdAt: true },
    }),
    // Meetings the client booked themselves through the seller's link.
    prisma.activity.findMany({
      where: { userId: null, type: "DEMO_BOOKED", createdAt: { gte: start, lt: end }, customer: { ownerId: userId } },
      select: { createdAt: true },
    }),
    prisma.prospect.findMany({ where: { claimedById: userId, claimedAt: { gte: start, lt: end } }, select: { claimedAt: true } }),
  ]);
  const out: Record<string, CrmCounts> = {};
  const bump = (d: Date, k: keyof CrmCounts) => {
    const day = todayLjubljana(d);
    out[day] ||= { calls: 0, emails: 0, meetings: 0, leadsClaimed: 0 };
    out[day][k]++;
  };
  for (const a of acts) bump(a.createdAt, a.type === "CALL" ? "calls" : a.type === "EMAIL" ? "emails" : "meetings");
  for (const b of booked) bump(b.createdAt, "meetings");
  for (const c of claimed) if (c.claimedAt) bump(c.claimedAt, "leadsClaimed");
  return out;
}

export function validTime(t: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
}

export function validDay(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));
}
