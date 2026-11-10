import { PDFDocument, StandardFonts, rgb, PDFFont } from "pdf-lib";
import { computeQuoteBreakdown, formatDate, formatMoney } from "@/lib/format";
import { BILLING_LABEL, BILLING_SUFFIX } from "@/lib/constants";

type QuoteForPdf = {
  number: string;
  createdAt: Date;
  validUntil: Date | null;
  discount: number;
  vatRate: number;
  notes: string | null;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    billing: string;
    unitLabel: string | null;
  }[];
  customer: {
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  };
  user: { name: string; email: string; phone: string | null };
};

type CompanyInfo = {
  companyName: string;
  companyAddress: string | null;
  companyEmail: string | null;
  companyPhone: string | null;
};

const MARGIN = 50;
const PAGE_WIDTH = 595.28; // A4 portrait, points
const PAGE_HEIGHT = 841.89;
const INK = rgb(0.059, 0.09, 0.165);
const ACCENT = rgb(0.31, 0.275, 0.898); // matches the app's brand colour
const GREY = rgb(0.42, 0.46, 0.5);
const LIGHT_LINE = rgb(0.87, 0.89, 0.91);
const HEADER_BG = rgb(0.94, 0.94, 0.99);

/**
 * Renders a quote as a clean one-column A4 PDF with pdf-lib (no headless
 * browser needed). Subscription lines show their billing period and the
 * totals are split into one-time / monthly / yearly blocks.
 */
export async function generateQuotePdf(
  quote: QuoteForPdf,
  company: CompanyInfo
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // The built-in PDF fonts only cover Western European characters, so
  // e.g. "č" would crash the render. Map anything unsupported to its plain
  // letter (č → c) or "?" rather than failing.
  const cache = new Map<string, string>();
  const safe = (value: string): string =>
    Array.from(value)
      .map((ch) => {
        if (cache.has(ch)) return cache.get(ch)!;
        let out = ch;
        if (/\s/.test(ch)) out = " ";
        else {
          try {
            font.encodeText(ch);
          } catch {
            const plain = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
            try {
              font.encodeText(plain);
              out = plain || "?";
            } catch {
              out = "?";
            }
          }
        }
        cache.set(ch, out);
        return out;
      })
      .join("");

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const newPageIfNeeded = (heightNeeded: number) => {
    if (y - heightNeeded < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      return true;
    }
    return false;
  };

  const text = (
    value: string,
    x: number,
    size: number,
    opts: { bold?: boolean; color?: ReturnType<typeof rgb>; atY?: number } = {}
  ) => {
    page.drawText(safe(value), {
      x,
      y: opts.atY ?? y,
      size,
      font: opts.bold ? fontBold : font,
      color: opts.color ?? INK,
    });
  };
  const textRight = (
    value: string,
    rightX: number,
    size: number,
    opts: { bold?: boolean; color?: ReturnType<typeof rgb>; atY?: number } = {}
  ) => {
    const f = opts.bold ? fontBold : font;
    const w = f.widthOfTextAtSize(safe(value), size);
    text(value, rightX - w, size, opts);
  };

  // ── Header
  const right = PAGE_WIDTH - MARGIN;
  const headerTop = y;
  text(company.companyName || "Quote", MARGIN, 22, { bold: true, color: ACCENT });
  textRight("QUOTE", right, 22, { bold: true });
  y -= 20;

  const companyLines = [company.companyAddress, company.companyEmail, company.companyPhone].filter(
    Boolean
  ) as string[];
  for (const line of companyLines) {
    text(line, MARGIN, 10, { color: GREY });
    y -= 13;
  }

  const meta = [
    `No. ${quote.number}`,
    `Date: ${formatDate(quote.createdAt)}`,
    ...(quote.validUntil ? [`Valid until: ${formatDate(quote.validUntil)}`] : []),
  ];
  meta.forEach((line, i) => textRight(line, right, 10, { color: GREY, atY: headerTop - 20 - i * 13 }));
  y = Math.min(y, headerTop - 20 - meta.length * 13);

  y -= 14;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: LIGHT_LINE });
  y -= 26;

  // ── Prepared for / by
  const colWidth = (PAGE_WIDTH - MARGIN * 2) / 2;
  text("PREPARED FOR", MARGIN, 9, { bold: true, color: GREY });
  text("PREPARED BY", MARGIN + colWidth, 9, { bold: true, color: GREY });
  y -= 16;

  const customerLines = [
    quote.customer.company || "",
    quote.customer.name,
    quote.customer.email || "",
    quote.customer.phone || "",
  ].filter(Boolean);
  const repLines = [quote.user.name, company.companyName, quote.user.email, quote.user.phone || ""].filter(
    Boolean
  );
  const maxLines = Math.max(customerLines.length, repLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (customerLines[i]) text(customerLines[i], MARGIN, 11, { bold: i === 0 });
    if (repLines[i]) text(repLines[i], MARGIN + colWidth, 11, { bold: i === 0 });
    y -= 15;
  }
  y -= 15;

  // ── Line items
  const col = {
    name: MARGIN + 8,
    qty: right - 230,
    price: right - 180,
    billing: right - 110,
    totalRight: right - 8,
  };

  const drawTableHeader = () => {
    page.drawRectangle({ x: MARGIN, y: y - 6, width: right - MARGIN, height: 22, color: HEADER_BG });
    text("ITEM", col.name, 9, { bold: true, color: GREY });
    text("QTY", col.qty, 9, { bold: true, color: GREY });
    text("PRICE", col.price, 9, { bold: true, color: GREY });
    text("BILLING", col.billing, 9, { bold: true, color: GREY });
    textRight("TOTAL", col.totalRight, 9, { bold: true, color: GREY });
    y -= 26;
  };
  drawTableHeader();

  for (const item of quote.items) {
    const nameLines = wrapText(safe(item.name), font, 10, col.qty - col.name - 12).slice(0, 3);
    const rowHeight = 14 * nameLines.length + (item.unitLabel ? 12 : 0) + 10;
    if (newPageIfNeeded(rowHeight)) drawTableHeader();

    const rowTop = y;
    nameLines.forEach((line, i) => text(line, col.name, 10, { atY: rowTop - i * 14 }));
    if (item.unitLabel) {
      text(item.unitLabel, col.name, 8.5, { color: GREY, atY: rowTop - nameLines.length * 14 + 2 });
    }
    text(String(item.quantity), col.qty, 10, { atY: rowTop });
    text(formatMoney(item.unitPrice), col.price, 10, { atY: rowTop });
    text(BILLING_LABEL[item.billing] || "One-time", col.billing, 10, { atY: rowTop, color: GREY });
    textRight(formatMoney(item.quantity * item.unitPrice), col.totalRight, 10, { bold: true, atY: rowTop });

    y = rowTop - rowHeight + 10;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 0.5, color: LIGHT_LINE });
    y -= 16;
  }

  // ── Totals (one block per billing period)
  const breakdown = computeQuoteBreakdown(quote.items, quote.discount, quote.vatRate);
  const totalsX = right - 230;

  const totalsRow = (label: string, value: string, opts: { bold?: boolean } = {}) => {
    text(label, totalsX, 10.5, { color: opts.bold ? INK : GREY, bold: opts.bold });
    textRight(value, right, 10.5, { bold: opts.bold });
    y -= 16;
  };

  for (const g of breakdown.groups) {
    newPageIfNeeded(110);
    y -= 6;
    if (breakdown.groups.length > 1 || g.billing !== "ONE_TIME") {
      text(`${(BILLING_LABEL[g.billing] || "").toUpperCase()} CHARGES`, totalsX, 9, {
        bold: true,
        color: ACCENT,
      });
      y -= 15;
    }
    const suffix = BILLING_SUFFIX[g.billing] || "";
    totalsRow("Subtotal", formatMoney(g.subtotal) + suffix);
    if (quote.discount > 0) {
      totalsRow(`Discount (${quote.discount}%)`, `-${formatMoney(g.discountAmount)}${suffix}`);
    }
    totalsRow(`VAT (${quote.vatRate}%)`, formatMoney(g.vatAmount) + suffix);
    page.drawLine({
      start: { x: totalsX, y: y + 6 },
      end: { x: right, y: y + 6 },
      thickness: 1,
      color: LIGHT_LINE,
    });
    y -= 4;
    totalsRow("Total", formatMoney(g.total) + suffix, { bold: true });
    y -= 6;
  }

  if (breakdown.groups.some((g) => g.billing !== "ONE_TIME")) {
    newPageIfNeeded(30);
    text(
      `First-year value (excl. VAT): ${formatMoney(breakdown.annualNet)}`,
      totalsX,
      9.5,
      { color: GREY }
    );
    y -= 16;
  }

  // ── Notes
  if (quote.notes) {
    y -= 16;
    newPageIfNeeded(34);
    text("NOTES & TERMS", MARGIN, 9, { bold: true, color: GREY });
    y -= 16;
    for (const paragraph of quote.notes.split("\n")) {
      for (const line of wrapText(safe(paragraph), font, 10, right - MARGIN)) {
        newPageIfNeeded(16);
        text(line, MARGIN, 10, { color: GREY });
        y -= 14;
      }
    }
  }

  return pdfDoc.save();
}

function wrapText(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}
