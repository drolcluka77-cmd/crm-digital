"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, signSession, verifyPassword } from "@/lib/auth";
import { homeFor } from "@/lib/session";
import type { Role } from "@/lib/constants";

export type LoginState = { error?: string } | undefined;

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    return { error: "Invalid email or password." };
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return { error: "Invalid email or password." };
  }

  const role = (user.role as Role) || "SALES";
  const token = signSession({ userId: user.id, role });
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(homeFor(role));
}

export async function logoutAction() {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}
