// Builds the website code for a client from its company card:
// schema.org JSON-LD, llms.txt, robots.txt lines, a footer NAP block and an e-mail for the client's developer.
import { DAY_LABELS, SITE_PLATFORM_LABEL, type CardHours, type GeoCard } from "@/lib/geo-labels";

const SCHEMA_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** schema.org type for an industry (the card can override it). */
export function schemaTypeFor(industry: string | null | undefined, card: GeoCard): string {
  if (card.schemaType?.trim()) return card.schemaType.trim();
  const cat = (card.primaryCategory || "").toLowerCase();
  switch (industry) {
    case "RESTAURANT":
      if (/kavarn|caf/.test(cat)) return "CafeOrCoffeeShop";
      if (/bar|pub/.test(cat)) return "BarOrPub";
      if (/slaščič|bakery|pekarn/.test(cat)) return "Bakery";
      return "Restaurant";
    case "LODGING":
      if (/hotel/.test(cat)) return "Hotel";
      if (/hostel/.test(cat)) return "Hostel";
      if (/kamp|camp/.test(cat)) return "Campground";
      if (/b&b|bed and breakfast|penzion|guest/.test(cat)) return "BedAndBreakfast";
      return "LodgingBusiness";
    case "ACTIVITIES":
      return "TouristAttraction";
    case "TOWING":
      return "AutomotiveBusiness";
    case "CAR_REPAIR":
      if (/vulkan|gume|tire|tyre/.test(cat)) return "TireShop";
      if (/karoserij|ličar|body/.test(cat)) return "AutoBodyShop";
      return "AutoRepair";
    case "TRADES":
      if (/elektri/.test(cat)) return "Electrician";
      if (/vodovod|inštalater|plumb/.test(cat)) return "Plumber";
      if (/ogrevan|klima|hvac/.test(cat)) return "HVACBusiness";
      if (/krov|roof/.test(cat)) return "RoofingContractor";
      if (/ključavn|lock/.test(cat)) return "Locksmith";
      if (/slikopleskar|painter/.test(cat)) return "HousePainter";
      return "HomeAndConstructionBusiness";
    case "INSURANCE":
      return "InsuranceAgency";
    case "DENTAL":
      if (/zob|dent/.test(cat)) return "Dentist";
      return "MedicalClinic";
    default:
      return "LocalBusiness";
  }
}

const clean = (s?: string) => (s || "").trim();
const lines = (s?: string) => clean(s).split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
function siteUrl(card: GeoCard) {
  const w = clean(card.website);
  if (!w) return "";
  return (/^https?:\/\//i.test(w) ? w : `https://${w}`).replace(/\/+$/, "");
}
function price(p?: string) {
  const m = clean(p).replace(/\s/g, "").match(/^(?:od)?(\d+(?:[.,]\d{1,2})?)(?:€|eur)?$/i);
  return m ? m[1].replace(",", ".") : null;
}

function hoursSpec(card: GeoCard) {
  if (card.open24h) {
    return [{ "@type": "OpeningHoursSpecification", dayOfWeek: SCHEMA_DAYS, opens: "00:00", closes: "23:59" }];
  }
  // Group days that share the same times.
  const groups = new Map<string, string[]>();
  (card.hours || []).forEach((h: CardHours, i) => {
    if (!h || h.closed) return;
    const slots = [[h.open, h.close]];
    if (h.open2 && h.close2) slots.push([h.open2, h.close2]);
    for (const [o, c] of slots) {
      if (!o || !c) continue;
      const k = `${o}-${c}`;
      groups.set(k, [...(groups.get(k) || []), SCHEMA_DAYS[i]]);
    }
  });
  return Array.from(groups.entries()).map(([k, days]) => {
    const [opens, closes] = k.split("-");
    return { "@type": "OpeningHoursSpecification", dayOfWeek: days.length === 1 ? days[0] : days, opens, closes };
  });
}

function specialHours(card: GeoCard) {
  return (card.holidays || [])
    .filter((h) => h.date)
    .map((h) =>
      h.closed
        ? { "@type": "OpeningHoursSpecification", validFrom: h.date, validThrough: h.date, opens: "00:00", closes: "00:00" }
        : { "@type": "OpeningHoursSpecification", validFrom: h.date, validThrough: h.date, opens: h.open, closes: h.close }
    );
}

const LANG_NAMES: Record<string, string> = { SL: "sl", EN: "en", HR: "hr", IT: "it", DE: "de", HU: "hu" };

export function buildSchema(card: GeoCard, industry: string | null | undefined) {
  const url = siteUrl(card);
  const type = schemaTypeFor(industry, card);
  const id = url ? `${url}/#business` : undefined;
  const sameAs = Object.values(card.profiles || {}).map(clean).filter(Boolean);
  const services = (card.services || []).filter((s) => clean(s.name));
  const biz: Record<string, any> = {
    "@type": type,
    ...(id ? { "@id": id } : {}),
    name: clean(card.legalName),
    description: clean(card.description) || undefined,
    url: url || undefined,
    telephone: clean(card.phone) || undefined,
    email: clean(card.email) || undefined,
    logo: clean(card.logoUrl) || undefined,
    image: clean(card.imageUrl) || clean(card.logoUrl) || undefined,
    priceRange: clean(card.priceRange) || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: clean(card.address),
      postalCode: clean(card.postalCode) || undefined,
      addressLocality: clean(card.city),
      addressCountry: clean(card.country) || "SI",
    },
    ...(clean(card.lat) && clean(card.lng)
      ? { geo: { "@type": "GeoCoordinates", latitude: Number(card.lat), longitude: Number(card.lng) } }
      : {}),
    ...(card.profiles?.google ? { hasMap: clean(card.profiles.google) } : {}),
    openingHoursSpecification: hoursSpec(card),
    ...(specialHours(card).length ? { specialOpeningHoursSpecification: specialHours(card) } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(card.siteLanguages?.length ? { knowsLanguage: card.siteLanguages.map((l) => LANG_NAMES[l] || l.toLowerCase()) } : {}),
    ...(lines(card.areaServed).length ? { areaServed: lines(card.areaServed).map((a) => ({ "@type": "City", name: a })) } : {}),
    ...(clean(card.cuisine) ? { servesCuisine: lines(card.cuisine) } : {}),
    ...(card.acceptsReservations !== undefined && ["Restaurant", "CafeOrCoffeeShop", "BarOrPub", "Bakery"].includes(type)
      ? { acceptsReservations: !!card.acceptsReservations }
      : {}),
    ...(clean(card.menuUrl) ? { hasMenu: clean(card.menuUrl) } : {}),
    ...(clean(card.checkin) ? { checkinTime: clean(card.checkin) } : {}),
    ...(clean(card.checkout) ? { checkoutTime: clean(card.checkout) } : {}),
    ...(lines(card.amenities).length
      ? { amenityFeature: lines(card.amenities).map((a) => ({ "@type": "LocationFeatureSpecification", name: a, value: true })) }
      : {}),
    ...(clean(card.specialties) && ["Dentist", "MedicalClinic"].includes(type) ? { medicalSpecialty: lines(card.specialties) } : {}),
    ...(services.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: "Storitve",
            itemListElement: services.map((s) => {
              const p = price(s.price);
              return {
                "@type": "Offer",
                itemOffered: { "@type": "Service", name: clean(s.name), description: clean(s.description) || undefined },
                ...(p ? { price: p, priceCurrency: "EUR" } : {}),
                ...(!p && clean(s.price) ? { description: clean(s.price) } : {}),
              };
            }),
          },
        }
      : {}),
  };
  const graph: any[] = [biz];
  const faqs = (card.faqs || []).filter((f) => clean(f.q) && clean(f.a));
  if (faqs.length) {
    graph.push({
      "@type": "FAQPage",
      ...(url ? { "@id": `${url}/#faq` } : {}),
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: clean(f.q), acceptedAnswer: { "@type": "Answer", text: clean(f.a) } })),
    });
  }
  if (url) graph.push({ "@type": "WebSite", "@id": `${url}/#website`, url, name: clean(card.legalName), publisher: { "@id": id } });
  // Drop undefined keys.
  return JSON.parse(JSON.stringify({ "@context": "https://schema.org", "@graph": graph }));
}

export function schemaScriptTag(card: GeoCard, industry: string | null | undefined) {
  return `<script type="application/ld+json">\n${JSON.stringify(buildSchema(card, industry), null, 2)}\n</script>`;
}

function hoursText(card: GeoCard) {
  if (card.open24h) return "Odprto 24/7.";
  return (card.hours || [])
    .map((h, i) => `${DAY_LABELS[i]}: ${h.closed ? "zaprto" : `${h.open}–${h.close}${h.open2 && h.close2 ? `, ${h.open2}–${h.close2}` : ""}`}`)
    .join("\n");
}

export function buildLlmsTxt(card: GeoCard, industry: string | null | undefined) {
  const url = siteUrl(card);
  const name = clean(card.legalName);
  const desc = clean(card.description);
  const first = desc.split(/(?<=[.!?])\s/)[0] || desc;
  const out: string[] = [`# ${name}`, "", `> ${first}`, ""];
  if (desc && desc !== first) out.push(desc, "");
  out.push("## Osnovni podatki", "");
  out.push(`- Dejavnost: ${clean(card.primaryCategory)}${clean(card.extraCategories) ? `, ${clean(card.extraCategories)}` : ""}`);
  out.push(`- Naslov: ${[clean(card.address), [clean(card.postalCode), clean(card.city)].filter(Boolean).join(" ")].filter(Boolean).join(", ")}`);
  if (clean(card.phone)) out.push(`- Telefon: ${clean(card.phone)}`);
  if (clean(card.email)) out.push(`- E-pošta: ${clean(card.email)}`);
  if (url) out.push(`- Spletna stran: ${url}`);
  if (clean(card.areaServed)) out.push(`- Območje: ${clean(card.areaServed)}`);
  if (card.siteLanguages?.length) out.push(`- Jeziki: ${card.siteLanguages.join(", ")}`);
  if (clean(card.priceRange)) out.push(`- Cenovni razred: ${clean(card.priceRange)}`);
  out.push("", "## Delovni čas", "", hoursText(card), "");
  const services = (card.services || []).filter((s) => clean(s.name));
  if (services.length) {
    out.push("## Storitve", "");
    for (const s of services)
      out.push(`- ${clean(s.name)}${clean(s.description) ? `: ${clean(s.description)}` : ""}${clean(s.price) ? ` (${clean(s.price)})` : ""}`);
    out.push("");
  }
  const faqs = (card.faqs || []).filter((f) => clean(f.q) && clean(f.a));
  if (faqs.length) {
    out.push("## Pogosta vprašanja", "");
    for (const f of faqs) out.push(`### ${clean(f.q)}`, "", clean(f.a), "");
  }
  const links = Object.entries(card.profiles || {}).filter(([, v]) => clean(v));
  if (links.length || clean(card.menuUrl)) {
    out.push("## Povezave", "");
    if (url) out.push(`- [Spletna stran](${url})`);
    if (clean(card.menuUrl)) out.push(`- [Meni / cenik](${clean(card.menuUrl)})`);
    const names: Record<string, string> = { google: "Google profil", facebook: "Facebook", instagram: "Instagram", tripadvisor: "TripAdvisor", booking: "Booking.com", linkedin: "LinkedIn", other: "Drugo" };
    for (const [k, v] of links) out.push(`- [${names[k] || k}](${clean(v)})`);
    out.push("");
  }
  void industry;
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
];

export function buildRobotsLines(card: GeoCard) {
  const url = siteUrl(card);
  return [
    "# Dovoli AI iskalnikom branje strani (Mr. Picked)",
    ...AI_BOTS.flatMap((b) => [`User-agent: ${b}`, "Allow: /", ""]),
    url ? `Sitemap: ${url}/sitemap.xml` : "",
  ]
    .join("\n")
    .trim() + "\n";
}

export function buildFooterHtml(card: GeoCard) {
  const addr = [clean(card.address), [clean(card.postalCode), clean(card.city)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const tel = clean(card.phone);
  return `<p>
  <strong>${clean(card.legalName)}</strong><br>
  ${addr}<br>
  ${tel ? `Tel.: <a href="tel:${tel.replace(/[^\d+]/g, "")}">${tel}</a>` : ""}${clean(card.email) ? `<br>\n  E-pošta: <a href="mailto:${clean(card.email)}">${clean(card.email)}</a>` : ""}
</p>`;
}

/** E-mail text for the client's own web developer. */
export function buildDeveloperEmail(card: GeoCard, industry: string | null | undefined, from: { name: string }) {
  const name = clean(card.legalName);
  return {
    subject: `${name}: podatki za spletno stran (schema.org, llms.txt, robots.txt)`,
    body: `Pozdravljeni,

za podjetje ${name} skrbimo za vidnost v Googlu in AI asistentih (ChatGPT, Gemini, Perplexity). Prosimo vas, da na spletno stran ${siteUrl(card) || ""} dodate spodnje štiri stvari. Delo vzame približno 30 minut.

1) STRUKTURIRANI PODATKI (schema.org)
V <head> vseh strani (ali vsaj domače) dodajte:

${schemaScriptTag(card, industry)}

2) DATOTEKA llms.txt
V koren strani (${siteUrl(card) || "https://…"}/llms.txt) naložite datoteko z vsebino:

${buildLlmsTxt(card, industry)}
3) robots.txt
V obstoječi robots.txt dodajte (če kateri od teh robotov že ima "Disallow: /", to odstranite):

${buildRobotsLines(card)}
4) NOGA STRANI
Ime, naslov in telefon v nogi naj bodo zapisani natančno tako:

${buildFooterHtml(card)}

Ko bo urejeno, nam prosim sporočite — preverimo samodejno. Za vprašanja sem na voljo.

Lep pozdrav,
${from.name}
Mr. Picked · info@mrpicked.eu`,
  };
}

/** Short how-to for the person who pastes the code, by website platform. */
export const PLATFORM_STEPS: Record<string, string[]> = {
  WORDPRESS: [
    "Namesti vtičnik WPCode (Insert Headers and Footers) ali uporabi obstoječega.",
    "Code Snippets → Add Snippet → HTML → prilepi celoten <script type=\"application/ld+json\"> … </script>, lokacija: Site Wide Header. Shrani in aktiviraj.",
    "Če ima stran Yoast ali Rank Math, ki že dodaja svojo schemo: naša je dodatna, se ne izključujeta. Preveri le, da ime, naslov in telefon niso drugačni.",
    "llms.txt: z vtičnikom za llms.txt ali prek upravitelja datotek gostitelja (cPanel → File Manager → public_html) naloži datoteko llms.txt.",
    "robots.txt: Yoast → Orodja → Urejevalnik datotek, ali Rank Math → Splošne nastavitve → Uredi robots.txt. Dodaj vrstice iz zavihka.",
    "Nogo uredi v Videz → Gradniki (ali v urejevalniku teme) z besedilom iz zavihka.",
  ],
  WIX: [
    "Nastavitve → Napredno → Koda po meri (Custom Code) → Dodaj kodo: prilepi <script type=\"application/ld+json\">, Vse strani, mesto: Head.",
    "robots.txt: SEO orodja → Urejevalnik robots.txt → dodaj vrstice iz zavihka.",
    "llms.txt: če Wix nalaganja datoteke v koren ne omogoča, nalogo za llms.txt označi kot »Ni izvedljivo« z opombo.",
    "Nogo uredi v urejevalniku strani (besedilo v nogi).",
  ],
  SQUARESPACE: [
    "Nastavitve → Napredno → Vstavljanje kode (Code Injection) → Header: prilepi <script type=\"application/ld+json\">.",
    "Nastavitve → Crawlers: preveri, da AI roboti NISO blokirani.",
    "robots.txt in llms.txt v Squarespacu nista prosto urejljiva: označi kot »Ni izvedljivo« z opombo.",
    "Nogo uredi v urejevalniku strani.",
  ],
  WEBFLOW: [
    "Site settings → Custom code → Head code: prilepi <script type=\"application/ld+json\">. Objavi stran.",
    "Site settings → SEO → robots.txt: dodaj vrstice iz zavihka.",
    "llms.txt: če nalaganja v koren ni mogoče, označi kot »Ni izvedljivo«.",
  ],
  SHOPIFY: [
    "Online Store → Themes → Edit code → theme.liquid: pred </head> prilepi <script type=\"application/ld+json\">.",
    "robots.txt: Edit code → Add a new template → robots.txt (robots.txt.liquid) → dodaj vrstice za AI robote.",
    "llms.txt: če ga ni mogoče naložiti, označi kot »Ni izvedljivo«.",
  ],
  CUSTOM_DEV: [
    "Klikni »Kopiraj e-mail za programerja« in ga pošlji programerju stranke (kontakt je v Predaji).",
    "Nalogo nastavi na »Čaka stranko«. Ko programer sporoči, da je urejeno, klikni »Preveri stran«.",
  ],
  CUSTOM_NODEV: [
    "To vstavi naš programer. Pošlji mu e-mail iz tega zavihka (ali mu daj dostop do zavihka Koda).",
    "Ko sporoči, da je urejeno, klikni »Preveri stran«.",
  ],
  NONE: ["Stranka nima spletne strani. Nalogo označi kot »Ni izvedljivo« in predlagaj dodatek »Spletna stran za AI«."],
};

export function platformLabel(p?: string) {
  return (p && SITE_PLATFORM_LABEL[p]) || "—";
}
