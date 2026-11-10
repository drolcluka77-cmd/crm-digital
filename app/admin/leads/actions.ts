"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff, type CurrentUser } from "@/lib/session";
import { canManageSeller } from "@/lib/access";
import { insertLeads, type LeadRow } from "@/lib/leads";
import { notify } from "@/lib/notify";

export type ActionResult = { error?: string; success?: string } | void;

async function poolFor(actor: CurrentUser, id: string) {
  const pool = await prisma.leadPool.findUnique({ where: { id } });
  if (!pool) return null;
  if (actor.role === "ADMIN" || pool.managerId === actor.id) return pool;
  return null;
}

function revalidatePools(id?: string) {
  revalidatePath("/admin/leads");
  if (id) revalidatePath(`/admin/leads/${id}`);
  revalidatePath("/crm/pool");
}

export async function savePool(formData: FormData): Promise<ActionResult> {
  const actor = await requireStaff();
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Give the pool a name." };
  const limitRaw = String(formData.get("claimLimit") || "").trim();
  const data = {
    name,
    description: String(formData.get("description") || "").trim() || null,
    claimable: formData.get("claimable") === "on",
    claimLimit: limitRaw ? Math.max(1, Math.round(Number(limitRaw)) || 1) : null,
  };
  // Managers' pools are always for their own team; admins choose.
  const scope = actor.role === "ADMIN" ? String(formData.get("scope") || "COMPANY") : "TEAM";
  const managerId = actor.role === "ADMIN" ? (scope === "COMPANY" ? null : scope) : actor.id;

  if (id) {
    if (!(await poolFor(actor, id))) return { error: "Pool not found." };
    await prisma.leadPool.update({ where: { id }, data: { ...data, ...(actor.role === "ADMIN" ? { managerId } : {}) } });
    revalidatePools(id);
    return { success: "Saved." };
  }
  const pool = await prisma.leadPool.create({ data: { ...data, managerId } });
  revalidatePools();
  redirect(`/admin/leads/${pool.id}`);
}

export async function deletePool(id: string): Promise<ActionResult> {
  const actor = await requireStaff();
  if (!(await poolFor(actor, id))) return { error: "Pool not found." };
  // Unassigned leads go with the pool; assigned ones stay with their seller.
  await prisma.customer.deleteMany({ where: { poolId: id, ownerId: null } });
  await prisma.leadPool.delete({ where: { id } });
  revalidatePools();
  redirect("/admin/leads");
}

export async function importToPool(poolId: string, rows: LeadRow[]) {
  const actor = await requireStaff();
  if (!(await poolFor(actor, poolId))) return { error: "Pool not found." };
  if (!Array.isArray(rows) || rows.length === 0) return { error: "Nothing to import." };
  if (rows.length > 5000) return { error: "Import at most 5,000 rows at a time." };
  const result = await insertLeads(rows, { ownerId: null, poolId, actorId: actor.id });
  revalidatePools(poolId);
  return result;
}

/**
 * Hand out leads. mode "spread" deals them out evenly (round-robin) across
 * the chosen sellers; with one seller it's a plain assignment.
 */
export async function assignLeads(poolId: string, leadIds: string[], sellerIds: string[]): Promise<ActionResult> {
  const actor = await requireStaff();
  const pool = await poolFor(actor, poolId);
  if (!pool) return { error: "Pool not found." };
  if (leadIds.length === 0) return { error: "Select some leads." };
  if (sellerIds.length === 0) return { error: "Choose at least one seller." };
  for (const sid of sellerIds) {
    if (!(await canManageSeller(actor, sid))) return { error: "You can only assign to your own sellers." };
  }

  const leads = await prisma.customer.findMany({
    where: { id: { in: leadIds }, poolId, ownerId: null },
    select: { id: true },
  });
  const counts = new Map<string, number>();
  for (const [i, lead] of leads.entries()) {
    const sellerId = sellerIds[i % sellerIds.length];
    await prisma.customer.update({ where: { id: lead.id }, data: { ownerId: sellerId } });
    await prisma.activity.create({
      data: { customerId: lead.id, userId: actor.id, type: "LEAD_ASSIGNED", body: `Assigned from “${pool.name}” by ${actor.name}` },
    });
    counts.set(sellerId, (counts.get(sellerId) || 0) + 1);
  }
  for (const [sellerId, n] of counts) {
    await notify([sellerId], {
      type: "LEADS_ASSIGNED",
      title: `${n} new lead${n === 1 ? "" : "s"} for you`,
      body: `From “${pool.name}”, assigned by ${actor.name}.`,
      link: "/crm/customers?stage=NEW",
    });
  }
  revalidatePools(poolId);
  revalidatePath("/crm/customers");
  return { success: `Assigned ${leads.length} lead${leads.length === 1 ? "" : "s"}.` };
}

export async function deletePoolLeads(poolId: string, leadIds: string[]): Promise<ActionResult> {
  const actor = await requireStaff();
  if (!(await poolFor(actor, poolId))) return { error: "Pool not found." };
  const { count } = await prisma.customer.deleteMany({ where: { id: { in: leadIds }, poolId, ownerId: null } });
  revalidatePools(poolId);
  return { success: `Deleted ${count}.` };
}
