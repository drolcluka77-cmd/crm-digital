// Delivery after the sale ("izvedba") — labels shared by server and client components (no server imports).
// Lines: PICKED (Mr. Picked GEO, worked by the GEO assistant) and UNBUSYNESS (pilots, worked by the
// forward deployment engineer).

export const DELIVERY_LINES = ["PICKED", "UNBUSYNESS"] as const;
export const DELIVERY_LINE_LABEL: Record<string, string> = { PICKED: "Mr. Picked", UNBUSYNESS: "Unbusyness pilot" };
/** Roles that can be assigned to work a line (admins always can). */
export const DELIVERY_LINE_ROLE: Record<string, string> = { PICKED: "GEO", UNBUSYNESS: "FDE" };
export const DELIVERY_ROLE_LABEL: Record<string, string> = { GEO: "GEO asistent", FDE: "Forward deployment engineer" };
/** Which product names belong to which line. */
export function lineForProductName(name: string): string | null {
  if (/picked/i.test(name)) return "PICKED";
  if (/unbusyness/i.test(name)) return "UNBUSYNESS";
  return null;
}

export const GEO_PACKAGES = ["VISIBLE", "RECOMMENDED", "CONCIERGE"] as const;
export const GEO_PACKAGE_LABEL: Record<string, string> = {
  VISIBLE: "Visible",
  RECOMMENDED: "Recommended",
  CONCIERGE: "Concierge",
};

export const GEO_ADDONS = ["VIDEOS", "REVIEWS", "WHATSAPP", "WEBSITE"] as const;
export const GEO_ADDON_LABEL: Record<string, string> = {
  VIDEOS: "AI videi (+3 na mesec)",
  REVIEWS: "Zbiranje ocen",
  WHATSAPP: "WhatsApp concierge",
  WEBSITE: "Spletna stran za AI",
};

export const GEO_INDUSTRIES = [
  "RESTAURANT",
  "LODGING",
  "ACTIVITIES",
  "TOWING",
  "CAR_REPAIR",
  "TRADES",
  "INSURANCE",
  "DENTAL",
  "OTHER",
] as const;
export const GEO_INDUSTRY_LABEL: Record<string, string> = {
  RESTAURANT: "Gostinstvo",
  LODGING: "Hotel / apartmaji",
  ACTIVITIES: "Izleti in aktivnosti",
  TOWING: "Avtovleka in pomoč na cesti",
  CAR_REPAIR: "Avtoservis",
  TRADES: "Obrtniki",
  INSURANCE: "Zavarovanje",
  DENTAL: "Zobozdravstvo in klinike",
  OTHER: "Drugo",
};

export const GEO_LANGUAGES = ["SL", "EN", "HR", "IT", "DE", "HU"] as const;

export const GEO_STATUSES = [
  "DRAFT",
  "HANDED_OVER",
  "KICKOFF",
  "ACCESS",
  "BASELINE",
  "FIX",
  "MAINTENANCE",
  "DAY90",
  "SETUP",
  "TEST",
  "PILOT",
  "REVIEW",
  "DONE",
  "CANCELLED",
] as const;
/** Status flow per line (for the board and the manual status picker). */
export const LINE_STATUSES: Record<string, string[]> = {
  PICKED: ["DRAFT", "HANDED_OVER", "KICKOFF", "ACCESS", "BASELINE", "FIX", "MAINTENANCE", "DAY90", "CANCELLED"],
  UNBUSYNESS: ["DRAFT", "HANDED_OVER", "KICKOFF", "SETUP", "TEST", "PILOT", "REVIEW", "DONE", "CANCELLED"],
};
export const GEO_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Osnutek predaje",
  HANDED_OVER: "Predano",
  KICKOFF: "Uvodni klic",
  ACCESS: "Dostopi",
  BASELINE: "Izhodišče",
  FIX: "Popravek",
  MAINTENANCE: "Vzdrževanje",
  DAY90: "Dan 90",
  SETUP: "Nastavitev",
  TEST: "Test",
  PILOT: "Pilot teče",
  REVIEW: "Pregled pilota",
  DONE: "Zaključeno",
  CANCELLED: "Prekinjeno",
};
/** What has to happen for the client to move on from each status. */
export const GEO_STATUS_NEXT: Record<string, string> = {
  DRAFT: "Prodajalec izpolni vsa obvezna polja in odda predajo.",
  HANDED_OVER: "Administrator dodeli GEO asistenta.",
  KICKOFF: "Kartica podjetja ima izpolnjena vsa obvezna polja.",
  ACCESS: "Dostop do Google profila je odobren.",
  BASELINE: "Vnesena je meritev za mesec 0 (izhodišče).",
  FIX: "Vse naloge faze Popravek so končane (cilj: dan 30).",
  MAINTENANCE: "Po 3 mesecih CRM odpre Dan 90.",
  DAY90: "Administrator potrdi primerjavo; stranka se vrne v Vzdrževanje.",
  SETUP: "Vse naloge nastavitve so končane.",
  TEST: "Test je opravljen in lastnik je potrdil zagon.",
  PILOT: "Vse naloge pilota so končane (tedenski pregledi, meritve).",
  REVIEW: "Administrator zaključi pilot: nadaljuje kot plačljiva stranka ali konec.",
  DONE: "",
  CANCELLED: "",
};
/** Unbusyness: KICKOFF uses the same label, but a different condition. */
export const UNB_STATUS_NEXT: Record<string, string> = {
  HANDED_OVER: "Administrator dodeli forward deployment engineerja.",
  KICKOFF: "Naloge uvodnega klica in zbiranja podatkov so končane.",
};
export function statusNext(line: string, status: string) {
  return (line === "UNBUSYNESS" && UNB_STATUS_NEXT[status]) || GEO_STATUS_NEXT[status] || "";
}
export const GEO_ACTIVE_STATUSES = ["KICKOFF", "ACCESS", "BASELINE", "FIX", "MAINTENANCE", "DAY90", "SETUP", "TEST", "PILOT", "REVIEW"];

export const GEO_TASK_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_CLIENT", "WAITING_APPROVAL", "DONE", "NOT_POSSIBLE"] as const;
export const GEO_TASK_STATUS_LABEL: Record<string, string> = {
  OPEN: "Odprto",
  IN_PROGRESS: "V delu",
  WAITING_CLIENT: "Čaka stranko",
  WAITING_APPROVAL: "Čaka potrditev",
  DONE: "Končano",
  NOT_POSSIBLE: "Ni izvedljivo",
};
export const GEO_OPEN_TASK_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_CLIENT"];

export const GEO_PHASES = ["START", "FIX", "MONTHLY", "QUARTERLY", "DAY90", "SETUP", "TEST", "PILOT", "REVIEW"] as const;
export const GEO_PHASE_LABEL: Record<string, string> = {
  START: "Začetek",
  FIX: "Popravek",
  MONTHLY: "Mesečno",
  QUARTERLY: "Četrtletno",
  DAY90: "Dan 90",
  SETUP: "Nastavitev",
  TEST: "Test",
  PILOT: "Pilot",
  REVIEW: "Pregled",
};

export const GEO_TEMPLATE_GROUPS = [
  "VISIBLE",
  "RECOMMENDED",
  "CONCIERGE",
  "ADDON_VIDEOS",
  "ADDON_REVIEWS",
  "ADDON_WHATSAPP",
  "ADDON_WEBSITE",
  "UNBUSYNESS_PILOT",
] as const;
export const GEO_TEMPLATE_GROUP_LABEL: Record<string, string> = {
  VISIBLE: "Visible",
  RECOMMENDED: "Recommended",
  CONCIERGE: "Concierge",
  ADDON_VIDEOS: "Add-on: AI videos",
  ADDON_REVIEWS: "Add-on: reviews",
  ADDON_WHATSAPP: "Add-on: WhatsApp",
  ADDON_WEBSITE: "Add-on: website",
  UNBUSYNESS_PILOT: "Unbusyness pilot",
};

export const GEO_PLATFORMS = [
  "GOOGLE",
  "WEBSITE",
  "BING",
  "APPLE",
  "FACEBOOK",
  "INSTAGRAM",
  "TRIPADVISOR",
  "AIRBNB",
  "BOOKING",
  "PMS",
  "WHATSAPP",
  "EMAIL",
  "OTHER",
] as const;
export const GEO_PLATFORM_LABEL: Record<string, string> = {
  GOOGLE: "Google profil podjetja",
  WEBSITE: "Spletna stran",
  BING: "Bing Places",
  APPLE: "Apple Business Connect",
  FACEBOOK: "Facebook",
  INSTAGRAM: "Instagram",
  TRIPADVISOR: "TripAdvisor",
  AIRBNB: "Airbnb (sporočila gostov)",
  BOOKING: "Booking.com (Extranet)",
  PMS: "Sistem za rezervacije / channel manager",
  WHATSAPP: "WhatsApp Business",
  EMAIL: "E-pošta za goste",
  OTHER: "Drugo",
};
export const GEO_ACCESS_STATUSES = ["NOT_REQUESTED", "REQUESTED", "APPROVED", "PROBLEM"] as const;
export const GEO_ACCESS_STATUS_LABEL: Record<string, string> = {
  NOT_REQUESTED: "Ni zahtevano",
  REQUESTED: "Zahtevano",
  APPROVED: "Odobreno",
  PROBLEM: "Težava",
};

export const SITE_PLATFORMS = [
  "WORDPRESS",
  "WIX",
  "SQUARESPACE",
  "WEBFLOW",
  "SHOPIFY",
  "CUSTOM_DEV",
  "CUSTOM_NODEV",
  "NONE",
] as const;
export const SITE_PLATFORM_LABEL: Record<string, string> = {
  WORDPRESS: "WordPress",
  WIX: "Wix",
  SQUARESPACE: "Squarespace",
  WEBFLOW: "Webflow",
  SHOPIFY: "Shopify",
  CUSTOM_DEV: "Po meri — ima svojega programerja",
  CUSTOM_NODEV: "Po meri — brez programerja (naš programer)",
  NONE: "Nima spletne strani",
};

export const DAY_LABELS = ["Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota", "Nedelja"];

// ─── Company card ────────────────────────────────────────────────────────

export type CardHours = { closed: boolean; open: string; close: string; open2?: string; close2?: string };
export type CardHoliday = { date: string; closed: boolean; open?: string; close?: string; note?: string };
export type CardService = { name: string; description?: string; price?: string };
export type CardFaq = { q: string; a: string };

export type GeoCard = {
  legalName?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  country?: string; // ISO, default SI
  phone?: string;
  email?: string;
  website?: string;
  lat?: string;
  lng?: string;
  hours?: CardHours[]; // Mon..Sun
  open24h?: boolean;
  holidays?: CardHoliday[];
  primaryCategory?: string;
  extraCategories?: string;
  schemaType?: string; // override of the schema.org type
  services?: CardService[];
  description?: string;
  faqs?: CardFaq[];
  photosUrl?: string; // shared folder with photos
  photosCount?: number;
  logoUrl?: string;
  imageUrl?: string;
  priceRange?: string;
  profiles?: { google?: string; facebook?: string; instagram?: string; tripadvisor?: string; booking?: string; linkedin?: string; other?: string };
  competitors?: string[];
  keySearches?: string[];
  aiQuestions?: string[];
  sitePlatform?: string;
  siteLanguages?: string[];
  // Industry specifics
  cuisine?: string;
  acceptsReservations?: boolean;
  menuUrl?: string;
  checkin?: string;
  checkout?: string;
  amenities?: string;
  areaServed?: string;
  specialties?: string;
  insuranceTypes?: string;
};

export function emptyHours(): CardHours[] {
  return DAY_LABELS.map((_, i) => ({ closed: i >= 5, open: "08:00", close: "16:00" }));
}

/** Missing required card fields (Slovenian labels). Empty list = card complete. */
export function missingCardFields(card: GeoCard, pkg?: string | null): string[] {
  const m: string[] = [];
  const has = (v?: string) => !!v && v.trim().length > 0;
  if (!has(card.legalName)) m.push("Uradno ime");
  if (!has(card.address)) m.push("Naslov");
  if (!has(card.city)) m.push("Kraj");
  if (!has(card.phone)) m.push("Telefon");
  if (card.sitePlatform !== "NONE" && !has(card.website)) m.push("Spletna stran (ali označi, da je nima)");
  if (!has(card.sitePlatform)) m.push("Na čem je spletna stran");
  if (!card.open24h && !(card.hours || []).some((h) => !h.closed)) m.push("Delovni čas");
  if (!has(card.primaryCategory)) m.push("Glavna kategorija");
  if (!(card.services || []).some((s) => has(s.name))) m.push("Storitve oz. meni");
  if (!has(card.description)) m.push("Kratek opis");
  if (!has(card.photosUrl) || (card.photosCount || 0) < 10) m.push("Fotografije (najmanj 10)");
  const needQ = pkg === "VISIBLE" || !pkg ? 30 : 50;
  if ((card.aiQuestions || []).filter(has).length < needQ) m.push(`AI vprašanja (${needQ})`);
  if ((card.keySearches || []).filter(has).length < 10) m.push("Ključna iskanja (10)");
  return m;
}

export type Handover = {
  company?: string | null;
  industry?: string | null;
  package?: string | null;
  monthlyPrice?: number | null;
  startDate?: Date | string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  customerValue?: number | null;
  mainProblem?: string | null;
  promised?: string | null;
};

export function missingHandoverFields(h: Handover): string[] {
  const m: string[] = [];
  const has = (v?: string | null) => !!v && String(v).trim().length > 0;
  if (!has(h.company)) m.push("Ime podjetja");
  if (!has(h.industry)) m.push("Panoga");
  if (!has(h.package)) m.push("Paket");
  if (!h.monthlyPrice) m.push("Mesečna cena");
  if (!h.startDate) m.push("Datum začetka");
  if (!has(h.contactName)) m.push("Kontaktna oseba");
  if (!has(h.contactPhone)) m.push("Telefon kontakta");
  if (!has(h.contactEmail)) m.push("E-pošta kontakta");
  if (!h.customerValue) m.push("Vrednost ene stranke");
  if (!has(h.mainProblem)) m.push("Glavni problem");
  if (!has(h.promised)) m.push("Kaj je prodajalec obljubil");
  return m;
}

export function fmtDay(d: string | null) {
  return d ? new Date(d).toLocaleDateString("sl-SI", { day: "numeric", month: "numeric", year: "2-digit" }) : "—";
}

// ─── Unbusyness pilot handover ───────────────────────────────────────────

export const UNB_PROPERTY_TYPES: Record<string, string> = {
  APARTMENTS: "Apartmaji / sobe",
  HOTEL: "Hotel",
  HOSTEL: "Hostel",
  BUILDINGS: "Upravljanje stavb",
  OTHER: "Drugo",
};
export const UNB_BOOKING_CHANNELS: Record<string, string> = {
  AIRBNB: "Airbnb",
  BOOKING: "Booking.com",
  DIRECT: "Direktne rezervacije",
  OTHER: "Drugo",
};
export const UNB_GUEST_CHANNELS: Record<string, string> = {
  PLATFORM: "Sporočila na Airbnb/Booking",
  WHATSAPP: "WhatsApp",
  EMAIL: "E-pošta",
  PHONE: "Telefon / SMS",
};

export type UnbDetails = {
  propertyType?: string;
  units?: number | null;
  locations?: string;
  bookingChannels?: string[];
  guestChannels?: string[];
  pms?: string;
  whoAnswers?: string; // who answers guests today
  pilotGoal?: string; // what must be true after the pilot
  pilotDays?: number | null;
  priceAfterPilot?: number | null;
  outcome?: "CONVERTED" | "ENDED";
  outcomeNote?: string;
};

export function missingUnbHandover(h: Handover & { details?: UnbDetails | null }): string[] {
  const m: string[] = [];
  const has = (v?: string | null) => !!v && String(v).trim().length > 0;
  const d = h.details || {};
  if (!has(h.company)) m.push("Ime podjetja");
  if (!h.startDate) m.push("Datum začetka pilota");
  if (!has(h.contactName)) m.push("Kontaktna oseba");
  if (!has(h.contactPhone)) m.push("Telefon kontakta");
  if (!has(h.contactEmail)) m.push("E-pošta kontakta");
  if (!has(d.propertyType)) m.push("Vrsta nastanitve");
  if (!d.units) m.push("Število enot");
  if (!(d.bookingChannels || []).length) m.push("Kanali rezervacij");
  if (!(d.guestChannels || []).length) m.push("Kje gostje pišejo");
  if (!has(h.mainProblem)) m.push("Glavni problem");
  if (!has(d.pilotGoal)) m.push("Cilj pilota");
  if (!has(h.promised)) m.push("Kaj je prodajalec obljubil");
  return m;
}

export function missingHandoverFor(line: string, h: Handover & { details?: unknown }): string[] {
  return line === "UNBUSYNESS" ? missingUnbHandover({ ...h, details: (h.details as UnbDetails) || {} }) : missingHandoverFields(h);
}
