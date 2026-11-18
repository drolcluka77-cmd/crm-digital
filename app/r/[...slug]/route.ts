import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { cleanCode, findCreatorByCode, WEB_PAGE_SLUGS } from "@/lib/ugc";

export const dynamic = "force-dynamic";

/**
 * A UGC creator's tracked link: /r/<code> or /r/<code>/<page>
 * (page = hosts | hotels | building-managers | contractor).
 * Counts the click and sends the visitor to the product's landing page on
 * the website with ?ref=<code>. The website remembers the ref for 30 days
 * and sends it back with the waitlist signup (/api/webhooks/waitlist).
 */
export async function GET(req: NextRequest, { params }: { params: { slug: string[] } }) {
  const settings = await getSettings();
  const site = (settings.websiteUrl || "https://unbusyness.com").replace(/\/+$/, "");
  const [rawCode, rawPage] = params.slug || [];
  const page = WEB_PAGE_SLUGS.includes((rawPage || "").toLowerCase()) ? rawPage.toLowerCase() : null;
  const creator = await findCreatorByCode(rawCode);
  const code = cleanCode(rawCode);

  if (creator) {
    const ua = req.headers.get("user-agent") || "";
    // Don't count link-preview bots (Instagram, WhatsApp, Facebook crawlers …).
    if (!/bot|crawler|spider|facebookexternalhit|preview|whatsapp|slack|telegram/i.test(ua)) {
      await prisma.ugcClick.create({ data: { creatorId: creator.id, page } }).catch(() => {});
    }
  }

  const target = new URL(`${site}/sl/${page ? `${page}/` : ""}`);
  if (creator && code) {
    target.searchParams.set("ref", code.toLowerCase());
    target.searchParams.set("utm_source", "ugc");
    target.searchParams.set("utm_medium", "social");
    target.searchParams.set("utm_campaign", code.toLowerCase());
  }
  return NextResponse.redirect(target.toString(), 302);
}
