"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { normalizeUrl } from "@/lib/format";

export type ActionResult = { error?: string; success?: string } | void;

export async function changeMyPassword(formData: FormData): Promise<ActionResult> {
  const me = await requireUser();

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  const user = await prisma.user.findUnique({ where: { id: me.id } });
  if (!user) return { error: "Account not found." };

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) return { error: "Current password is incorrect." };

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash } });

  return { success: "Password updated." };
}

/** Phone (shown in signatures), booking page and email notification preference. */
export async function updateMyProfile(formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const bookingUrl = normalizeUrl(String(formData.get("bookingUrl") || ""));
  if (bookingUrl) {
    try {
      new URL(bookingUrl);
    } catch {
      return { error: "That booking link doesn't look like a web address." };
    }
  }
  await prisma.user.update({
    where: { id: me.id },
    data: {
      phone: String(formData.get("phone") || "").trim() || null,
      bookingUrl,
      emailNotifications: formData.get("emailNotifications") === "on",
    },
  });
  revalidatePath("/crm/account");
  revalidatePath("/admin/settings");
  return { success: "Saved." };
}
