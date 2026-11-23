"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { savePrivateFile, deletePrivateFile } from "@/lib/upload";
import { getSettings } from "@/lib/settings";
import { newCandidateToken, notifyNewCandidate, sendInvite } from "@/lib/recruiting";
import { positionKey } from "@/lib/recruiting-labels";

export type ApplyResult = { error?: string; ok?: boolean; invited?: boolean };

const MAX_CV = 5 * 1024 * 1024;
const CV_TYPES = /\.(pdf|docx?|odt|rtf|jpe?g|png)$/i;

const str = (fd: FormData, k: string, max = 500) => String(fd.get(k) ?? "").trim().slice(0, max) || null;

export async function apply(fd: FormData): Promise<ApplyResult> {
  // Honeypot: real people never fill the hidden "website" field.
  if (String(fd.get("website") || "").trim()) return { ok: true };

  const name = str(fd, "name", 120);
  const email = (str(fd, "email", 160) || "").toLowerCase();
  const phone = str(fd, "phone", 40);
  if (!name || !email || !phone) return { error: "Prosimo, izpolnite ime, e-pošto in telefon." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "E-poštni naslov ni pravilen." };
  if (fd.get("consent") !== "on") return { error: "Za prijavo potrebujemo vaše soglasje za obdelavo podatkov." };

  const cv = fd.get("cv");
  let file: File | null = null;
  if (cv && typeof cv === "object" && "size" in cv && (cv as File).size > 0) {
    file = cv as File;
    if (file.size > MAX_CV) return { error: "Življenjepis je prevelik (največ 5 MB)." };
    if (!CV_TYPES.test(file.name)) return { error: "Življenjepis naj bo PDF, Word ali slika." };
  }

  const ip = headers().get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const data = {
    name,
    phone,
    city: str(fd, "city", 80),
    status: str(fd, "status", 40),
    hoursPerWeek: str(fd, "hours", 40),
    availableFrom: str(fd, "from", 60),
    workMode: str(fd, "workMode", 40),
    languages: str(fd, "languages", 200),
    experience: str(fd, "experience", 1500),
    motivation: str(fd, "motivation", 1500),
    source: str(fd, "source", 60),
    position: positionKey(str(fd, "position", 40)),
    consentAt: new Date(),
    consentIp: ip,
  };

  const existing = await prisma.candidate.findUnique({ where: { email } });
  let cvData: { cvKey: string; cvName: string } | {} = {};
  if (file) {
    const saved = await savePrivateFile(file, "cv");
    cvData = { cvKey: saved.storagePath, cvName: saved.fileName };
    if (existing?.cvKey) await deletePrivateFile(existing.cvKey);
  }

  // Applying again updates the same candidate (one e-mail = one candidate). Applying for a different
  // position counts as a new application: it starts over and gets that position's invitation.
  const newPosition = !!existing && existing.position !== data.position;
  const restart = newPosition
    ? { stage: "NEW", invitedAt: null, reminderAt: null, clickedAt: null, bookedAt: null, closedAt: null }
    : {};
  const c = existing
    ? await prisma.candidate.update({ where: { id: existing.id }, data: { ...data, ...cvData, ...restart } })
    : await prisma.candidate.create({ data: { ...data, ...cvData, email, token: newCandidateToken() } });

  if (!existing || newPosition) await notifyNewCandidate(c);

  const settings = await getSettings();
  let invited = false;
  if (settings.recruitingAutoInvite && settings.recruitingCalendlyUrl && (!existing || newPosition || !existing.invitedAt)) {
    try {
      await sendInvite(c.id);
      invited = true;
    } catch {
      // The application is saved; staff can resend the invitation from Recruiting.
    }
  }
  return { ok: true, invited };
}
