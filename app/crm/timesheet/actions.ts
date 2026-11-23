"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSales, requireStaff } from "@/lib/session";
import { getManagedSellerIds } from "@/lib/access";
import { notify, supervisorsOf } from "@/lib/notify";
import { minutesBetween, todayLjubljana, validDay, validTime, fmtHours } from "@/lib/worklog";

export type WorkLogResult = { error?: string; success?: string } | void;

const int = (fd: FormData, k: string) => Math.max(0, Math.min(1000, Math.round(Number(fd.get(k)) || 0)));

function revalidate() {
  revalidatePath("/crm/timesheet");
  revalidatePath("/admin/timesheets");
}

/** Seller: add or edit a day's entry (until it is approved; at most 14 days back). */
export async function saveWorkLog(fd: FormData): Promise<WorkLogResult> {
  const user = await requireSales();
  const id = String(fd.get("id") || "");
  const day = String(fd.get("day") || "");
  const startTime = String(fd.get("startTime") || "");
  const endTime = String(fd.get("endTime") || "");
  const breakMinutes = int(fd, "breakMinutes");
  const notes = String(fd.get("notes") || "").trim().slice(0, 3000);

  if (!validDay(day)) return { error: "Pick a date." };
  const today = todayLjubljana();
  if (day > today) return { error: "You can't log a day in the future." };
  const age = (Date.parse(today) - Date.parse(day)) / 86_400_000;
  if (age > 14) return { error: "Only the last 14 days can be logged here — ask your manager to add older days." };
  if (!validTime(startTime) || !validTime(endTime)) return { error: "Enter the start and end time (e.g. 09:00 and 13:30)." };
  const minutes = minutesBetween(startTime, endTime, breakMinutes);
  if (minutes <= 0) return { error: "The end time has to be after the start time (minus the break)." };
  if (minutes > 12 * 60) return { error: "That's more than 12 hours — check the times." };
  if (notes.length < 10) return { error: "Write a few words about what you did." };

  const data = {
    day,
    startTime,
    endTime,
    breakMinutes,
    minutes,
    calls: int(fd, "calls"),
    conversations: int(fd, "conversations"),
    meetings: int(fd, "meetings"),
    emails: int(fd, "emails"),
    notes,
  };

  if (id) {
    const existing = await prisma.workLog.findUnique({ where: { id } });
    if (!existing || existing.userId !== user.id) return { error: "Entry not found." };
    if (existing.approvedAt) return { error: "This day is already approved — ask your manager to change it." };
    await prisma.workLog.update({ where: { id }, data });
  } else {
    await prisma.workLog.create({ data: { ...data, userId: user.id } });
    await notify(await supervisorsOf(user.id), {
      type: "WORKLOG",
      title: `${user.name} logged ${fmtHours(minutes)} on ${day}`,
      body: `${data.calls} calls · ${data.meetings} meetings booked`,
      link: "/admin/timesheets",
    });
  }
  revalidate();
  return { success: "Saved." };
}

export async function deleteWorkLog(id: string): Promise<WorkLogResult> {
  const user = await requireSales();
  const e = await prisma.workLog.findUnique({ where: { id } });
  if (!e || e.userId !== user.id) return { error: "Entry not found." };
  if (e.approvedAt) return { error: "This day is already approved." };
  await prisma.workLog.delete({ where: { id } });
  revalidate();
  return { success: "Deleted." };
}

async function staffEntry(id: string) {
  const user = await requireStaff();
  const e = await prisma.workLog.findUnique({ where: { id } });
  if (!e) return { user, e: null };
  if (user.role !== "ADMIN" && !(await getManagedSellerIds(user)).includes(e.userId)) return { user, e: null };
  return { user, e };
}

/** Manager/admin: approve (or un-approve) a day, optionally with a note. */
export async function approveWorkLog(id: string, approve: boolean, note: string): Promise<WorkLogResult> {
  const { user, e } = await staffEntry(id);
  if (!e) return { error: "Entry not found." };
  await prisma.workLog.update({
    where: { id },
    data: approve
      ? { approvedById: user.id, approvedAt: new Date(), managerNote: note.trim().slice(0, 1000) || e.managerNote }
      : { approvedById: null, approvedAt: null, managerNote: note.trim().slice(0, 1000) || e.managerNote },
  });
  if (note.trim()) {
    await notify([e.userId], {
      type: "WORKLOG",
      title: `Note on your timesheet for ${e.day}`,
      body: note.trim().slice(0, 300),
      link: "/crm/timesheet",
    });
  }
  revalidate();
  return { success: approve ? "Approved." : "Approval removed." };
}

export async function approveWorkLogs(ids: string[]): Promise<WorkLogResult> {
  let n = 0;
  for (const id of ids.slice(0, 200)) {
    const r = await approveWorkLog(id, true, "");
    if (!r?.error) n++;
  }
  return { success: `${n} day${n === 1 ? "" : "s"} approved.` };
}

/** Manager/admin: correct hours (e.g. a day older than 14 days, or a mistake). */
export async function staffEditWorkLog(id: string, fd: FormData): Promise<WorkLogResult> {
  const { e } = await staffEntry(id);
  if (!e) return { error: "Entry not found." };
  const startTime = String(fd.get("startTime") || e.startTime);
  const endTime = String(fd.get("endTime") || e.endTime);
  const breakMinutes = int(fd, "breakMinutes");
  if (!validTime(startTime) || !validTime(endTime)) return { error: "Check the times." };
  const minutes = minutesBetween(startTime, endTime, breakMinutes);
  await prisma.workLog.update({ where: { id }, data: { startTime, endTime, breakMinutes, minutes } });
  revalidate();
  return { success: "Updated." };
}
