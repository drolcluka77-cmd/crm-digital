import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";
import type { Role } from "@/lib/constants";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  active: boolean;
  managerId: string | null;
};

/** Returns the logged-in user, or null. Does not redirect. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const payload = verifySession(token);
  if (!payload) return null;

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.active) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: (user.role as Role) || "SALES",
    phone: user.phone,
    active: user.active,
    managerId: user.managerId,
  };
}

/** Where each role lands after login. */
export function homeFor(role: Role): string {
  return role === "SALES" ? "/crm" : "/admin";
}

/** Use at the top of any page/layout that requires a logged-in user. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Admins and sales managers — the management console (/admin). */
export async function requireStaff(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/crm");
  return user;
}

/** Admin only: catalog, materials, settings, managers. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(homeFor(user.role));
  return user;
}

/** Sellers' CRM (/crm). Admins & managers are sent to the console. */
export async function requireSales(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "SALES") redirect("/admin");
  return user;
}
