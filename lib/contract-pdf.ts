import path from "path";
import { readFile } from "fs/promises";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { formatDate, formatMoney } from "@/lib/format";
import { proformaLines, splitAddress, upnQrBytes } from "@/lib/contracts";

/**
 * Contract and proforma (predračun) PDFs. A Unicode font is embedded so
 * Slovenian letters (č, š, ž) come out right.
 */

const W = 595.28;
const H = 841.89;
const M = 56;
const INK = rgb(0.07, 0.09, 0.15);
const GREY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.86, 0.88, 0.9);

async function setup() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const dir = path.join(process.cwd(), "lib", "fonts");
  const [reg, bold] = await Promise.all([readFile(path.join(dir, "DejaVuSans.ttf")), readFile(path.join(dir, "DejaVuSans-Bold.ttf"))]);
  const font = await doc.embedFont(reg, { subset: true });
  const fontBold = await doc.embedFont(bold, { subset: true });
  return { doc, font, fontBold };
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of text.replace(/\t/g, "  ").split("\n")) {
    if (!para.trim()) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) out.push(line);
        // Very long words (URLs) are cut to fit.
        let w = word;
        while (font.widthOfTextAtSize(w, size) > width) {
          let i = w.length;
          while (i > 1 && font.widthOfTextAtSize(w.slice(0, i), size) > width) i--;
          out.push(w.slice(0, i));
          w = w.slice(i);
        }
        line = w;
      }
    }
    out.push(line);
  }
  return out;
}

class Writer {
  page: PDFPage;
  y = H - M;
  pageNo = 1;
  constructor(public doc: PDFDocument, public font: PDFFont, public bold: PDFFont, public footer: string) {
    this.page = this.newPage();
  }
  newPage() {
    const p = this.doc.addPage([W, H]);
    p.drawText(this.footer, { x: M, y: 28, size: 7.5, font: this.font, color: GREY });
    p.drawText(String(this.doc.getPageCount()), { x: W - M - 10, y: 28, size: 7.5, font: this.font, color: GREY });
    this.page = p;
    this.y = H - M;
    return p;
  }
  need(h: number) {
    if (this.y - h < M) this.newPage();
  }
  text(t: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) {
    const size = opts.size ?? 9.5;
    const f = opts.bold ? this.bold : this.font;
    const lh = size * 1.42;
    for (const l of wrap(t, f, size, opts.width ?? W - 2 * M)) {
      this.need(lh);
      if (l) this.page.drawText(l, { x: opts.x ?? M, y: this.y - size, size, font: f, color: opts.color ?? INK });
      this.y -= lh;
    }
    this.y -= opts.gap ?? 0;
  }
  rule(gap = 8) {
    this.need(gap * 2);
    this.y -= gap;
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.7, color: LINE });
    this.y -= gap;
  }
}

type ContractForPdf = {
  number: string;
  title: string;
  body: string;
  status: string;
  signedName: string | null;
  signedTitle: string | null;
  signedEmail: string | null;
  signedAt: Date | null;
  signedIp: string | null;
  documentHash: string | null;
  reviewedAt: Date | null;
  reviewedBy?: { name: string } | null;
  sentAt: Date | null;
};

type Company = { legalName: string; legalRepresentative: string | null };

export async function renderContractPdf(c: ContractForPdf, company: Company): Promise<Uint8Array> {
  const { doc, font, fontBold } = await setup();
  doc.setTitle(`${c.title} ${c.number}`);
  const w = new Writer(doc, font, fontBold, `${company.legalName} · ${c.number}${c.signedAt ? " · elektronsko podpisano" : ""}`);

  // The body's first line is the heading.
  const [first, ...rest] = c.body.split("\n");
  w.text(first, { size: 14, bold: true, gap: 10 });
  for (const line of rest) {
    const heading = /^\d+\.\s+[A-ZČŠŽ ]{3,}$/.test(line.trim());
    if (heading) w.y -= 4;
    w.text(line, { bold: heading, size: heading ? 10 : 9.5 });
  }

  // Signatures / audit trail
  w.rule(14);
  w.need(150);
  w.text("Podpisi in potrditve", { bold: true, size: 10.5, gap: 4 });
  w.text(
    `Za izvajalca (${company.legalName}): ${company.legalRepresentative || "—"}` +
      (c.reviewedAt ? ` — pogodba odobrena ${formatDate(c.reviewedAt)}${c.reviewedBy ? ` (${c.reviewedBy.name})` : ""}` : "") +
      (c.sentAt ? `, poslana v podpis ${formatDate(c.sentAt)}` : ""),
    { size: 9 }
  );
  if (c.signedAt) {
    w.text(
      `Za naročnika: ${c.signedName}${c.signedTitle ? `, ${c.signedTitle}` : ""} — elektronsko podpisal(a) ${c.signedAt.toLocaleString("sl-SI", { timeZone: "Europe/Ljubljana" })}`,
      { size: 9 }
    );
    w.text(
      `Način podpisa: potrditev s 6-mestno kodo, poslano na ${c.signedEmail}. IP: ${c.signedIp || "—"}. Odtis dokumenta (SHA-256): ${c.documentHash}`,
      { size: 7.5, color: GREY }
    );
  } else {
    w.text("Za naročnika: ________________________ (še ni podpisano)", { size: 9 });
  }
  return doc.save();
}

type ProformaInput = {
  proformaNumber: string;
  proformaIssuedAt: Date;
  proformaDueAt: Date;
  paymentReference: string;
  paymentLinkUrl: string | null;
  contractNumber: string;
  client: { company: string; address: string | null; regNo: string | null; vatId: string | null };
  quote: {
    number: string;
    discount: number;
    vatRate: number;
    notes: string | null;
    items: { name: string; quantity: number; unitPrice: number; billing: string; unitLabel: string | null }[];
  };
};

type CompanyFull = {
  legalName: string;
  legalAddress: string | null;
  legalRegNo: string | null;
  legalTaxNo: string | null;
  legalVatId: string | null;
  legalVatPayer: boolean;
  legalIban: string | null;
  legalBic: string | null;
  legalBank: string | null;
  legalEmail: string | null;
};

export async function renderProformaPdf(p: ProformaInput, s: CompanyFull): Promise<Uint8Array> {
  const { doc, font, fontBold } = await setup();
  doc.setTitle(`Predračun ${p.proformaNumber}`);
  const w = new Writer(doc, font, fontBold, `${s.legalName} · predračun ${p.proformaNumber}`);
  const pf = proformaLines(p.quote, s.legalVatPayer);

  // Header: seller left, title right
  const top = w.y;
  w.text(s.legalName, { bold: true, size: 12 });
  w.text(
    [
      s.legalAddress,
      s.legalRegNo ? `Matična št.: ${s.legalRegNo}` : null,
      s.legalVatPayer ? (s.legalVatId ? `ID za DDV: ${s.legalVatId}` : null) : s.legalTaxNo ? `Davčna št.: ${s.legalTaxNo}` : null,
      s.legalEmail,
    ]
      .filter(Boolean)
      .join("\n"),
    { size: 8.5, color: GREY, width: 260 }
  );
  const leftBottom = w.y;
  w.y = top;
  w.text("PREDRAČUN", { bold: true, size: 18, x: 360, width: 180 });
  w.text(
    `Št.: ${p.proformaNumber}\nDatum: ${formatDate(p.proformaIssuedAt)}\nRok plačila: ${formatDate(p.proformaDueAt)}\nPogodba: ${p.contractNumber}`,
    { size: 9, x: 360, width: 180 }
  );
  w.y = Math.min(w.y, leftBottom) - 14;

  w.text("Naročnik", { size: 8, color: GREY });
  w.text(
    [p.client.company, p.client.address, p.client.regNo ? `Matična št.: ${p.client.regNo}` : null, p.client.vatId ? `Davčna št. / ID za DDV: ${p.client.vatId}` : null]
      .filter(Boolean)
      .join("\n"),
    { size: 9.5, gap: 8 }
  );

  // Lines
  w.rule(6);
  const cols = { name: M, qty: 360, price: 410, total: W - M };
  const head = w.y;
  w.page.drawText("Storitev", { x: cols.name, y: head - 8, size: 8, font: fontBold, color: GREY });
  w.page.drawText("Kol.", { x: cols.qty, y: head - 8, size: 8, font: fontBold, color: GREY });
  w.page.drawText("Cena", { x: cols.price, y: head - 8, size: 8, font: fontBold, color: GREY });
  const tw = fontBold.widthOfTextAtSize("Znesek", 8);
  w.page.drawText("Znesek", { x: cols.total - tw, y: head - 8, size: 8, font: fontBold, color: GREY });
  w.y -= 16;
  for (const l of pf.lines) {
    const nameLines = wrap(l.name, font, 9, cols.qty - cols.name - 10);
    w.need(nameLines.length * 13 + 4);
    const y0 = w.y;
    nameLines.forEach((t, i) => w.page.drawText(t, { x: cols.name, y: y0 - 9 - i * 13, size: 9, font, color: INK }));
    w.page.drawText(String(l.quantity), { x: cols.qty, y: y0 - 9, size: 9, font, color: INK });
    w.page.drawText(formatMoney(l.unitNet), { x: cols.price, y: y0 - 9, size: 9, font, color: INK });
    const amt = formatMoney(l.net);
    w.page.drawText(amt, { x: cols.total - font.widthOfTextAtSize(amt, 9), y: y0 - 9, size: 9, font, color: INK });
    w.y -= nameLines.length * 13 + 4;
  }
  w.rule(6);
  const sumRow = (label: string, value: string, bold = false) => {
    w.need(16);
    const f = bold ? fontBold : font;
    const size = bold ? 11 : 9;
    w.page.drawText(label, { x: cols.price - 60, y: w.y - size, size, font: f, color: INK });
    w.page.drawText(value, { x: cols.total - f.widthOfTextAtSize(value, size), y: w.y - size, size, font: f, color: INK });
    w.y -= size + 7;
  };
  if (s.legalVatPayer) {
    sumRow("Osnova", formatMoney(pf.net));
    sumRow(`DDV ${pf.vatRate} %`, formatMoney(pf.vat));
  }
  sumRow("Za plačilo", formatMoney(pf.total), true);
  w.y -= 6;
  if (!s.legalVatPayer) w.text("DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1.", { size: 8.5, color: GREY });
  w.text("Mesečne storitve se v nadaljevanju obračunavajo mesečno vnaprej. Predračun ni račun; račun izdamo po prejemu plačila.", {
    size: 8.5,
    color: GREY,
    gap: 10,
  });

  // Payment block with UPN QR
  w.need(170);
  w.rule(4);
  const blockTop = w.y;
  w.text("Plačilo", { bold: true, size: 10.5, gap: 2 });
  const { street, city } = splitAddress(s.legalAddress);
  w.text(
    [
      `Prejemnik: ${s.legalName}`,
      `IBAN: ${s.legalIban || "—"}${s.legalBic ? `   BIC: ${s.legalBic}` : ""}`,
      s.legalBank ? `Banka: ${s.legalBank}` : null,
      `Referenca: ${p.paymentReference}`,
      `Namen: Predračun ${p.proformaNumber}`,
      `Znesek: ${formatMoney(pf.total)}`,
      `Rok plačila: ${formatDate(p.proformaDueAt)}`,
    ]
      .filter(Boolean)
      .join("\n"),
    { size: 9, width: 330 }
  );
  if (p.paymentLinkUrl) w.text(`Plačilo s kartico ali SEPA bremenitvijo: ${p.paymentLinkUrl}`, { size: 8.5, width: 330 });

  const payer = splitAddress(p.client.address);
  const qr = upnQrBytes({
    payerName: p.client.company,
    payerStreet: payer.street,
    payerCity: payer.city,
    amount: pf.total,
    purpose: `Predracun ${p.proformaNumber}`,
    dueDate: p.proformaDueAt,
    iban: s.legalIban,
    reference: p.paymentReference,
    recipientName: s.legalName,
    recipientStreet: street,
    recipientCity: city,
  });
  if (qr) {
    const png = await QRCode.toBuffer([{ data: qr, mode: "byte" }] as any, {
      errorCorrectionLevel: "M",
      version: 15,
      margin: 1,
      scale: 4,
    });
    const img = await doc.embedPng(png);
    const size = 130;
    w.page.drawImage(img, { x: W - M - size, y: blockTop - size - 6, width: size, height: size });
    w.page.drawText("UPN QR — skenirajte v mobilni banki", {
      x: W - M - size,
      y: blockTop - size - 16,
      size: 7,
      font,
      color: GREY,
    });
    w.y = Math.min(w.y, blockTop - size - 24);
  }
  return doc.save();
}
