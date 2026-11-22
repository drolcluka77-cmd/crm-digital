import { prisma } from "@/lib/prisma";

/**
 * UGC creator programme: sellers who also record short videos for the
 * Unbusyness Instagram/TikTok (always posted as an Instagram Collab).
 * Each creator has one code ("ANA") used both in their link /r/ana/<page>
 * and as a customer code that gives the first month free.
 */

/** Product landing pages on the website (unbusyness.com/sl/<slug>/). */
export const WEB_PAGES: { slug: string; label: string; match: RegExp }[] = [
  { slug: "hotels", label: "Hotels", match: /hotel/i },
  { slug: "building-managers", label: "Building managers", match: /building|upravn|property|manager/i },
  { slug: "contractor", label: "Tradespeople", match: /trade|contractor|obrt|mojster|craft/i },
  { slug: "hosts", label: "Airbnb hosts", match: /host|airbnb|rental|najem|apartma/i },
];
export const WEB_PAGE_SLUGS = WEB_PAGES.map((p) => p.slug);

/** The landing page for a product. The plain "Unbusyness" product is the Airbnb-host edition. */
export function webPageForProduct(product: { name: string } | null | undefined): string {
  if (!product) return "hosts";
  return WEB_PAGES.find((p) => p.match.test(product.name))?.slug || "hosts";
}

/** The product a website segment (hosts, hotels …) belongs to. */
export function productForSegment<T extends { name: string; family?: string | null }>(
  segment: string,
  products: T[]
): T | null {
  const seg = (segment || "").toLowerCase();
  const page = WEB_PAGES.find((p) => p.slug === seg);
  if (page && page.slug !== "hosts") {
    return products.find((p) => page.match.test(p.name)) || null;
  }
  // hosts / home / anything else → the Airbnb edition, else the plain product.
  return (
    products.find((p) => /host|airbnb|rental/i.test(p.name)) ||
    products.find((p) => p.name.trim().toLowerCase() === "unbusyness") ||
    products.find((p) => (p.family || "").toLowerCase() === "unbusyness" && !WEB_PAGES.some((w) => w.match.test(p.name))) ||
    null
  );
}

/** "Ana Novak" → "ANA" (ASCII letters only), with a number if taken. */
export async function generateUgcCode(name: string): Promise<string> {
  const base =
    (name.split(/\s+/)[0] || "creator")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z]/g, "")
      .toUpperCase()
      .slice(0, 10) || "CREATOR";
  for (let i = 0; i < 200; i++) {
    const code = i === 0 ? base : `${base}${i + 1}`;
    const taken = await prisma.user.findFirst({ where: { ugcCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  return `${base}${Date.now().toString().slice(-4)}`;
}

/** Normalises a code typed by a customer or found in a link. */
export function cleanCode(raw: unknown): string | null {
  const v = String(raw ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 20);
  return v || null;
}

export async function findCreatorByCode(raw: unknown) {
  const code = cleanCode(raw);
  if (!code) return null;
  return prisma.user.findFirst({
    where: { ugcCode: code, ugcCreator: true, active: true },
    select: { id: true, name: true, ugcCode: true, managerId: true },
  });
}

import type { BonusTier } from "@/lib/ugc-labels";
export type { BonusTier };

/** Parses "10000:10, 40000:25, 100000:50" (views:bonus €). */
export function parseBonusTiers(raw: string | null | undefined): BonusTier[] {
  return (raw || "")
    .split(/[,;\n]/)
    .map((part) => part.trim().split(":").map((x) => Number(x.trim().replace(/[€\s.]/g, ""))))
    .filter(([v, b]) => Number.isFinite(v) && Number.isFinite(b) && v > 0 && b > 0)
    .map(([views, bonus]) => ({ views, bonus }))
    .sort((a, b) => a.views - b.views);
}

/** Highest tier reached (not cumulative). */
export function bonusForViews(tiers: BonusTier[], views: number): number {
  let bonus = 0;
  for (const t of tiers) if (views >= t.views) bonus = t.bonus;
  return bonus;
}

export { UGC_STATUS_LABEL } from "@/lib/ugc-labels";

export const DEFAULT_UGC_TERMS = `Pogoji za UGC ustvarjalce (Unbusyness)

1. Videe snemam po nalogah ali navodilih v prodajnem portalu. Vsak video pred objavo potrdi sales manager ali admin.
2. Potrjen video objavim na svojem Instagram/TikTok profilu kot Instagram Collab (sodelovanje) s profilom Unbusyness. Objavo označim kot oglas (#oglas oz. »plačano partnerstvo«).
3. Družbi AURELIA GROUP d.o.o. neizključno, časovno in prostorsko neomejeno prenašam pravico do uporabe, predelave (npr. krajšanja, podnapisov) in objave videa na njenih kanalih in v oglasih.
4. Soglašam z uporabo svoje podobe in glasu v teh videih. Soglasje lahko za nove objave kadarkoli prekličem; že objavljenih oglasov ni treba odstraniti, razen če se dogovorimo drugače.
5. V videu ne pokažem osebnih podatkov strank ali drugih oseb brez njihovega soglasja in ne uporabljam glasbe ali vsebin, za katere ni pravic (uporabljam glasbo iz knjižnice Instagram/TikTok).
6. Plačilo: znesek na objavljen video in morebitni bonus glede na oglede, po veljavnem ceniku v portalu. Izplačilo poteka mesečno prek študentske napotnice oz. dogovorjene pogodbe.
7. Iz programa lahko izstopim kadarkoli.`;
