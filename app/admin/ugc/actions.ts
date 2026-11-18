"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireStaff, type CurrentUser } from "@/lib/session";
import { canManageSeller } from "@/lib/access";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import { deletePrivateFile } from "@/lib/upload";
import { bonusForViews, parseBonusTiers } from "@/lib/ugc";
import { generateWeeklyIdeas, mondayOf } from "@/lib/ugc-ai";
import { formatMoney } from "@/lib/format";

export type ActionResult = { error?: string; success?: string } | void;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function done() {
  revalidatePath("/admin/ugc");
  revalidatePath("/crm/ugc");
}

async function videoFor(user: CurrentUser, id: string) {
  const v = await prisma.ugcVideo.findUnique({ where: { id } });
  if (!v) return null;
  if (user.role === "ADMIN") return v;
  return (await canManageSeller(user, v.creatorId)) ? v : null;
}

export async function reviewVideo(id: string, decision: "APPROVE" | "CHANGES" | "REJECT", note: string): Promise<ActionResult> {
  const user = await requireStaff();
  const v = await videoFor(user, id);
  if (!v) return { error: "Video not found." };
  if (!["SUBMITTED", "CHANGES", "APPROVED"].includes(v.status)) return { error: "This video was already published or closed." };
  if (decision !== "APPROVE" && !note.trim()) return { error: "Write a short comment for the creator." };
  const status = decision === "APPROVE" ? "APPROVED" : decision === "CHANGES" ? "CHANGES" : "REJECTED";
  await prisma.ugcVideo.update({
    where: { id },
    data: { status, reviewNote: note.trim() || null, reviewedById: user.id, reviewedAt: new Date() },
  });
  if (status === "REJECTED") {
    await deletePrivateFile(v.fileKey);
    await prisma.ugcVideo.update({ where: { id }, data: { fileKey: null } });
  }
  await notify([v.creatorId], {
    type: "UGC_REVIEWED",
    title:
      status === "APPROVED"
        ? `✅ "${v.title}" is approved — post it as a Collab`
        : status === "CHANGES"
          ? `✏️ Changes requested on "${v.title}"`
          : `"${v.title}" was not approved`,
    body: note.trim() || null,
    link: "/crm/ugc",
  });
  done();
  return { success: status === "APPROVED" ? "Approved. The creator was notified." : "Sent to the creator." };
}

export async function setViews(id: string, viewsRaw: number): Promise<ActionResult> {
  const user = await requireStaff();
  const v = await videoFor(user, id);
  if (!v || v.status !== "PUBLISHED") return { error: "Only published videos get views." };
  const views = Math.max(0, Math.round(Number(viewsRaw)));
  if (!Number.isFinite(views)) return { error: "Enter the number of views." };
  const settings = await getSettings();
  const bonus = bonusForViews(parseBonusTiers(settings.ugcBonusTiers), views);
  await prisma.ugcVideo.update({ where: { id }, data: { views, viewsAt: new Date(), bonus } });
  if (bonus > v.bonus) {
    await notify([v.creatorId], {
      type: "UGC_BONUS",
      title: `🚀 View bonus: +${formatMoney(bonus)} for "${v.title}"`,
      body: `${views.toLocaleString("sl-SI")} views. It's on this month's statement.`,
      link: "/crm/commission",
    });
  }
  done();
  return { success: bonus ? `Saved — bonus ${formatMoney(bonus)}.` : "Saved — no bonus at this number of views." };
}

export async function saveTask(fd: FormData): Promise<ActionResult> {
  const user = await requireStaff();
  const id = str(fd, "id") || null;
  const title = str(fd, "title");
  if (!title) return { error: "The idea needs a title." };
  const status = ["DRAFT", "PUBLISHED", "CLOSED"].includes(str(fd, "status")) ? str(fd, "status") : "DRAFT";
  const data = {
    title: title.slice(0, 140),
    brief: str(fd, "brief").slice(0, 3000) || null,
    theme: str(fd, "theme").slice(0, 80) || null,
    productId: str(fd, "productId") || null,
    status,
  };
  if (id) await prisma.ugcTask.update({ where: { id }, data });
  else await prisma.ugcTask.create({ data: { ...data, weekOf: mondayOf(), createdById: user.id } });
  done();
  return { success: "Saved." };
}

export async function setTaskStatus(ids: string[], status: "DRAFT" | "PUBLISHED" | "CLOSED"): Promise<ActionResult> {
  await requireStaff();
  if (!ids.length) return { error: "Nothing selected." };
  await prisma.ugcTask.updateMany({ where: { id: { in: ids } }, data: { status } });
  if (status === "PUBLISHED") {
    const creators = await prisma.user.findMany({ where: { ugcCreator: true, active: true }, select: { id: true } });
    await notify(creators.map((c) => c.id), {
      type: "UGC_REVIEWED",
      title: `🎬 ${ids.length} new video idea${ids.length === 1 ? "" : "s"}`,
      body: "Pick one and film it this week.",
      link: "/crm/ugc",
    }, { email: false });
  }
  done();
  return { success: status === "PUBLISHED" ? "Published — creators were notified." : "Updated." };
}

export async function deleteTask(id: string): Promise<ActionResult> {
  await requireStaff();
  await prisma.ugcTask.delete({ where: { id } });
  done();
  return { success: "Deleted." };
}

export async function generateIdeas(): Promise<ActionResult> {
  const user = await requireStaff();
  const r = await generateWeeklyIdeas({ createdById: user.id });
  done();
  if (!r.created) return { error: r.errors[0] || "No ideas were generated." };
  return {
    success: `${r.created} new draft ideas. Edit them and publish the ones you like.${r.errors.length ? ` (${r.errors.length} product(s) failed.)` : ""}`,
  };
}

export async function saveUgcSettings(fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const pay = Number(str(fd, "ugcVideoPay").replace(",", "."));
  const hours = Math.round(Number(str(fd, "warmClaimHours")));
  if (!Number.isFinite(pay) || pay < 0) return { error: "Video pay must be a number." };
  if (!Number.isFinite(hours) || hours < 1 || hours > 720) return { error: "Hours to accept a warm lead: 1–720." };
  const site = str(fd, "websiteUrl").replace(/\/+$/, "");
  if (site && !/^https?:\/\/\S+$/.test(site)) return { error: "The website address must start with https://" };
  await prisma.settings.update({
    where: { id: 1 },
    data: {
      ugcVideoPay: pay,
      ugcBonusTiers: str(fd, "ugcBonusTiers") || null,
      ugcTerms: str(fd, "ugcTerms") || null,
      warmClaimHours: hours,
      websiteUrl: site || "https://unbusyness.com",
    },
  });
  done();
  return { success: "Settings saved." };
}
