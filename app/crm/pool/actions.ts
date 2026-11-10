"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { OPEN_LEAD_STATUSES } from "@/lib/constants";

export type ActionResult = { error?: string; success?: string } | void;

/** A seller takes an unassigned lead from a claimable pool. */
export async function claimLead(leadId: string): Promise<ActionResult> {
  const user = await requireSales();
  const lead = await prisma.customer.findUnique({ where: { id: leadId }, include: { pool: true } });
  const pool = lead?.pool;
  if (!lead || !pool || lead.ownerId) return { error: "Someone else already took this lead." };
  if (!pool.claimable || (pool.managerId && pool.managerId !== user.managerId)) {
    return { error: "You can't claim leads from this pool." };
  }
  if (pool.claimLimit) {
    const open = await prisma.customer.count({
      where: { poolId: pool.id, ownerId: user.id, status: { in: [...OPEN_LEAD_STATUSES] } },
    });
    if (open >= pool.claimLimit) {
      return { error: `You already have ${open} open leads from this pool (limit ${pool.claimLimit}). Work those first.` };
    }
  }
  // Only succeeds if still unassigned (no double claims).
  const { count } = await prisma.customer.updateMany({ where: { id: leadId, ownerId: null }, data: { ownerId: user.id } });
  if (count === 0) return { error: "Someone else just took this lead." };
  await prisma.activity.create({
    data: { customerId: leadId, userId: user.id, type: "LEAD_ASSIGNED", body: `Claimed from “${pool.name}”` },
  });
  revalidatePath("/crm/pool");
  revalidatePath("/crm/customers");
  return { success: "Lead added to your customers." };
}
