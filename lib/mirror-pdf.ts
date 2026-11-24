import path from "path";
import { readFile } from "fs/promises";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { MirrorAnswer, MirrorSummary } from "@/lib/ai-mirror";

/** Client-facing AI Mirror report (A4, Slovenian). */

const W = 595.28;
const H = 841.89;
const M = 50;
const INK = rgb(0.07, 0.09, 0.15);
const GREY = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.88, 0.89, 0.91);
const GREEN = rgb(0.02, 0.5, 0.3);
const RED = rgb(0.8, 0.15, 0.2);
const AMBER = rgb(0.75, 0.45, 0.02);
const ACCENT = rgb(0.31, 0.275, 0.898);

// Keep only characters the embedded font can draw (Latin incl. č š ž, punctuation, €).
const clean = (s: string) =>
  String(s || "")
    .replace(/\*\*/g, "")
    .replace(/[^\u0009\u000A -ɏ‐-…€]/g, "")
    .trim();

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const word of para.split(/ +/)) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width) line = next;
      else {
        if (line) out.push(line);
        line = word;
      }
    }
    out.push(line);
  }
  return out;
}

export type MirrorPdfInput = {
  company: string;
  city: string;
  category: string;
  kind: string;
  createdAt: Date;
  score: number | null;
  mentions: number | null;
  answersCount: number | null;
  answers: MirrorAnswer[];
  summary: MirrorSummary;
  seller: { name: string; email: string; phone: string | null } | null;
  brand: string; // e.g. "Mr. Picked"
  companyName: string;
};

export async function renderMirrorPdf(r: MirrorPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const dir = path.join(process.cwd(), "lib", "fonts");
  const [reg, bold] = await Promise.all([readFile(path.join(dir, "DejaVuSans.ttf")), readFile(path.join(dir, "DejaVuSans-Bold.ttf"))]);
  const font = await doc.embedFont(reg, { subset: true });
  const fontBold = await doc.embedFont(bold, { subset: true });
  doc.setTitle(`AI vidnost — ${clean(r.company)}`);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H - M;
  const newPage = () => {
    page = doc.addPage([W, H]);
    y = H - M;
  };
  const need = (h: number) => {
    if (y - h < M + 30) newPage();
  };
  const text = (t: string, x: number, size = 10, f = font, color = INK) => page.drawText(clean(t), { x, y, size, font: f, color });
  const para = (t: string, size = 10, color = INK, x = M, width = W - 2 * M, f = font) => {
    for (const l of wrap(t, f, size, width)) {
      need(size + 5);
      page.drawText(l, { x, y, size, font: f, color });
      y -= size + 5;
    }
  };
  const heading = (t: string) => {
    need(40);
    y -= 10;
    text(t, M, 13, fontBold);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.7, color: LINE });
    y -= 16;
  };

  // Header
  text(r.brand.toUpperCase(), M, 9, fontBold, ACCENT);
  page.drawText(r.createdAt.toLocaleDateString("sl-SI"), { x: W - M - font.widthOfTextAtSize(r.createdAt.toLocaleDateString("sl-SI"), 9), y, size: 9, font, color: GREY });
  y -= 30;
  text("Kako vas vidijo AI asistenti", M, 22, fontBold);
  y -= 22;
  text(`${r.company}, ${r.city}`, M, 13, font, GREY);
  y -= 34;

  // Score block
  const score = r.score ?? 0;
  const tone = score >= 50 ? GREEN : score >= 20 ? AMBER : RED;
  text(`${score.toLocaleString("sl-SI")} %`, M, 40, fontBold, tone);
  const ex = M + fontBold.widthOfTextAtSize(`${score.toLocaleString("sl-SI")} %`, 40) + 18;
  page.drawText("AI vidnost", { x: ex, y: y + 22, size: 11, font: fontBold, color: INK });
  for (const [i, l] of wrap(
    `Ko smo ChatGPT in Gemini vprašali po ponudnikih za »${r.category}« v kraju ${r.city}, sta vas omenila v ${r.mentions ?? 0} od ${r.answersCount ?? 0} odgovorov.`,
    font,
    10,
    W - M - ex
  ).entries())
    page.drawText(l, { x: ex, y: y + 6 - i * 14, size: 10, font, color: GREY });
  y -= 44;

  // Per engine
  const engines = Array.from(new Set(r.answers.map((a) => a.engine)));
  const label = (e: string) => (e === "chatgpt" ? "ChatGPT" : "Gemini");
  const disc = r.answers.filter((a) => a.kind === "discovery" && !a.error);
  let x = M;
  for (const e of engines) {
    const d = disc.filter((a) => a.engine === e);
    const hits = d.filter((a) => a.mentioned);
    const best = hits.map((a) => a.position).filter((p): p is number => !!p).sort((a, b) => a - b)[0];
    const known = r.summary.brand?.[e as "chatgpt" | "gemini"];
    page.drawRectangle({ x, y: y - 46, width: (W - 2 * M - 12) / 2, height: 58, borderColor: LINE, borderWidth: 0.8 });
    page.drawText(label(e), { x: x + 12, y: y - 6, size: 11, font: fontBold, color: INK });
    page.drawText(clean(`Omenjeni v ${hits.length} od ${d.length} odgovorov${best ? ` · najvišje ${best}. mesto` : ""}`), { x: x + 12, y: y - 22, size: 9.5, font, color: INK });
    if (known)
      page.drawText(known === "known" ? "Vaše podjetje pozna pravilno" : known === "wrong" ? "O vas navaja napačne podatke" : "Vašega podjetja ne pozna", {
        x: x + 12,
        y: y - 37,
        size: 9,
        font,
        color: known === "known" ? GREEN : known === "wrong" ? AMBER : RED,
      });
    x += (W - 2 * M + 12) / 2;
  }
  y -= 70;

  if (r.summary.summary) {
    heading("Povzetek");
    para(r.summary.summary.replace(/prodajalc\w*/gi, "vas"), 10.5);
  }

  // Questions table
  heading("Kaj smo vprašali in kaj sta odgovorila");
  const qs = Array.from(new Set(r.answers.map((a) => a.q)));
  const colQ = W - 2 * M - 2 * 92;
  need(20);
  text("Vprašanje", M, 8.5, fontBold, GREY);
  engines.forEach((e, i) => text(label(e), M + colQ + 10 + i * 92, 8.5, fontBold, GREY));
  y -= 14;
  for (const q of qs) {
    const lines = wrap(q, font, 9, colQ);
    need(lines.length * 12 + 8);
    const top = y;
    for (const l of lines) {
      page.drawText(l, { x: M, y, size: 9, font, color: INK });
      y -= 12;
    }
    engines.forEach((e, i) => {
      const a = r.answers.find((z) => z.q === q && z.engine === e);
      const t = !a || a.error ? "—" : a.mentioned ? (a.position && a.kind === "discovery" ? `${a.position}. mesto` : "omenjeni") : "ni omembe";
      page.drawText(t, { x: M + colQ + 10 + i * 92, y: top, size: 9, font: fontBold, color: !a || a.error ? GREY : a.mentioned ? GREEN : RED });
    });
    y -= 4;
    page.drawLine({ start: { x: M, y: y + 2 }, end: { x: W - M, y: y + 2 }, thickness: 0.4, color: LINE });
    y -= 6;
  }

  if (r.summary.competitors?.length) {
    heading("Koga AI priporoča namesto vas");
    r.summary.competitors.slice(0, 8).forEach((c, i) => {
      need(15);
      text(`${i + 1}. ${c.name}`, M, 10);
      page.drawText(`${c.mentions}×`, { x: W - M - 30, y, size: 10, font, color: GREY });
      y -= 15;
    });
  }

  heading("Napačni ali nepopolni podatki");
  if (r.summary.wrongFacts?.length) for (const w of r.summary.wrongFacts) para(`• ${w}`, 10, AMBER);
  else para("V tej analizi nismo opazili napačnih podatkov o vašem podjetju.", 10, GREY);

  heading("Kaj lahko naredimo");
  para(
    `${r.brand} poskrbi, da AI asistenti in Google o vašem podjetju vedo pravilne in popolne podatke: uredimo Google profil in vpise na platformah, dodamo strukturirane podatke na spletno stran in vsak mesec merimo, kako pogosto vas AI priporoča. Rezultat vidite v mesečnem poročilu.`,
    10.5
  );
  if (r.seller) {
    y -= 6;
    need(40);
    text("Vaš kontakt", M, 9, fontBold, GREY);
    y -= 15;
    text(r.seller.name, M, 11, fontBold);
    y -= 14;
    text([r.seller.email, r.seller.phone].filter(Boolean).join(" · "), M, 10, font, GREY);
    y -= 14;
  }

  // Footer on every page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const note = `Metoda: ${r.answers.length} odgovorov ChatGPT in Gemini s spletnim iskanjem, ${r.createdAt.toLocaleDateString("sl-SI")}. AI odgovori se lahko razlikujejo od iskanja do iskanja.`;
    p.drawText(clean(note), { x: M, y: 28, size: 7.5, font, color: GREY });
    const right = `${r.companyName} · ${i + 1}/${pages.length}`;
    p.drawText(clean(right), { x: W - M - font.widthOfTextAtSize(clean(right), 7.5), y: 16, size: 7.5, font, color: GREY });
  });
  return doc.save();
}
