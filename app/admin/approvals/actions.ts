"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { canManageSeller } from "@/lib/access";
import { notify } from "@/lib/notify";

export type ActionResult = { error?: string; success?: string } | void;

/** Manager/admin approves or declines a quote's discount. */
export async function decideApproval(quoteId: string, approve: boolean, note: string): Promise<ActionResult> {
  const actor = await requireStaff();
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, include: { customer: true } });
  if (!quote || !(await canManageSeller(actor, quote.userId))) return { error: "Quote not found." };
  if (quote.approvalStatus !== "PENDING") return { error: "This quote isn't waiting for approval any more." };

  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      approvalStatus: approve ? "APPROVED" : "REJECTED",
      approvalNote: note.trim() || null,
      approvedById: actor.id,
      approvedAt: new Date(),
    },
  });
  await notify([quote.userId], {
    type: "APPROVAL_DECIDED",
    title: `${quote.number} ${approve ? "approved" : "not approved"} by ${actor.name}`,
    body: note.trim() || (approve ? "You can send it to the client now." : "Adjust the discount and save again."),
    link: `/crm/quotes/${quote.id}`,
  });
  revalidatePath("/admin/approvals");
  revalidatePath(`/crm/quotes/${quoteId}`);
  return { success: approve ? "Approved." : "Declined." };
}
