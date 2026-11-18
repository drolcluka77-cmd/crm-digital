import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";
import { findCreatorByCode, productForSegment } from "@/lib/ugc";
import { assignWarmLead } from "@/lib/warm-leads";

export const dynamic = "force-dynamic";

/**
 * Waitlist signups from the website (unbusyness.com) become warm leads.
 *   POST /api/webhooks/waitlist   header  X-Webhook-Secret: WAITLIST_WEBHOOK_SECRET
 * Body (JSON): { email, name?, phone?, city?, units?, segment, channels?, pains?,
 *                language?, page?, ref?, code?, signupId? }
 * - ref  = creator code remembered from a /r/<code> link (30 days)
 * - code = creator code typed into the form (1st month free); wins over ref
 * The lead is tagged WARM_UGC (with the creator) or WARM_WEB and offered to a seller.
 * An e-mail that is already in the CRM is not duplicated: its seller is told instead.
 */

function authorised(req: NextRequest): boolean {
  const secret = process.env.WAITLIST_WEBHOOK_SECRET || "";
  const given = req.headers.get("x-webhook-secret") || req.nextUrl.searchParams.get("secret") || "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

const clip = (v: unknown, n = 200) => {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, n) : null;
};
const list = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x).slice(0, 40)).filter(Boolean).slice(0, 12) : []);

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON" }, { status: 400 });
  }

  const email = (clip(body?.email, 200) || "").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const segment = (clip(body?.segment, 40) || "hosts").toLowerCase();
  const typed = await findCreatorByCode(body?.code);
  const creator = typed || (await findCreatorByCode(body?.ref));
  const page = clip(body?.page, 120);

  const existing = await prisma.customer.findFirst({ where: { email } });
  if (existing) {
    await logActivity(existing.id, null, "WEBSITE_SIGNUP", `Signed up again on the website (${segment}${page ? `, ${page}` : ""})`);
    if (typed && !existing.freeMonth) {
      await prisma.customer.update({ where: { id: existing.id }, data: { freeMonth: true, refCode: typed.ugcCode } });
    }
    if (existing.ownerId) {
      await notify([existing.ownerId], {
        type: "WARM_LEAD",
        title: `${existing.company || existing.name} signed up on the website`,
        body: "They're already your customer — a good moment to call.",
        link: `/crm/customers/${existing.id}`,
      });
    }
    return NextResponse.json({ ok: true, duplicate: true, customerId: existing.id });
  }

  const products = await prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, family: true },
    orderBy: { sortOrder: "asc" },
  });
  const product = productForSegment(segment, products);

  const name = clip(body?.name, 120) || email.split("@")[0];
  const channels = list(body?.channels);
  const pains = list(body?.pains);
  const note = [
    `Waitlist on the website${page ? ` (${page})` : ""}${body?.language ? ` · language ${clip(body.language, 5)}` : ""}`,
    body?.units ? `Units / size: ${clip(body.units, 80)}` : null,
    channels.length ? `Channels: ${channels.join(", ")}` : null,
    pains.length ? `Biggest pains: ${pains.join(", ")}` : null,
    creator ? `UGC creator: ${creator.name} (code ${creator.ugcCode}${typed ? ", typed in the form" : ", from the link"})` : null,
    typed ? "Used a creator code → first month free." : null,
  ]
    .filter(Boolean)
    .join("\n");

  const customer = await prisma.customer.create({
    data: {
      name,
      email,
      phone: clip(body?.phone, 60),
      city: clip(body?.city, 80),
      country: "Slovenia",
      segment: product?.name || null,
      size: clip(body?.units, 80),
      source: creator ? `UGC · ${creator.ugcCode}` : "Website (waitlist)",
      leadType: creator ? "WARM_UGC" : "WARM_WEB",
      ugcCreatorId: creator?.id || null,
      refCode: creator?.ugcCode || null,
      freeMonth: !!typed,
      note,
      status: "NEW",
      interests: product ? { create: [{ productId: product.id }] } : undefined,
    },
  });
  await logActivity(customer.id, null, "WEBSITE_SIGNUP", `Signed up on the website${creator ? ` via ${creator.name}'s video` : ""}`);
  const sellerId = await assignWarmLead(customer.id);

  return NextResponse.json({ ok: true, customerId: customer.id, assignedTo: sellerId ? "seller" : null });
}
