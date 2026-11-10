"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff, type CurrentUser } from "@/lib/session";
import { generateTempPassword, hashPassword } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export type ActionResult = { error?: string; success?: string; tempPassword?: string } | void;

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

/**
 * Admins can manage anyone except demoting/deleting themselves.
 * Managers can manage only the sellers on their own team.
 */
async function canManageUser(actor: CurrentUser, targetId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return null;
  if (actor.role === "ADMIN") return target;
  if (actor.role === "MANAGER" && target.role === "SALES" && target.managerId === actor.id) return target;
  return null;
}

function revalidateTeam() {
  revalidatePath("/admin/team");
  revalidatePath("/admin/access");
  revalidatePath("/admin");
}

export async function createUser(formData: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const phone = str(formData, "phone") || null;
  if (!name || !email) return { error: "Name and email are required." };

  // Managers can only create sellers on their own team.
  let role = actor.role === "ADMIN" ? str(formData, "role") || "SALES" : "SALES";
  if (!ROLES.includes(role as any)) role = "SALES";
  let managerId: string | null =
    actor.role === "MANAGER" ? actor.id : role === "SALES" ? str(formData, "managerId") || null : null;
  if (managerId && actor.role === "ADMIN") {
    const m = await prisma.user.findUnique({ where: { id: managerId } });
    if (!m || m.role !== "MANAGER") managerId = null;
  }

  if (await prisma.user.findUnique({ where: { email } })) {
    return { error: "An account with that email already exists." };
  }

  const tempPassword = generateTempPassword();
  const user = await prisma.user.create({
    data: { name, email, phone, role, managerId, passwordHash: await hashPassword(tempPassword), active: true },
  });

  // Optionally give the new seller products straight away.
  const productIds = formData.getAll("productIds").map(String).filter(Boolean);
  if (role === "SALES" && productIds.length) {
    const valid = await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true } });
    await prisma.productAccess.createMany({
      data: valid.map((p) => ({ userId: user.id, productId: p.id, grantedById: actor.id })),
    });
  }

  revalidateTeam();
  return { tempPassword };
}

export async function updateUser(formData: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const id = str(formData, "id");
  const target = await canManageUser(actor, id);
  if (!target) return { error: "You can't edit this person." };

  const name = str(formData, "name");
  const email = str(formData, "email").toLowerCase();
  const phone = str(formData, "phone") || null;
  if (!name || !email) return { error: "Name and email are required." };
  if (await prisma.user.findFirst({ where: { email, NOT: { id } } })) {
    return { error: "Another account already uses that email." };
  }

  const data: Record<string, unknown> = { name, email, phone };
  if (actor.role === "ADMIN") {
    const rateRaw = str(formData, "commissionRate");
    data.commissionRate = rateRaw === "" ? null : Math.min(100, Math.max(0, Number(rateRaw) || 0));
    const role = str(formData, "role") || target.role;
    if (ROLES.includes(role as any) && !(id === actor.id && role !== "ADMIN")) data.role = role;
    const effectiveRole = (data.role as string) || target.role;
    const managerId = str(formData, "managerId") || null;
    if (effectiveRole === "SALES" && managerId) {
      const m = await prisma.user.findUnique({ where: { id: managerId } });
      data.managerId = m && m.role === "MANAGER" ? managerId : null;
    } else {
      data.managerId = null;
    }
    // A manager who becomes something else leaves their team without a manager.
    if (target.role === "MANAGER" && effectiveRole !== "MANAGER") {
      await prisma.user.updateMany({ where: { managerId: id }, data: { managerId: null } });
    }
  }

  await prisma.user.update({ where: { id }, data });
  revalidateTeam();
  return { success: "Saved." };
}

export async function toggleUserActive(id: string, active: boolean): Promise<ActionResult> {
  const actor = await requireStaff();
  if (id === actor.id) return { error: "You can't deactivate yourself." };
  if (!(await canManageUser(actor, id))) return { error: "You can't change this person." };
  await prisma.user.update({ where: { id }, data: { active } });
  revalidateTeam();
}

export async function resetUserPassword(id: string): Promise<ActionResult> {
  const actor = await requireStaff();
  if (!(await canManageUser(actor, id))) return { error: "You can't change this person." };
  const tempPassword = generateTempPassword();
  await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(tempPassword) } });
  return { tempPassword };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const actor = await requireStaff();
  if (id === actor.id) return { error: "You can't delete yourself." };
  if (!(await canManageUser(actor, id))) return { error: "You can't delete this person." };

  const [customers, quotes] = await Promise.all([
    prisma.customer.count({ where: { ownerId: id } }),
    prisma.quote.count({ where: { userId: id } }),
  ]);
  if (customers > 0 || quotes > 0) {
    return {
      error:
        "This person owns customers or quotes. Transfer their customers and deactivate the account instead, so history is kept.",
    };
  }
  await prisma.user.updateMany({ where: { managerId: id }, data: { managerId: null } });
  await prisma.user.delete({ where: { id } });
  revalidateTeam();
}

/** Hand a leaving seller's leads to a colleague. Quotes stay credited to the original seller. */
export async function transferCustomers(fromId: string, toId: string): Promise<ActionResult> {
  const actor = await requireStaff();
  if (fromId === toId) return { error: "Choose a different seller." };
  const [from, to] = await Promise.all([canManageUser(actor, fromId), canManageUser(actor, toId)]);
  if (!from || !to || to.role !== "SALES") return { error: "You can only transfer between your own sellers." };

  const { count } = await prisma.customer.updateMany({ where: { ownerId: fromId }, data: { ownerId: toId } });
  revalidateTeam();
  revalidatePath("/crm/customers");
  return { success: `${count} customer${count === 1 ? "" : "s"} moved to ${to.name}.` };
}
