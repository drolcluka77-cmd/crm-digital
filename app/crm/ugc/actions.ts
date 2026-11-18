"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { getAccessibleProductIds } from "@/lib/access";
import { notify, supervisorsOf } from "@/lib/notify";
import { savePrivateFile, deletePrivateFile } from "@/lib/upload";
import { generateUgcCode } from "@/lib/ugc";
import { normalizeUrl } from "@/lib/format";

export type ActionResult = { error?: string; success?: string } | void;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const MAX_VIDEO_BYTES = 48 * 1024 * 1024;

function done() {
  revalidatePath("/crm/ugc");
  revalidatePath("/admin/ugc");
}

export async function joinUgc(): Promise<ActionResult> {
  const user = await requireSales();
  const me = await prisma.user.findUnique({ where: { id: user.id } });
  const code = me?.ugcCode || (await generateUgcCode(user.name));
  await prisma.user.update({
    where: { id: user.id },
    data: { ugcCreator: true, ugcTermsAt: new Date(), ugcCode: code },
  });
  done();
  return { success: `Welcome to the UGC programme! Your code is ${code}.` };
}

export async function leaveUgc(): Promise<ActionResult> {
  const user = await requireSales();
  await prisma.user.update({ where: { id: user.id }, data: { ugcCreator: false } });
  done();
  return { success: "You left the UGC programme. Your link and code no longer work." };
}

/** New video, or a new version of one that needs changes (videoId). */
export async function submitVideo(fd: FormData): Promise<ActionResult> {
  const user = await requireSales();
  const me = await prisma.user.findUnique({ where: { id: user.id } });
  if (!me?.ugcCreator) return { error: "Join the UGC programme first." };

  const videoId = str(fd, "videoId") || null;
  const existing = videoId ? await prisma.ugcVideo.findUnique({ where: { id: videoId } }) : null;
  if (videoId && (!existing || existing.creatorId !== user.id || !["SUBMITTED", "CHANGES"].includes(existing.status))) {
    return { error: "This video can't be changed any more." };
  }

  const title = str(fd, "title") || existing?.title || "";
  if (!title) return { error: "Give the video a short title." };
  const taskId = str(fd, "taskId") || existing?.taskId || null;
  const task = taskId ? await prisma.ugcTask.findUnique({ where: { id: taskId } }) : null;
  let productId = str(fd, "productId") || task?.productId || existing?.productId || null;
  if (productId && !(await getAccessibleProductIds(user)).includes(productId)) productId = null;

  const link = normalizeUrl(str(fd, "linkUrl"));
  const file = fd.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (!hasFile && !link && !existing) return { error: "Upload the video or paste a link (Google Drive, Dropbox, WeTransfer …)." };
  if (hasFile) {
    if (file.size > MAX_VIDEO_BYTES) return { error: "The file is larger than 48 MB — paste a Google Drive / Dropbox / WeTransfer link instead." };
    if (file.type && !file.type.startsWith("video/")) return { error: "Please upload a video file (mp4, mov …)." };
  }

  let fileData: { fileKey: string; fileName: string; fileType: string; fileSize: number } | null = null;
  if (hasFile) {
    const saved = await savePrivateFile(file, "ugc");
    fileData = { fileKey: saved.storagePath, fileName: saved.fileName, fileType: saved.fileType, fileSize: saved.fileSize };
  }

  const data = {
    title: title.slice(0, 140),
    note: str(fd, "note").slice(0, 2000) || null,
    taskId: task ? task.id : null,
    productId,
    status: "SUBMITTED",
    ...(fileData ? { ...fileData, linkUrl: link } : link ? { linkUrl: link } : {}),
  };

  if (existing) {
    if (fileData && existing.fileKey) await deletePrivateFile(existing.fileKey);
    if (link && !fileData && existing.fileKey) {
      await deletePrivateFile(existing.fileKey);
      Object.assign(data, { fileKey: null, fileName: null, fileType: null, fileSize: null });
    }
    await prisma.ugcVideo.update({ where: { id: existing.id }, data });
  } else {
    await prisma.ugcVideo.create({ data: { ...data, creatorId: user.id } });
  }

  await notify(await supervisorsOf(user.id), {
    type: "UGC_SUBMITTED",
    title: `🎬 ${user.name} ${existing ? "sent a new version of" : "submitted"} a UGC video`,
    body: title,
    link: "/admin/ugc",
  });
  done();
  return { success: "Sent for review. You'll be notified when it's approved." };
}

/** After an approved video is posted as a Collab: paste the post link. */
export async function markPublished(id: string, postUrlRaw: string): Promise<ActionResult> {
  const user = await requireSales();
  const v = await prisma.ugcVideo.findUnique({ where: { id } });
  if (!v || v.creatorId !== user.id) return { error: "Video not found." };
  if (v.status !== "APPROVED") return { error: "Only approved videos can be marked as published." };
  const postUrl = normalizeUrl(postUrlRaw);
  if (!postUrl || !/instagram\.com|tiktok\.com/i.test(postUrl)) {
    return { error: "Paste the link of the Instagram or TikTok post." };
  }
  const settings = await getSettings();
  await prisma.ugcVideo.update({
    where: { id },
    data: { status: "PUBLISHED", postUrl, publishedAt: new Date(), basePay: settings.ugcVideoPay },
  });
  await notify(await supervisorsOf(user.id), {
    type: "UGC_SUBMITTED",
    title: `📣 ${user.name} published "${v.title}"`,
    body: "Accept the Collab invitation on the Unbusyness profile if you haven't yet.",
    link: "/admin/ugc?tab=published",
  }, { email: false });
  done();
  return { success: "Marked as published. The video pay is on this month's statement." };
}

export async function deleteVideo(id: string): Promise<ActionResult> {
  const user = await requireSales();
  const v = await prisma.ugcVideo.findUnique({ where: { id } });
  if (!v || v.creatorId !== user.id) return { error: "Video not found." };
  if (!["SUBMITTED", "CHANGES", "REJECTED"].includes(v.status)) return { error: "Approved or published videos can't be deleted." };
  await deletePrivateFile(v.fileKey);
  await prisma.ugcVideo.delete({ where: { id } });
  done();
  return { success: "Deleted." };
}
