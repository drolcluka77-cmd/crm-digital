"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSales } from "@/lib/session";
import { lookupProspect } from "@/lib/prospect-lookup";
import { getSellableProductIds } from "@/lib/access";
import { leadGroupsFor, parseSegmentPrefs } from "@/lib/prospects";

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

  const reg = p.companyReg || p.regNumber.split(":")[0];

  // The same company may already be a customer from another pool (e.g. Picked and Unbusyness).
  const sibling = await prisma.prospect.findFirst({
    where: { companyReg: reg, status: "CLAIMED", NOT: { id: p.id } },
    include: { claimedBy: { select: { name: true } } },
  });
  if (sibling?.customerId) {
    if (sibling.claimedById !== user.id) {
      await prisma.prospect.update({
        where: { id: p.id },
        data: { status: "REJECTED", rejectReason: `Already a customer of ${sibling.claimedBy?.name || "another seller"}`, recommendedToId: null },
      });
      revalidatePath("/crm/prospects");
      return { error: `This company is already a customer of ${sibling.claimedBy?.name || "another seller"}.` };
    }
    // Same seller: add the product to the existing customer.
    if (p.product) {
      await prisma.customerProduct.upsert({
        where: { customerId_productId: { customerId: sibling.customerId, productId: p.product.id } },
        create: { customerId: sibling.customerId, productId: p.product.id },
        update: {},
      });
    }
    await prisma.prospect.update({
      where: { id: p.id },
      data: { status: "CLAIMED", claimedById: user.id, claimedAt: new Date(), customerId: sibling.customerId },
    });
    revalidatePath("/crm/prospects");
    return { success: "Already your customer — product added.", customerId: sibling.customerId };
  }

  // Lead protection: an e-mail can belong to only one customer.
  let email = p.email?.toLowerCase() || null;
  if (email && (await prisma.customer.findFirst({ where: { email } }))) email = null;

  const address = [p.street, [p.postalCode, p.postTown].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const note = [
    `Lead finder (AJPES) · matična št. ${reg}`,
    p.legalForm ? `Pravna oblika: ${p.legalForm}` : null,
    address ? `Naslov: ${address}` : null,
    p.segment ? `Panoga: ${p.segment}` : null,
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
      leadType: "COLD",
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

/** Which products the seller wants recommended leads for. */
export async function setMyLeadProducts(ids: string[]): Promise<ActionResult> {
  const user = await requireSales();
  const sellable = await getSellableProductIds(user);
  const chosen = sellable.filter((id) => ids.includes(id));
  if (chosen.length === 0) return { error: "Keep at least one product switched on." };
  const value = chosen.length === sellable.length ? null : chosen.join(",");
  await prisma.user.update({ where: { id: user.id }, data: { prospectProducts: value } });
  // Hand back open recommendations for products switched off.
  const off = sellable.filter((id) => !chosen.includes(id));
  if (off.length) {
    await prisma.prospect.updateMany({
      where: { recommendedToId: user.id, status: "RECOMMENDED", productId: { in: off } },
      data: { status: "NEW", recommendedToId: null, recommendedAt: null },
    });
  }
  revalidatePath("/crm/prospects");
  return { success: "Saved." };
}

/** Which industries the seller wants leads from in one lead group (empty = all). */
export async function setMyLeadSegments(groupKey: string, segments: string[]): Promise<ActionResult> {
  const user = await requireSales();
  const groups = await leadGroupsFor(await getSellableProductIds(user));
  const g = groups.find((x) => x.key === groupKey);
  if (!g) return { error: "You don't sell this product." };
  const clean = Array.from(new Set(segments.map((s) => s.trim()).filter(Boolean))).slice(0, 50);
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { prospectSegments: true } });
  const prefs = parseSegmentPrefs(me?.prospectSegments);
  if (clean.length) prefs[groupKey] = clean;
  else delete prefs[groupKey];
  await prisma.user.update({
    where: { id: user.id },
    data: { prospectSegments: Object.keys(prefs).length ? JSON.stringify(prefs) : null },
  });
  // Hand back open leads from other industries; new ones arrive on the next page load.
  if (clean.length) {
    await prisma.prospect.updateMany({
      where: {
        recommendedToId: user.id,
        status: "RECOMMENDED",
        productId: { in: g.productIds },
        OR: [{ segment: null }, { segment: { notIn: clean } }],
      },
      data: { status: "NEW", recommendedToId: null, recommendedAt: null },
    });
  }
  revalidatePath("/crm/prospects");
  return { success: "Saved." };
}
