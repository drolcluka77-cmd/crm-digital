"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { lookupProspect } from "@/lib/prospect-lookup";

export type ActionResult = { error?: string; success?: string; customerId?: string } | void;

async function myRecommendation(id: string) {
  const user = await requireSales();
  const p = await prisma.prospect.findUnique({ where: { id }, include: { product: { select: { id: true, name: true } } } });
  if (!p || p.recommendedToId !== user.id || p.status !== "RECOMMENDED") return { user, p: null };
  return { user, p };
}

export async function lookupContact(id: string): Promise<ActionResult> {
  const { p } = await myRecommendation(id);
  if (!p) return { error: "This lead is no longer recommended to you." };
  const res = await lookupProspect(id);
  revalidatePath("/crm/prospects");
  if (res.error) return { error: res.error };
  const r = res.result!;
  const found = [r.phone && "phone", r.email && "e-mail", r.website && "website"].filter(Boolean);
  return { success: found.length ? `Found: ${found.join(", ")}. Check before you call.` : "No contact details found — try Google." };
}

/** Takes the lead: creates a customer owned by the seller, with the look-up results. */
export async function claimProspect(id: string): Promise<ActionResult> {
  const { user, p } = await myRecommendation(id);
  if (!p) return { error: "This lead is no longer recommended to you." };

  // Lead protection: an e-mail can belong to only one customer.
  let email = p.email?.toLowerCase() || null;
  if (email && (await prisma.customer.findFirst({ where: { email } }))) email = null;

  const address = [p.street, [p.postalCode, p.postTown].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const note = [
    `Lead finder (AJPES) · matična št. ${p.regNumber}`,
    p.legalForm ? `Pravna oblika: ${p.legalForm}` : null,
    address ? `Naslov: ${address}` : null,
    p.activity ? `Dejavnost: ${p.activity}` : null,
    p.soleTrader ? "s.p. (fizična oseba) — promocijske e-pošte ne pošiljaj brez soglasja; klic je v redu." : null,
  ]
    .filter(Boolean)
    .join("\n");

  const customer = await prisma.customer.create({
    data: {
      name: p.name,
      company: p.name,
      segment: p.product?.name || null,
      phone: p.phone,
      email,
      website: p.website,
      city: p.postTown,
      country: "Slovenia",
      source: "Lead finder",
      note,
      status: "NEW",
      ownerId: user.id,
      interests: p.product ? { create: [{ productId: p.product.id }] } : undefined,
    },
  });
  const { count } = await prisma.prospect.updateMany({
    where: { id: p.id, status: "RECOMMENDED", recommendedToId: user.id },
    data: { status: "CLAIMED", claimedById: user.id, claimedAt: new Date(), customerId: customer.id },
  });
  if (count === 0) {
    await prisma.customer.delete({ where: { id: customer.id } });
    return { error: "This lead was just taken." };
  }
  await prisma.activity.create({
    data: { customerId: customer.id, userId: user.id, type: "LEAD_ASSIGNED", body: "Claimed from Lead finder (AJPES)" },
  });
  revalidatePath("/crm/prospects");
  revalidatePath("/crm/customers");
  return { success: "Added to your customers.", customerId: customer.id };
}

/** "Not for me" — goes back to the pool for another seller. */
export async function skipProspect(id: string): Promise<ActionResult> {
  const { user, p } = await myRecommendation(id);
  if (!p) return { error: "This lead is no longer recommended to you." };
  await prisma.prospect.update({
    where: { id },
    data: {
      status: "NEW",
      recommendedToId: null,
      recommendedAt: null,
      skippedBy: [p.skippedBy, user.id].filter(Boolean).join(","),
    },
  });
  revalidatePath("/crm/prospects");
  return { success: "Passed on to another seller." };
}

/** Not a fit for any product, or asked not to be contacted. */
export async function rejectProspect(id: string, reason: string, doNotContact: boolean): Promise<ActionResult> {
  const { p } = await myRecommendation(id);
  if (!p) return { error: "This lead is no longer recommended to you." };
  await prisma.prospect.update({
    where: { id },
    data: {
      status: doNotContact ? "DO_NOT_CONTACT" : "REJECTED",
      rejectReason: reason.trim().slice(0, 300) || null,
      recommendedToId: null,
    },
  });
  revalidatePath("/crm/prospects");
  return { success: doNotContact ? "Marked as do not contact." : "Removed." };
}
