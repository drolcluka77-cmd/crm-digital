/**
 * Small CSV parser (client- and server-safe). Handles quoted fields,
 * escaped quotes, CRLF, and both "," and ";" delimiters (Excel in
 * Slovenia and most of Europe saves CSV with semicolons).
 */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const delimiter =
    (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length
      ? ";"
      : (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length
        ? "\t"
        : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c));
}

/** CRM fields a CSV column can map to. */
export const LEAD_FIELDS = [
  ["name", "Contact name"],
  ["company", "Company"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["jobTitle", "Job title"],
  ["segment", "Segment"],
  ["size", "Size"],
  ["city", "City"],
  ["country", "Country"],
  ["website", "Website"],
  ["source", "Lead source"],
  ["note", "Note"],
] as const;
export type LeadField = (typeof LEAD_FIELDS)[number][0];

// English + Slovenian header names.
const SYNONYMS: Record<LeadField, string[]> = {
  name: ["name", "contact", "contact name", "full name", "person", "ime", "ime in priimek", "kontakt", "kontaktna oseba"],
  company: ["company", "organisation", "organization", "business", "firm", "podjetje", "firma", "naziv"],
  email: ["email", "e-mail", "mail", "email address", "e-pošta", "e-posta", "elektronska pošta"],
  phone: ["phone", "telephone", "mobile", "tel", "gsm", "telefon", "mobitel"],
  jobTitle: ["job title", "title", "position", "role", "funkcija", "delovno mesto", "naziv delovnega mesta"],
  segment: ["segment", "industry", "sector", "type", "dejavnost", "panoga"],
  size: ["size", "units", "buildings", "beds", "employees", "velikost", "št. stanovanj", "zaposleni"],
  city: ["city", "town", "mesto", "kraj", "občina", "obcina"],
  country: ["country", "država", "drzava"],
  website: ["website", "web", "url", "site", "spletna stran", "splet"],
  source: ["source", "lead source", "vir"],
  note: ["note", "notes", "comment", "comments", "opomba", "opombe"],
};

/** Guesses which CRM field each header belongs to ("" = ignore). */
export function guessMapping(headers: string[]): (LeadField | "")[] {
  const used = new Set<string>();
  return headers.map((h) => {
    const key = h.toLowerCase().replace(/[_*]/g, " ").replace(/\s+/g, " ").trim();
    for (const [field, names] of Object.entries(SYNONYMS) as [LeadField, string[]][]) {
      if (!used.has(field) && names.includes(key)) {
        used.add(field);
        return field;
      }
    }
    return "";
  });
}
