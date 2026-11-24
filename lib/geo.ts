import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notify";
import {
  GEO_ACTIVE_STATUSES,
  GEO_OPEN_TASK_STATUSES,
  GEO_PLATFORM_LABEL,
  GEO_STATUS_LABEL,
  missingCardFields,
  missingHandoverFor,
  PHASE_FLOW,
  type GeoCard,
} from "@/lib/geo-labels";

export * from "@/lib/geo-labels";

const DAY = 86_400_000;

// ─── Default task templates (from the delivery spec) ──────────────────────

type Tpl = {
  key?: string;
  packages: string[];
  title: string;
  description?: string;
  phase: string;
  recurrence?: "ONCE" | "MONTHLY" | "QUARTERLY";
  dueDay: number;
  needsApproval?: boolean;
  technical?: boolean;
};
const ALL = ["VISIBLE", "RECOMMENDED", "CONCIERGE"];
const RC = ["RECOMMENDED", "CONCIERGE"];

export const DEFAULT_GEO_TEMPLATES: Tpl[] = [
  // Visible (base for every package)
  {
    key: "kickoff-card",
    packages: ALL,
    title: "Uvodni klic in izpolnjena kartica podjetja",
    description:
      "Pokliči kontaktno osebo in se predstavi.\nIzpolni kartico podjetja (delovni čas, storitve s cenami, opis, pogosta vprašanja, profili).\nDogovori se za fotografije (najmanj 10) in jih shrani v mapo.\nSestavi 10 ključnih iskanj in AI vprašanja.",
    phase: "START",
    dueDay: 3,
  },
  {
    key: "access",
    packages: ALL,
    title: "Zahtevaj dostope: Google profil, spletna stran, Bing, Apple, Facebook",
    description:
      "Stranko prosi, da nas doda kot upravitelja (info@mrpicked.eu). Gesel ne sprejemamo.\nVsak dostop zabeleži v zavihku Dostopi.",
    phase: "START",
    dueDay: 3,
  },
  {
    key: "baseline",
    packages: ALL,
    title: "Izhodiščna meritev: AI vprašanja + 10 iskanj na Zemljevidih (mesec 0)",
    description: "Postavi vsa AI vprašanja v ChatGPT, Gemini, Perplexity in Googlove AI odgovore.\nZapiši omembe, konkurente in napačne podatke.\nVnesi meritev za mesec 0.",
    phase: "START",
    dueDay: 5,
  },
  {
    packages: ALL,
    title: "Pregled Google profila in podatkov na drugih platformah (neskladja, podvojeni vpisi)",
    phase: "START",
    dueDay: 7,
  },
  {
    packages: ALL,
    title: "Google profil: kategorije, opis, storitve oz. meni, atributi, delovni čas s prazniki, fotografije, povezava",
    phase: "FIX",
    dueDay: 14,
    needsApproval: true,
  },
  {
    packages: ALL,
    title: "Vpisi na 15+ platformah: enaki podatki, odstranjeni podvojeni vpisi",
    phase: "FIX",
    dueDay: 30,
  },
  {
    key: "website-code",
    packages: ALL,
    title: "Spletna stran: schema.org, llms.txt, robots.txt, enaki podatki v nogi, storitve in cene berljive",
    description:
      "Kodo dobiš v zavihku Koda (sestavljena iz kartice).\nWordPress / Wix / Squarespace: vstavi po navodilih v zavihku Koda.\nStran po meri s programerjem: pošlji mu e-mail iz zavihka Koda.\nStran po meri brez programerja: naloga gre našemu programerju.\nNa koncu klikni »Preveri stran«.",
    phase: "FIX",
    dueDay: 21,
    needsApproval: true,
    technical: true,
  },
  {
    packages: ALL,
    title: "Google Search Console in Bing Webmaster Tools, oddaja sitemapa",
    phase: "FIX",
    dueDay: 21,
    technical: true,
  },
  { packages: ALL, title: "Objava na Google profilu (1/4)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 7, needsApproval: true },
  { packages: ALL, title: "Objava na Google profilu (2/4)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 14, needsApproval: true },
  { packages: ALL, title: "Objava na Google profilu (3/4)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 21, needsApproval: true },
  { packages: ALL, title: "Objava na Google profilu (4/4)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 28, needsApproval: true },
  {
    packages: ALL,
    title: "Kontrola profila: prazniki, nove fotografije, predlagane spremembe drugih uporabnikov",
    phase: "MONTHLY",
    recurrence: "MONTHLY",
    dueDay: 25,
  },
  { packages: ALL, title: "Preverjanje vpisov", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 25 },
  {
    key: "measurement",
    packages: ALL,
    title: "Meritev: ista AI vprašanja + 10 iskanj",
    phase: "MONTHLY",
    recurrence: "MONTHLY",
    dueDay: 28,
  },
  {
    key: "report",
    packages: ALL,
    title: "Mesečno poročilo z oceno vidnosti",
    phase: "MONTHLY",
    recurrence: "MONTHLY",
    dueDay: 0,
    needsApproval: true,
  },
  {
    key: "day90",
    packages: ALL,
    title: "Primerjava z izhodiščem in preverjanje obljube 90 dni",
    phase: "DAY90",
    dueDay: 90,
    needsApproval: true,
  },
  // Recommended adds
  { packages: RC, title: "Razširi AI vprašanja na 50 in dodaj 3 konkurente", phase: "START", dueDay: 7 },
  {
    packages: [...RC, "ADDON_REVIEWS"],
    title: "Postavi zbiranje ocen: povezava ali QR koda, po možnosti samodejen SMS ali e-mail po obisku",
    phase: "FIX",
    dueDay: 21,
  },
  { packages: ["RECOMMENDED"], title: "2 AI videa", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 15, needsApproval: true },
  {
    packages: [...RC, "ADDON_REVIEWS"],
    title: "Odgovori na nove Google ocene v 48 urah (sproti)",
    phase: "MONTHLY",
    recurrence: "MONTHLY",
    dueDay: 0,
    needsApproval: true,
  },
  { packages: RC, title: "2 strani z vprašanji strank", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 20, needsApproval: true },
  { packages: RC, title: "Četrtletni pregled rezultatov s stranko", phase: "QUARTERLY", recurrence: "QUARTERLY", dueDay: 10 },
  // Concierge adds
  {
    packages: ["CONCIERGE", "ADDON_WHATSAPP"],
    title: "Postavitev WhatsApp conciergea: pogosta vprašanja, cenik, pravila predaje lastniku, test",
    phase: "FIX",
    dueDay: 21,
    needsApproval: true,
    technical: true,
  },
  { packages: ["CONCIERGE", "ADDON_WHATSAPP"], title: "Opomniki za termine in sledenje neprihodom", phase: "FIX", dueDay: 30 },
  { packages: ["CONCIERGE"], title: "Storitve in cenik na spletu (6 jezikov)", phase: "FIX", dueDay: 30, needsApproval: true },
  { packages: ["CONCIERGE"], title: "4 AI videi", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 15, needsApproval: true },
  { packages: ["CONCIERGE"], title: "Sezonska kampanja", phase: "QUARTERLY", recurrence: "QUARTERLY", dueDay: 15, needsApproval: true },
  { packages: ["CONCIERGE"], title: "Mesečni strateški sestanek", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 5 },
  // Add-ons
  { packages: ["ADDON_VIDEOS"], title: "3 dodatni AI videi (dodatek)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 15, needsApproval: true },
  {
    packages: ["ADDON_WEBSITE"],
    title: "Spletna stran za AI: projekt (administrator doda seznam nalog)",
    phase: "FIX",
    dueDay: 30,
    technical: true,
  },
];

/** Social media add-ons (Social Start / Social Plus). Posts are made from the client's Mr. Picked content. */
const SOC = ["ADDON_SOCIAL", "ADDON_SOCIAL_PLUS"];
export const DEFAULT_SOCIAL_TEMPLATES: Tpl[] = [
  {
    packages: SOC,
    title: "Družbena omrežja: dostop do FB strani in IG računa (Meta Business Suite), povezava v Metricool, ton in teme objav s stranko",
    phase: "START",
    dueDay: 7,
  },
  { packages: SOC, title: "Mesečni načrt objav v Metricool (stranka odobri)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 3, needsApproval: true },
  { packages: ["ADDON_SOCIAL"], title: "8 objav na Facebooku + Instagramu iz Mr. Picked vsebine", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 28 },
  { packages: ["ADDON_SOCIAL_PLUS"], title: "12–16 objav + zgodbe na Facebooku + Instagramu", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 28 },
  { packages: SOC, title: "4 Google objave na profilu podjetja", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 28 },
  {
    packages: ["ADDON_SOCIAL_PLUS"],
    title: "Odgovori na komentarje in sporočila na FB + IG ob delavnikih (sproti)",
    phase: "MONTHLY",
    recurrence: "MONTHLY",
    dueDay: 0,
  },
  { packages: SOC, title: "Rezultati omrežij v mesečno poročilo (doseg, sledilci, klik na profil)", phase: "MONTHLY", recurrence: "MONTHLY", dueDay: 30 },
];

const U = ["UNBUSYNESS_PILOT"];
/** Unbusyness pilot (forward deployment engineer). Days count from the pilot start date. */
export const DEFAULT_UNB_TEMPLATES: Tpl[] = [
  {
    packages: U,
    title: "Uvodni klic z lastnikom: cilj pilota, kdo zdaj odgovarja gostom, nujni primeri",
    description: "Potrdi cilj pilota iz predaje in kako ga bomo merili.\nKdo in kdaj zdaj odgovarja gostom, koliko sporočil je na teden.\nKontakt za nujne primere in kdaj AI preda pogovor človeku.",
    phase: "START",
    dueDay: 2,
  },
  {
    packages: U,
    title: "Zberi podatke: enote, hišni red, navodila za prihod, Wi-Fi, parkiranje, pogosta vprašanja gostov",
    description: "Seznam enot z naslovi in kapaciteto.\nHišni red, check-in/out, navodila za prihod in ključe.\n20 najpogostejših vprašanj gostov z odgovori lastnika.",
    phase: "START",
    dueDay: 4,
  },
  {
    packages: U,
    title: "Dostopi: kanali sporočil gostov in sistem za rezervacije (povabila, brez gesel)",
    description: "Vsak dostop zabeleži v zavihku Dostopi.",
    phase: "START",
    dueDay: 4,
  },
  { packages: U, title: "Nastavi Unbusyness: enote, baza znanja, jeziki, ton odgovorov", phase: "SETUP", dueDay: 9 },
  { packages: U, title: "Poveži kanale sporočil in rezervacij", phase: "SETUP", dueDay: 10, technical: true },
  { packages: U, title: "Pravila predaje lastniku: kdaj AI vpraša človeka, nujni primeri, ure", phase: "SETUP", dueDay: 10 },
  {
    packages: U,
    title: "Interni test: 20 tipičnih vprašanj gostov v vseh jezikih, popravki odgovorov",
    phase: "TEST",
    dueDay: 12,
  },
  { packages: U, title: "Test z lastnikom in njegova potrditev za zagon", phase: "TEST", dueDay: 14, needsApproval: true },
  { packages: U, title: "Zagon pilota in obvestilo lastniku (kaj spremljamo, kako nas doseže)", phase: "PILOT", dueDay: 15 },
  { packages: U, title: "Tedenski pregled pogovorov in popravki baze znanja (1. teden)", phase: "PILOT", dueDay: 22 },
  { packages: U, title: "Tedenski pregled pogovorov in popravki baze znanja (2. teden)", phase: "PILOT", dueDay: 29 },
  { packages: U, title: "Tedenski pregled pogovorov in popravki baze znanja (3. teden)", phase: "PILOT", dueDay: 36 },
  {
    packages: U,
    title: "Meritve pilota: št. pogovorov, delež brez človeka, odzivni čas, ocena lastnika",
    phase: "PILOT",
    dueDay: 43,
  },
  {
    key: "pilot-review",
    packages: U,
    title: "Sestanek ob koncu pilota: rezultati in predlog za nadaljevanje (s prodajalcem)",
    phase: "REVIEW",
    dueDay: 45,
    needsApproval: true,
  },
];

const SI = ["SIMPLEIMPORT"];
/** SimpleImport (import coordinator). Days count from the start date (contract signed, 149 € paid). */
export const DEFAULT_IMPORT_TEMPLATES: Tpl[] = [
  {
    packages: SI,
    title: "Uvodni klic: izdelek, specifikacija, količina, ciljna cena, rok, dostava",
    description: "Potrdi specifikacijo iz predaje (materiali, mere, barve, embalaža, logotip).\nPotrebni certifikati in zahteve za EU trg (npr. CE, stik z živili).\nZapiši spremembe v zgodovino stranke.",
    phase: "START",
    dueDay: 2,
  },
  {
    packages: SI,
    title: "Iskanje dobaviteljev: najmanj 3 primerni proizvajalci",
    description: "Iskanje na platformah in pri znanih proizvajalcih.\nZa vsakega: cena na kos, MOQ, rok izdelave, plačilni pogoji, certifikati.",
    phase: "SOURCING",
    dueDay: 7,
  },
  {
    packages: SI,
    title: "Preverjanje dobaviteljev: registracija podjetja, reference, izvozne izkušnje, certifikati",
    phase: "SOURCING",
    dueDay: 9,
  },
  {
    packages: SI,
    title: "Primerjava ponudb za stranko (brez imen dobaviteljev) in priporočilo",
    description: "Cena na kos, ocena stroškov prevoza in carine, rok dostave, tveganja.\nImena dobaviteljev se razkrijejo šele po plačilu provizije.",
    phase: "OFFERS",
    dueDay: 11,
    needsApproval: true,
  },
  { packages: SI, title: "Stranka izbere ponudbo (zapiši izbiro in pogoje)", phase: "OFFERS", dueDay: 16 },
  { packages: ["SIMPLEIMPORT_SAMPLES"], title: "Naroči vzorce in uredi plačilo vzorcev", phase: "SAMPLES", dueDay: 18 },
  { packages: ["SIMPLEIMPORT_SAMPLES"], title: "Vzorci prejeti in potrjeni s stranko (fotografije, opombe)", phase: "SAMPLES", dueDay: 32 },
  {
    packages: SI,
    title: "Stranka plačala provizijo (potrdi administrator)",
    description: "Provizija se plača ob potrditvi naročila, hkrati z avansom proizvajalcu.\nŠele po plačilu provizije stranki razkrijemo dobavitelja.",
    phase: "ORDER",
    dueDay: 20,
    needsApproval: true,
  },
  {
    packages: SI,
    title: "Naročilo pri proizvajalcu: pogodba ali PI, specifikacija, rok, plačilni pogoji; avans 30 % plačan",
    phase: "ORDER",
    dueDay: 22,
  },
  { packages: SI, title: "Spremljanje proizvodnje (tedensko poročilo stranki)", phase: "PRODUCTION", dueDay: 40 },
  {
    packages: SI,
    title: "Kontrola kakovosti pred odpremo (fotografije, pregled ali inšpekcija)",
    phase: "PRODUCTION",
    dueDay: 50,
    needsApproval: true,
  },
  { packages: SI, title: "Preostanek plačila proizvajalcu in odprema", phase: "PRODUCTION", dueDay: 52 },
  { packages: SI, title: "Prevoz: ponudba špediterja, rezervacija, dokumenti (račun, pakirni list, B/L)", phase: "SHIPPING", dueDay: 55 },
  { packages: SI, title: "Carina in uvozne dajatve, DDV pri uvozu", phase: "SHIPPING", dueDay: 85 },
  { packages: SI, title: "Dostava stranki in potrditev prejema; zaključni klic (ponovno naročilo?)", phase: "SHIPPING", dueDay: 90 },
];

const tplRow = (t: Tpl, i: number) => ({
  key: t.key ?? null,
  packages: t.packages,
  title: t.title,
  description: t.description ?? null,
  phase: t.phase,
  recurrence: t.recurrence ?? "ONCE",
  dueDay: t.dueDay,
  needsApproval: !!t.needsApproval,
  technical: !!t.technical,
  sortOrder: i,
});

/** Creates the default templates once per line (when that line has none yet). */
export async function ensureGeoTemplates() {
  const all = await prisma.geoTaskTemplate.findMany({ select: { packages: true } });
  if (!all.some((t) => asStrings(t.packages).includes("UNBUSYNESS_PILOT"))) {
    await prisma.geoTaskTemplate.createMany({ data: DEFAULT_UNB_TEMPLATES.map((t, i) => tplRow(t, 500 + i)) });
  }
  if (!all.some((t) => asStrings(t.packages).includes("SIMPLEIMPORT"))) {
    await prisma.geoTaskTemplate.createMany({ data: DEFAULT_IMPORT_TEMPLATES.map((t, i) => tplRow(t, 700 + i)) });
  }
  if (all.length > 0 && !all.some((t) => asStrings(t.packages).includes("ADDON_SOCIAL"))) {
    await prisma.geoTaskTemplate.createMany({ data: DEFAULT_SOCIAL_TEMPLATES.map((t, i) => tplRow(t, 400 + i)) });
  }
  if (all.length > 0) return;
  await prisma.geoTaskTemplate.createMany({
    data: DEFAULT_GEO_TEMPLATES.map((t, i) => ({
      key: t.key ?? null,
      packages: t.packages,
      title: t.title,
      description: t.description ?? null,
      phase: t.phase,
      recurrence: t.recurrence ?? "ONCE",
      dueDay: t.dueDay,
      needsApproval: !!t.needsApproval,
      technical: !!t.technical,
      sortOrder: i,
    })),
  });
  await prisma.geoTaskTemplate.createMany({ data: DEFAULT_SOCIAL_TEMPLATES.map((t, i) => tplRow(t, 400 + i)) });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

export function asCard(v: unknown): GeoCard {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as GeoCard) : {};
}
export function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

/** Template groups that apply to a client: its package plus add-ons. */
export function clientGroups(c: { package: string | null; addons: unknown; line?: string; details?: unknown }): string[] {
  if (c.line === "UNBUSYNESS") return ["UNBUSYNESS_PILOT"];
  if (c.line === "IMPORT") return ["SIMPLEIMPORT", ...((c as any).details?.samples ? ["SIMPLEIMPORT_SAMPLES"] : [])];
  return [c.package || "VISIBLE", ...asStrings(c.addons).map((a) => `ADDON_${a}`)];
}

export async function geoLog(clientId: string, user: { id: string; name: string } | null, action: string, detail?: string | null) {
  await prisma.geoLog.create({
    data: { clientId, userId: user?.id ?? null, userName: user?.name ?? "CRM", action, detail: detail ?? null },
  });
}

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function dayInMonth(year: number, month: number, day: number) {
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const d = day <= 0 || day > last ? last : day;
  return new Date(Date.UTC(year, month, d, 9, 0, 0));
}
function monthsBetween(a: Date, b: Date) {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}

// ─── Task generation ──────────────────────────────────────────────────────

/** One-time tasks from the package templates. Run once, when the assistant is assigned. */
export async function createOnceTasks(clientId: string) {
  await ensureGeoTemplates();
  const c = await prisma.geoClient.findUnique({ where: { id: clientId } });
  if (!c || !c.startDate) return 0;
  const groups = clientGroups(c);
  const card = asCard(c.card);
  // SimpleImport with samples: everything after the samples moves two weeks later.
  const withSamples = c.line === "IMPORT" && !!(c.details as { samples?: boolean } | null)?.samples;
  const shiftFor = (phase: string) => (withSamples && ["ORDER", "PRODUCTION", "SHIPPING"].includes(phase) ? 14 : 0);
  const templates = await prisma.geoTaskTemplate.findMany({ where: { active: true, recurrence: "ONCE" }, orderBy: { sortOrder: "asc" } });
  let n = 0;
  for (const t of templates) {
    if (!asStrings(t.packages).some((g) => groups.includes(g))) continue;
    const exists = await prisma.geoTask.findFirst({ where: { clientId, templateId: t.id }, select: { id: true } });
    if (exists) continue;
    await prisma.geoTask.create({
      data: {
        clientId,
        templateId: t.id,
        key: t.key,
        title: t.title,
        description: t.description,
        phase: t.phase,
        dueDate: new Date(c.startDate.getTime() + (t.dueDay + shiftFor(t.phase)) * DAY),
        assigneeId: c.assistantId,
        needsApproval: t.needsApproval,
        technical: t.technical,
        note: t.key === "website-code" && card.sitePlatform === "NONE" ? "Stranka nima spletne strani." : null,
      },
    });
    n++;
  }
  return n;
}

/** Monthly and quarterly tasks for every month from the start up to now (idempotent). */
export async function createRecurringTasks(clientId: string, now = new Date()) {
  await ensureGeoTemplates();
  const c = await prisma.geoClient.findUnique({ where: { id: clientId } });
  if (!c || !c.startDate || !GEO_ACTIVE_STATUSES.includes(c.status)) return 0;
  const groups = clientGroups(c);
  const templates = await prisma.geoTaskTemplate.findMany({
    where: { active: true, recurrence: { in: ["MONTHLY", "QUARTERLY"] } },
    orderBy: { sortOrder: "asc" },
  });
  const start = c.startDate;
  const months = Math.max(0, monthsBetween(start, now));
  let n = 0;
  // Only the current month and the previous one (so a late run still catches up), never the whole history.
  for (let k = Math.max(0, months - 1); k <= months; k++) {
    const y = start.getUTCFullYear();
    const m = start.getUTCMonth() + k;
    const first = new Date(Date.UTC(y, m, 1));
    const period = monthKey(first);
    for (const t of templates) {
      if (!asStrings(t.packages).some((g) => groups.includes(g))) continue;
      if (t.recurrence === "QUARTERLY" && (k === 0 || k % 3 !== 0)) continue;
      const due = dayInMonth(first.getUTCFullYear(), first.getUTCMonth(), t.dueDay);
      // The first month only gets what's still ahead of the handover (no tasks born overdue).
      if (due < start || (k === 0 && c.approvedAt && due < new Date(c.approvedAt.getTime() - DAY))) continue;
      if (c.endsAt && due > c.endsAt) continue; // cancelled: nothing after the notice period
      const exists = await prisma.geoTask.findFirst({ where: { clientId, templateId: t.id, period }, select: { id: true } });
      if (exists) continue;
      await prisma.geoTask.create({
        data: {
          clientId,
          templateId: t.id,
          key: t.key,
          period,
          title: t.title,
          description: t.description,
          phase: t.phase,
          dueDate: due,
          assigneeId: c.assistantId,
          needsApproval: t.needsApproval,
          technical: t.technical,
        },
      });
      n++;
    }
  }
  return n;
}

const DEFAULT_ACCESS = ["GOOGLE", "WEBSITE", "BING", "APPLE", "FACEBOOK", "INSTAGRAM"];

export async function ensureAccessRows(clientId: string, industry: string | null, line = "PICKED", details: unknown = {}) {
  const have = await prisma.geoAccess.findMany({ where: { clientId }, select: { platform: true } });
  let want = [...DEFAULT_ACCESS, ...(industry === "RESTAURANT" || industry === "LODGING" || industry === "ACTIVITIES" ? ["TRIPADVISOR"] : [])];
  if (line === "IMPORT") want = [];
  if (line === "UNBUSYNESS") {
    const d = (details || {}) as { bookingChannels?: string[]; guestChannels?: string[] };
    want = [
      ...((d.bookingChannels || []).includes("AIRBNB") ? ["AIRBNB"] : []),
      ...((d.bookingChannels || []).includes("BOOKING") ? ["BOOKING"] : []),
      "PMS",
      ...((d.guestChannels || []).includes("WHATSAPP") ? ["WHATSAPP"] : []),
      ...((d.guestChannels || []).includes("EMAIL") ? ["EMAIL"] : []),
    ];
  }
  const missing = want.filter((p) => !have.some((h) => h.platform === p));
  if (missing.length) await prisma.geoAccess.createMany({ data: missing.map((platform) => ({ clientId, platform })) });
}

// ─── Status machine ───────────────────────────────────────────────────────

/** All tasks of a phase are closed (and there is at least one). */
async function phaseDone(clientId: string, phase: string, emptyCounts = false) {
  const [any, open] = await Promise.all([
    prisma.geoTask.count({ where: { clientId, phase } }),
    prisma.geoTask.count({ where: { clientId, phase, status: { notIn: ["DONE", "NOT_POSSIBLE"] } } }),
  ]);
  return (any > 0 || emptyCounts) && open === 0;
}

async function setStatus(clientId: string, from: string, to: string, by: { id: string; name: string } | null, why?: string) {
  await prisma.geoClient.update({ where: { id: clientId }, data: { status: to, statusAt: new Date() } });
  await geoLog(clientId, by, "STATUS", `${GEO_STATUS_LABEL[from] || from} → ${GEO_STATUS_LABEL[to] || to}${why ? ` (${why})` : ""}`);
}

/** Moves the client forward as far as its conditions allow. Returns the new status. */
export async function advanceGeoClient(clientId: string, by: { id: string; name: string } | null = null): Promise<string> {
  for (let guard = 0; guard < 8; guard++) {
    const c = await prisma.geoClient.findUnique({
      where: { id: clientId },
      include: { accesses: true, measurements: { select: { month: true } } },
    });
    if (!c) return "";
    let next: string | null = null;
    switch (c.status) {
      case "HANDED_OVER":
        if (c.assistantId && missingHandoverFor(c.line, c).length === 0) next = "KICKOFF";
        break;
      case "KICKOFF":
        if (c.line === "PICKED" && missingCardFields(asCard(c.card), c.package).length === 0) next = "ACCESS";
        break;
      case "ACCESS":
        if (c.accesses.some((a) => a.platform === "GOOGLE" && a.status === "APPROVED")) next = "BASELINE";
        break;
      case "BASELINE":
        if (c.measurements.some((m) => m.month === 0)) next = "FIX";
        break;
      case "FIX": {
        const open = await prisma.geoTask.count({
          where: { clientId, phase: "FIX", status: { notIn: ["DONE", "NOT_POSSIBLE"] } },
        });
        const any = await prisma.geoTask.count({ where: { clientId, phase: "FIX" } });
        if (any > 0 && open === 0) next = "MAINTENANCE";
        break;
      }
      case "MAINTENANCE":
        if (!c.day90DoneAt && c.startDate && Date.now() >= c.startDate.getTime() + 90 * DAY) next = "DAY90";
        break;
    }
    // Phase-driven lines (Unbusyness pilots, SimpleImport): move on when the status's phase has no open tasks.
    const step = (PHASE_FLOW[c.line] || []).find(([s]) => s === c.status);
    if (!next && step && (await phaseDone(clientId, step[1], step[1] !== "START"))) next = step[2];
    if (!next) return c.status;
    await setStatus(clientId, c.status, next, by);
    if (next === "DAY90") await notifyAdmins({ type: "GEO", title: `Dan 90: ${c.company}`, body: "Primerjaj z izhodiščem in potrdi.", link: `/izvedba/stranke/${clientId}?tab=meritve` });
  }
  return "";
}

export async function geoAdmins() {
  const rows = await prisma.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } });
  return rows.map((r) => r.id);
}
async function notifyAdmins(n: { type: string; title: string; body?: string; link?: string }) {
  await notify(await geoAdmins(), n);
}

// ─── Card changes → update tasks on every platform ───────────────────────

const NAP_KEYS: (keyof GeoCard)[] = ["legalName", "address", "postalCode", "city", "phone", "website", "hours", "open24h", "holidays"];

export function napChanged(before: GeoCard, after: GeoCard) {
  return NAP_KEYS.filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null));
}

export async function createUpdateTasksForChange(clientId: string, changed: string[]) {
  const c = await prisma.geoClient.findUnique({ where: { id: clientId }, include: { accesses: true } });
  if (!c || !GEO_ACTIVE_STATUSES.includes(c.status)) return 0;
  // Before the fix phase everything is still being set up for the first time.
  if (["KICKOFF", "ACCESS", "BASELINE"].includes(c.status)) return 0;
  const what = changed.join(", ");
  const due = new Date(Date.now() + 3 * DAY);
  let n = 0;
  for (const a of c.accesses.filter((x) => x.status === "APPROVED")) {
    const isSite = a.platform === "WEBSITE";
    await prisma.geoTask.create({
      data: {
        clientId,
        key: isSite ? "website-code" : "card-update",
        title: isSite
          ? "Posodobi kodo na spletni strani (schema, llms.txt, noga) — podatki so se spremenili"
          : `Posodobi podatke: ${GEO_PLATFORM_LABEL[a.platform] || a.platform}`,
        description: `Spremenjeno v kartici: ${what}.`,
        phase: "MONTHLY",
        dueDate: due,
        assigneeId: c.assistantId,
        technical: isSite,
      },
    });
    n++;
  }
  return n;
}

// ─── Daily job ────────────────────────────────────────────────────────────

export async function geoDailyJob(now = new Date()) {
  const out = { tasks: 0, advanced: 0, reminders: 0 };
  const clients = await prisma.geoClient.findMany({ where: { status: { in: GEO_ACTIVE_STATUSES } }, select: { id: true, status: true, endsAt: true } });
  for (const c of clients) {
    out.tasks += await createRecurringTasks(c.id, now);
    const s = await advanceGeoClient(c.id);
    if (s !== c.status) out.advanced++;
  }
  // Cancelled clients: drop open tasks after the notice period.
  await prisma.geoTask.deleteMany({
    where: { status: { in: GEO_OPEN_TASK_STATUSES }, client: { status: "CANCELLED", endsAt: { lt: now } } },
  });

  // "Waiting for the client" for more than ~5 working days → remind the assistant once.
  const stale = await prisma.geoTask.findMany({
    where: { status: "WAITING_CLIENT", remindedAt: null, waitingSince: { lt: new Date(now.getTime() - 7 * DAY) } },
    include: { client: { select: { company: true } } },
  });
  for (const t of stale) {
    await notify([t.assigneeId], {
      type: "GEO",
      title: `Pokliči stranko: ${t.client.company}`,
      body: `Naloga »${t.title}« že več kot teden dni čaka stranko.`,
      link: `/izvedba/stranke/${t.clientId}?tab=naloge`,
    });
    await prisma.geoTask.update({ where: { id: t.id }, data: { remindedAt: now } });
    out.reminders++;
  }

  // Mondays: each assistant gets this week's list; admins get overdue counts.
  if (now.getUTCDay() === 1) {
    const weekEnd = new Date(now.getTime() + 7 * DAY);
    const assistants = await prisma.user.findMany({ where: { role: "GEO", active: true }, select: { id: true } });
    for (const a of assistants) {
      const [due, late] = await Promise.all([
        prisma.geoTask.count({ where: { assigneeId: a.id, status: { in: GEO_OPEN_TASK_STATUSES }, dueDate: { gte: now, lte: weekEnd } } }),
        prisma.geoTask.count({ where: { assigneeId: a.id, status: { in: GEO_OPEN_TASK_STATUSES }, dueDate: { lt: now } } }),
      ]);
      if (due + late > 0)
        await notify([a.id], { type: "GEO", title: `Ta teden: ${due} nalog${late ? `, ${late} zamujenih` : ""}`, link: "/izvedba" });
    }
    const overdue = await prisma.geoTask.count({ where: { status: { in: GEO_OPEN_TASK_STATUSES }, dueDate: { lt: now } } });
    const approvals = await prisma.geoTask.count({ where: { status: "WAITING_APPROVAL" } });
    if (overdue + approvals > 0)
      await notifyAdmins({ type: "GEO", title: `GEO izvedba: ${overdue} zamujenih nalog, ${approvals} čaka potrditev`, link: "/admin/geo" });
  }
  return out;
}
