"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { sendTestEmail } from "@/lib/mailer";
import { saveUploadedFile } from "@/lib/upload";

export type ActionResult = { error?: string; success?: string } | void;

export async function updateSettings(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const companyName = String(formData.get("companyName") || "").trim();
  const companyAddress = String(formData.get("companyAddress") || "").trim() || null;
  const companyEmail = String(formData.get("companyEmail") || "").trim() || null;
  const companyPhone = String(formData.get("companyPhone") || "").trim() || null;
  const vatRate = Number(formData.get("vatRate") || 22);
  const quoteValidityDays = Math.max(1, Math.round(Number(formData.get("quoteValidityDays") || 30)) || 30);
  const maxRaw = String(formData.get("defaultMaxDiscount") ?? "").trim();
  const defaultMaxDiscount = maxRaw === "" ? null : Math.min(100, Math.max(0, Number(maxRaw) || 0));
  const commissionTiers = String(formData.get("commissionTiers") ?? "").trim() || null;
  const renewalTermMonths = Math.max(1, Math.round(Number(formData.get("renewalTermMonths") || 12)) || 12);
  const logo = formData.get("logo") as File | null;

  const smtpHost = String(formData.get("smtpHost") || "").trim() || null;
  const smtpPortRaw = String(formData.get("smtpPort") || "").trim();
  const smtpPort = smtpPortRaw ? Number(smtpPortRaw) : null;
  const smtpUser = String(formData.get("smtpUser") || "").trim() || null;
  const smtpPassRaw = String(formData.get("smtpPass") || "");
  const smtpFrom = String(formData.get("smtpFrom") || "").trim() || null;

  if (!companyName) {
    return { error: "Company name is required." };
  }

  let logoUrl: string | undefined = undefined;
  if (logo && logo.size > 0) {
    const saved = await saveUploadedFile(logo, "branding");
    logoUrl = saved.url;
  }

  // Only overwrite the stored SMTP password if a new one was typed —
  // the settings form shows this field blank for security, so an empty
  // submit must mean "keep the existing password", not "clear it".
  const existing = await prisma.settings.findUnique({ where: { id: 1 } });

  await prisma.settings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      companyName,
      companyAddress,
      companyEmail,
      companyPhone,
      vatRate,
      quoteValidityDays,
      defaultMaxDiscount,
      commissionTiers,
      renewalTermMonths,
      logoUrl,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass: smtpPassRaw || null,
      smtpFrom,
    },
    update: {
      companyName,
      companyAddress,
      companyEmail,
      companyPhone,
      vatRate,
      quoteValidityDays,
      defaultMaxDiscount,
      commissionTiers,
      renewalTermMonths,
      ...(logoUrl ? { logoUrl } : {}),
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass: smtpPassRaw || existing?.smtpPass || null,
      smtpFrom,
    },
  });

  revalidatePath("/", "layout");
  return { success: "Settings saved." };
}

export async function sendTestEmailAction(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const to = String(formData.get("testEmail") || "").trim();
  if (!to) return { error: "Enter an email address to send the test to." };

  try {
    await sendTestEmail(to);
    return { success: `Test email sent to ${to}.` };
  } catch (err: any) {
    return { error: err?.message || "Couldn't send the test email." };
  }
}

export async function changeOwnPassword(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  const user = await prisma.user.findUnique({ where: { id: admin.id } });
  if (!user) return { error: "Account not found." };

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return { error: "Current password is incorrect." };

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: admin.id }, data: { passwordHash } });

  return { success: "Password updated." };
}
