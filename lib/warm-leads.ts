import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { notify, supervisorsOf } from "@/lib/notify";
import { logActivity } from "@/lib/activity";

/**
 * Warm leads (signed up on the website, possibly via a UGC creator) go to
 * one seller at a time. The seller has Settings.warmClaimHours (default 72)
 * to accept it; otherwise it moves on to the next seller who sells the product.
 * A creator who is also a seller gets no priority for their own leads.
 */

const ids = (raw: string | null | undefined) => (raw || "").split(",").filter(Boolean);

async function pickSeller(productId: string | null, exclude: string[]): Promise<string | null> {
  const sellers = await prisma.user.findMany({
    where: {
      role: "SALES",
      active: true,
      id: { notIn: exclude },
      ...(productId ? { productAccess: { some: { productId } } } : {}),
    },
    select: { id: true },
  });
  if (sellers.length === 0) return null;
  // Fewest warm leads waiting for acceptance first, then fewest assigned in the last 30 days.
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [pending, recent] = await Promise.all([
    prisma.customer.groupBy({
      by: ["ownerId"],
      where: { ownerId: { in: sellers.map((s) => s.id) }, warmAssignedAt: { not: null }, warmAcceptedAt: null },
      _count: { _all: true },
    }),
    prisma.customer.groupBy({
      by: ["ownerId"],
      where: { ownerId: { in: sellers.map((s) => s.id) }, warmAssignedAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);
  const p = new Map(pending.map((r) => [r.ownerId, r._count._all]));
  const r = new Map(recent.map((x) => [x.ownerId, x._count._all]));
  const ranked = sellers
    .map((s) => ({ id: s.id, p: p.get(s.id) || 0, r: r.get(s.id) || 0, rnd: Math.random() }))
    .sort((a, b) => a.p - b.p || a.r - b.r || a.rnd - b.rnd);
  return ranked[0].id;
}

/** Gives a warm lead to the next seller (or leaves it with nobody and tells the admins). */
export async function assignWarmLead(customerId: string): Promise<string | null> {
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { interests: { select: { productId: true } } },
  });
  if (!c) return null;
  const settings = await getSettings();
  const productId = c.interests[0]?.productId || null;
  const skipped = ids(c.warmSkippedBy);
  const sellerId = await pickSeller(productId, skipped);
  const who = c.company || c.name;

  if (!sellerId) {
    await prisma.customer.update({ where: { id: c.id }, data: { ownerId: null, warmAssignedAt: null } });
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
    await notify(admins.map((a) => a.id), {
      type: "WARM_LEAD",
      title: `Warm lead without a seller: ${who}`,
      body: "No active seller sells this product (or all of them passed). Assign it under Lead pools or give a seller access to the product.",
      link: "/admin/leads",
    });
    return null;
  }

  await prisma.customer.update({
    where: { id: c.id },
    data: { ownerId: sellerId, warmAssignedAt: new Date(), warmAcceptedAt: null },
  });
  await logActivity(c.id, null, "LEAD_ASSIGNED", "Warm lead assigned — waiting for the seller to accept");
  await notify([sellerId], {
    type: "WARM_LEAD",
    title: `🔥 Warm lead: ${who}`,
    body: `Signed up on the website${c.ugcCreatorId ? " via a UGC video" : ""}${c.freeMonth ? " with a creator code (1st month free)" : ""}. Accept it within ${settings.warmClaimHours} h or it goes to another seller — and call them soon.`,
    link: `/crm/customers/${c.id}`,
  });
  return sellerId;
}

/** Seller accepts a warm lead assigned to them. */
export async function acceptWarmLead(customerId: string, userId: string): Promise<boolean> {
  const { count } = await prisma.customer.updateMany({
    where: { id: customerId, ownerId: userId, warmAssignedAt: { not: null }, warmAcceptedAt: null },
    data: { warmAcceptedAt: new Date() },
  });
  if (count) await logActivity(customerId, userId, "NOTE", "Warm lead accepted");
  return count > 0;
}

/** Seller passes on a warm lead → next seller. */
export async function passWarmLead(customerId: string, userId: string): Promise<boolean> {
  const c = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!c || c.ownerId !== userId || !c.warmAssignedAt || c.warmAcceptedAt) return false;
  await prisma.customer.update({
    where: { id: c.id },
    data: { warmSkippedBy: [...ids(c.warmSkippedBy), userId].join(",") },
  });
  await logActivity(c.id, userId, "NOTE", "Seller passed on the warm lead");
  await assignWarmLead(c.id);
  return true;
}

/** Moves warm leads nobody accepted in time to the next seller. Safe to call often. */
export async function expireWarmLeads(): Promise<number> {
  const settings = await getSettings();
  const cutoff = new Date(Date.now() - settings.warmClaimHours * 3_600_000);
  const stale = await prisma.customer.findMany({
    where: { warmAssignedAt: { lt: cutoff }, warmAcceptedAt: null, ownerId: { not: null } },
    select: { id: true, ownerId: true, warmSkippedBy: true, company: true, name: true },
    take: 50,
  });
  let moved = 0;
  for (const c of stale) {
    const skipped = [...ids(c.warmSkippedBy), c.ownerId!];
    const next = await pickSeller(
      (await prisma.customerProduct.findFirst({ where: { customerId: c.id }, select: { productId: true } }))?.productId || null,
      skipped
    );
    if (!next) {
      // Nobody else can take it: leave it with the current seller, remind them and their manager once.
      await prisma.customer.update({ where: { id: c.id }, data: { warmAcceptedAt: null, warmAssignedAt: new Date() } });
      await notify([c.ownerId, ...(await supervisorsOf(c.ownerId!))], {
        type: "WARM_LEAD",
        title: `Warm lead still not accepted: ${c.company || c.name}`,
        body: "No other seller can take it, so it stays where it is. Please contact them.",
        link: `/crm/customers/${c.id}`,
      }, { email: false });
      continue;
    }
    await prisma.customer.update({ where: { id: c.id }, data: { warmSkippedBy: skipped.join(",") } });
    await logActivity(c.id, null, "NOTE", `Not accepted within ${settings.warmClaimHours} h — moved to another seller`);
    await notify([c.ownerId], {
      type: "WARM_LEAD",
      title: `Warm lead moved on: ${c.company || c.name}`,
      body: `You didn't accept it within ${settings.warmClaimHours} h, so it went to another seller.`,
    }, { email: false });
    await assignWarmLead(c.id);
    moved++;
  }
  return moved;
}
