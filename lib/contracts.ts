import { isPickedQuote, PICKED_CONTRACT_TEMPLATE } from "@/lib/contract-picked";
import { createHash, randomBytes, randomInt } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { computeQuoteBreakdown, formatDate, formatMoney } from "@/lib/format";
import type { CurrentUser } from "@/lib/session";
import { getManagedSellerIds } from "@/lib/access";

/**
 * Contracts: a quote becomes a contract, a manager/admin reviews it, the
 * client signs online with a code sent to their e-mail, and a proforma
 * invoice (predračun) with a UPN QR code is issued straight away.
 */

export const CONTRACT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  IN_REVIEW: "Waiting for review",
  APPROVED: "Approved — ready to send",
  SENT: "Sent for signature",
  SIGNED: "Signed",
  CANCELLED: "Cancelled",
};

const BILLING_SL: Record<string, string> = { ONE_TIME: "enkratno", MONTHLY: "mesečno", YEARLY: "letno" };
const BILLING_SUFFIX_SL: Record<string, string> = { ONE_TIME: "", MONTHLY: " / mesec", YEARLY: " / leto" };

export const MISSING = "[manjka:";

/** The built-in contract text. {{placeholders}} are filled from the quote, the client and Settings. */
export const DEFAULT_CONTRACT_TEMPLATE = `POGODBA O NAROČILU STORITEV št. {{stevilka}}

sklenjena med:

{{izvajalec_naziv}}, {{izvajalec_naslov}}, matična številka: {{izvajalec_maticna}}, {{izvajalec_davcna}}, ki ga zastopa {{izvajalec_zastopnik}}
(v nadaljevanju: izvajalec)

in

{{narocnik_naziv}}, {{narocnik_naslov}}, matična številka: {{narocnik_maticna}}, davčna številka / ID za DDV: {{narocnik_ddv}}, ki ga zastopa {{narocnik_zastopnik}}
(v nadaljevanju: naročnik)

1. PREDMET POGODBE

1.1 Izvajalec se zavezuje, da bo za naročnika izvajal naslednje storitve (v nadaljevanju: storitve):
{{storitve}}

1.2 Obseg posameznega paketa je podrobneje opisan v ponudbi št. {{ponudba}}, ki je sestavni del te pogodbe.

2. CENA IN PLAČILNI POGOJI

2.1 Cena storitev:
{{cene}}

2.2 {{ddv_klavzula}}

2.3 Mesečne storitve se obračunavajo vnaprej za tekoči mesec, enkratne storitve ob začetku izvajanja.

2.4 Izvajalec po podpisu pogodbe izda predračun, ki ga naročnik poravna v {{rok_placila}} dneh. Izvajanje storitev se začne po prejemu plačila.

2.5 Pri zamudi s plačilom lahko izvajalec po predhodnem pisnem opozorilu začasno ustavi izvajanje storitev do poravnave dolga in zaračuna zakonske zamudne obresti.

3. TRAJANJE IN ODPOVED

3.1 Pogodba začne veljati z dnem podpisa in je sklenjena za nedoločen čas.

3.2 Vsaka stranka lahko pogodbo pisno (tudi po e-pošti) odpove z odpovednim rokom 30 dni. Že plačane storitve za tekoče obdobje se ne vračajo.

3.3 Vsaka stranka lahko pogodbo odpove brez odpovednega roka, če druga stranka huje krši pogodbo in kršitve ne odpravi v 15 dneh po pisnem opozorilu.

4. OBVEZNOSTI STRANK

4.1 Izvajalec bo storitve opravljal skrbno, strokovno in v dogovorjenih rokih.

4.2 Naročnik bo izvajalcu pravočasno posredoval podatke, gradiva in dostope (npr. do Google profila, spletne strani in družbenih omrežij), ki so potrebni za izvajanje storitev, in jamči, da ima pravico do njihove uporabe.

4.3 Vsebine, ki se objavijo v imenu naročnika, naročnik pred objavo odobri, razen če se stranki dogovorita drugače.

5. REZULTATI IN ODGOVORNOST

5.1 Prikaz in razvrščanje vsebin pri tretjih ponudnikih (npr. Google, OpenAI, Meta) samostojno določajo ti ponudniki, zato izvajalec zanje ne jamči. Morebitna posebna jamstva veljajo le, če so izrecno navedena v ponudbi.

5.2 Odgovornost izvajalca za škodo je omejena na znesek, ki ga je naročnik plačal v zadnjih treh mesecih, razen pri naklepu ali hudi malomarnosti.

6. ZAUPNOST IN VARSTVO PODATKOV

6.1 Stranki kot poslovno skrivnost varujeta vse podatke, ki jih izvesta pri izvajanju pogodbe.

6.2 Kadar izvajalec za naročnika obdeluje osebne podatke, to počne v skladu s Splošno uredbo o varstvu podatkov (GDPR) in ZVOP-2 ter le za namen izvajanja te pogodbe. Če je potrebno, stranki skleneta pogodbo o obdelavi osebnih podatkov.

7. AVTORSKE PRAVICE

7.1 Vsebine, ki jih izvajalec pripravi posebej za naročnika (besedila, videi, objave), lahko naročnik po plačilu neomejeno uporablja. Programska oprema, orodja in predloge izvajalca ostanejo last izvajalca.

8. KONČNE DOLOČBE

8.1 Za vprašanja, ki jih ta pogodba ne ureja, se uporablja Obligacijski zakonik.

8.2 Spremembe in dopolnitve pogodbe veljajo le v pisni obliki, ki vključuje tudi elektronsko obliko.

8.3 Morebitne spore stranki rešujeta sporazumno, sicer je pristojno stvarno pristojno sodišče v Ljubljani.

8.4 Pogodba je sklenjena v elektronski obliki. Naročnik jo podpiše elektronsko, s potrditvijo kode, poslane na njegov e-naslov. Stranki se strinjata, da je tak podpis zanju veljaven in zavezujoč. Vsaka stranka prejme izvod pogodbe v obliki PDF.
{{opombe}}
Ljubljana, {{datum}}

Za izvajalca: {{izvajalec_zastopnik}}
Za naročnika: {{narocnik_zastopnik}}`;

type QuoteForContract = {
  number: string;
  discount: number;
  vatRate: number;
  notes: string | null;
  items: { name: string; quantity: number; unitPrice: number; billing: string; unitLabel: string | null }[];
};

export type ContractParties = {
  clientCompany: string | null;
  clientAddress: string | null;
  clientRegNo: string | null;
  clientVatId: string | null;
  clientRepresentative: string | null;
};

const miss = (label: string) => `${MISSING} ${label}]`;

/** Fills the template. Missing company/client data shows as "[manjka: …]" so it can't slip out unnoticed. */
export async function buildContractBody(number: string, quote: QuoteForContract, parties: ContractParties) {
  const s = await getSettings();
  const factor = 1 - quote.discount / 100;
  const vatPayer = s.legalVatPayer;
  const plusVat = vatPayer ? " + DDV" : "";
  const services = quote.items
    .map((i) => {
      const qty = i.quantity !== 1 ? `${i.quantity} × ` : "";
      return `– ${qty}${i.name}${i.unitLabel ? ` (${i.unitLabel})` : ""}: ${formatMoney(i.unitPrice * factor)}${BILLING_SUFFIX_SL[i.billing] || ""}${plusVat}`;
    })
    .join("\n");
  const b = computeQuoteBreakdown(quote.items, quote.discount, vatPayer ? quote.vatRate : 0);
  const prices = b.groups
    .map((g) =>
      vatPayer
        ? `– ${BILLING_SL[g.billing] || g.billing}: ${formatMoney(g.taxable)} + DDV (${formatMoney(g.total)} z DDV)`
        : `– ${BILLING_SL[g.billing] || g.billing}: ${formatMoney(g.taxable)}`
    )
    .join("\n");

  const values: Record<string, string> = {
    stevilka: number,
    datum: formatDate(new Date()),
    ponudba: quote.number,
    izvajalec_naziv: s.legalName || miss("naziv izvajalca"),
    izvajalec_naslov: s.legalAddress || miss("naslov izvajalca"),
    izvajalec_maticna: s.legalRegNo || miss("matična številka izvajalca"),
    izvajalec_davcna: vatPayer
      ? `ID za DDV: ${s.legalVatId || miss("ID za DDV izvajalca")}`
      : `davčna številka: ${s.legalTaxNo || miss("davčna številka izvajalca")}`,
    ddv_klavzula: vatPayer
      ? "Vse cene so navedene brez DDV. DDV se obračuna po veljavni stopnji."
      : "Izvajalec ni zavezanec za DDV. DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1.",
    izvajalec_zastopnik: s.legalRepresentative || miss("zastopnik izvajalca"),
    narocnik_naziv: parties.clientCompany || miss("naziv naročnika"),
    narocnik_naslov: parties.clientAddress || miss("naslov naročnika"),
    narocnik_maticna: parties.clientRegNo || miss("matična številka naročnika"),
    narocnik_ddv: parties.clientVatId || "/",
    narocnik_zastopnik: parties.clientRepresentative || miss("zastopnik naročnika"),
    storitve: services || miss("storitve"),
    cene: prices || miss("cene"),
    rok_placila: String(s.proformaDueDays || 8),
    opombe: quote.notes?.trim() ? `\n9. POSEBNI DOGOVORI\n\n${quote.notes.trim()}\n` : "",
  };
  const picked = isPickedQuote(quote.items);
  if (values.opombe && picked) values.opombe = values.opombe.replace("\n9. POSEBNI DOGOVORI", "\n11. POSEBNI DOGOVORI");
  const template = picked
    ? s.contractTemplatePicked?.trim() || PICKED_CONTRACT_TEMPLATE
    : s.contractTemplate?.trim() || DEFAULT_CONTRACT_TEMPLATE;
  return template.replace(/{{\s*(\w+)\s*}}/g, (m, k) => (k in values ? values[k] : m));
}

/** What still has to be filled in before the contract can go out. */
export function contractProblems(c: { body: string; clientEmail: string | null }): string[] {
  const problems: string[] = [];
  const missing = Array.from(c.body.matchAll(/\[manjka:\s*([^\]]+)\]/g)).map((m) => m[1].trim());
  if (missing.length) problems.push(`Missing in the text: ${Array.from(new Set(missing)).join(", ")}`);
  if (/{{\s*\w+\s*}}/.test(c.body)) problems.push("The text still has an unfilled {{placeholder}}.");
  if (!c.clientEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.clientEmail)) problems.push("Add the client's e-mail for signing.");
  return problems;
}

async function lastNumber(prefix: string, field: "number" | "proformaNumber") {
  if (field === "number") {
    const r = await prisma.contract.findFirst({ where: { number: { startsWith: prefix } }, orderBy: { number: "desc" }, select: { number: true } });
    return r?.number ?? null;
  }
  const r = await prisma.contract.findFirst({
    where: { proformaNumber: { startsWith: prefix } },
    orderBy: { proformaNumber: "desc" },
    select: { proformaNumber: true },
  });
  return r?.proformaNumber ?? null;
}

async function nextNumber(prefix: string, field: "number" | "proformaNumber") {
  const start = `${prefix}-${new Date().getFullYear()}-`;
  const last = await lastNumber(start, field);
  const lastNo = last ? Number(last.slice(start.length)) || 0 : 0;
  return `${start}${String(lastNo + 1).padStart(4, "0")}`;
}

export const nextContractNumber = () => nextNumber("POG", "number");
export const nextProformaNumber = () => nextNumber("PR", "proformaNumber");

/** Who may open / edit a contract: its seller, the seller's manager, any admin. */
export async function canSeeContract(user: CurrentUser, contract: { userId: string }) {
  if (user.role === "ADMIN" || contract.userId === user.id) return true;
  if (user.role === "MANAGER") return (await getManagedSellerIds(user)).includes(contract.userId);
  return false;
}

export function newPublicToken() {
  return randomBytes(24).toString("base64url");
}

export function newSigningCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashCode(contractId: string, code: string) {
  return createHash("sha256").update(`${contractId}:${code}`).digest("hex");
}

export function hashDocument(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** What the client pays on the proforma: one-time lines, the first month, the first year of yearly lines — with VAT (if the company charges VAT). */
export function proformaLines(quote: QuoteForContract, vatPayer: boolean) {
  const factor = 1 - quote.discount / 100;
  const lines = quote.items.map((i) => {
    const net = i.quantity * i.unitPrice * factor;
    const period = i.billing === "MONTHLY" ? " — 1. mesec" : i.billing === "YEARLY" ? " — 1. leto" : "";
    return { name: `${i.name}${period}`, quantity: i.quantity, unitNet: i.unitPrice * factor, net };
  });
  const net = lines.reduce((s, l) => s + l.net, 0);
  const vatRate = vatPayer ? quote.vatRate : 0;
  const vat = net * (vatRate / 100);
  return { lines, net, vat, total: net + vat, vatRate };
}

/** Payment reference in the SI00 model, from the proforma number (PR-2026-0007 → SI00 2026-0007). */
export function paymentReferenceFor(proformaNumber: string) {
  return `SI00 ${proformaNumber.replace(/^PR-/, "")}`;
}

// ─── UPN QR (Slovenian payment slip QR code, ZBS standard) ──────────────

const ISO_8859_2: Record<string, number> = {
  Č: 0xc8, č: 0xe8, Š: 0xa9, š: 0xb9, Ž: 0xae, ž: 0xbe, Ć: 0xc6, ć: 0xe6, Đ: 0xd0, đ: 0xf0,
};

function latin2(text: string): number[] {
  return Array.from(text).map((ch) => {
    if (ISO_8859_2[ch]) return ISO_8859_2[ch];
    const c = ch.charCodeAt(0);
    if (c >= 0x20 && c < 0x7f) return c;
    if (ch === "\n") return 0x0a;
    const plain = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    const p = plain.charCodeAt(0);
    return p >= 0x20 && p < 0x7f ? p : 0x3f;
  });
}

/** The UPN QR payload as ISO-8859-2 bytes (19 fields + control sum), or null when the IBAN is missing. */
export function upnQrBytes(p: {
  payerName: string;
  payerStreet: string;
  payerCity: string;
  amount: number;
  purpose: string;
  dueDate: Date;
  iban: string | null;
  reference: string;
  recipientName: string;
  recipientStreet: string;
  recipientCity: string;
}): Uint8Array | null {
  if (!p.iban) return null;
  const cut = (v: string, n: number) => v.replace(/\s+/g, " ").trim().slice(0, n);
  const d = p.dueDate;
  const due = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  const fields = [
    "UPNQR",
    "",
    "",
    "",
    "",
    cut(p.payerName, 33),
    cut(p.payerStreet, 33),
    cut(p.payerCity, 33),
    String(Math.round(p.amount * 100)).padStart(11, "0"),
    "",
    "",
    "OTHR",
    cut(p.purpose, 42),
    due,
    p.iban.replace(/\s+/g, "").toUpperCase(),
    p.reference.replace(/\s+/g, "").toUpperCase(),
    cut(p.recipientName, 33),
    cut(p.recipientStreet, 33),
    cut(p.recipientCity, 33),
  ];
  const body = fields.join("\n") + "\n";
  const control = String(body.length).padStart(3, "0");
  return new Uint8Array(latin2(body + control + "\n"));
}

/** Splits "Street 1, 1000 Ljubljana" into street and post/city. */
export function splitAddress(address: string | null | undefined) {
  const a = (address || "").trim();
  const i = a.lastIndexOf(",");
  if (i < 0) return { street: a, city: "" };
  return { street: a.slice(0, i).trim(), city: a.slice(i + 1).trim() };
}
