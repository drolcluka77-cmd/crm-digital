"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/Modal";
import { DownloadIcon } from "@/components/icons";
import { parseCsv, guessMapping, LEAD_FIELDS, type LeadField } from "@/lib/csv";
import type { LeadRow } from "@/lib/leads";

type ImportResult = { error?: string; created?: number; skipped?: string[] };

/**
 * Upload a CSV (from Excel, Google Sheets, a lead list…), check which
 * column is which, preview, and import. Parsing happens in the browser.
 */
export default function CsvImport({
  onImport,
  label = "Import CSV",
  title = "Import leads from CSV",
  hint,
  buttonClass = "btn-secondary",
}: {
  onImport: (rows: LeadRow[]) => Promise<ImportResult>;
  label?: string;
  title?: string;
  hint?: string;
  buttonClass?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<(LeadField | "")[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setHeaders([]);
    setRows([]);
    setMapping([]);
    setError(null);
    setResult(null);
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) return setError("The file needs a header row and at least one lead.");
    setHeaders(parsed[0]);
    setRows(parsed.slice(1));
    setMapping(guessMapping(parsed[0]));
  }

  const mapped: LeadRow[] = rows.map((r) => {
    const out: LeadRow = {};
    mapping.forEach((field, i) => {
      if (field && r[i]) out[field] = out[field] ? `${out[field]} ${r[i]}` : r[i];
    });
    return out;
  });
  const hasName = mapping.includes("name") || mapping.includes("company");

  async function doImport() {
    setBusy(true);
    setError(null);
    const res = await onImport(mapped);
    setBusy(false);
    if (res.error) return setError(res.error);
    setResult(res);
    router.refresh();
  }

  function downloadSample() {
    const sample =
      "Company;Contact name;Job title;Email;Phone;Segment;Size;City;Country;Website;Note\n" +
      "Upravnik d.o.o.;Ana Novak;Property manager;ana@example.si;+386 40 000 000;Building / property management;14 buildings;Ljubljana;Slovenia;example.si;Met at fair\n";
    const url = URL.createObjectURL(new Blob(["﻿" + sample], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        className={buttonClass}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <DownloadIcon className="h-4 w-4 rotate-180" />
        {label}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} wide>
        {result ? (
          <div className="space-y-4">
            <div className="success-box">
              Imported {result.created} lead{result.created === 1 ? "" : "s"}.
              {result.skipped && result.skipped.length > 0 && ` Skipped ${result.skipped.length}.`}
            </div>
            {result.skipped && result.skipped.length > 0 && (
              <ul className="text-xs text-black/55 max-h-48 overflow-y-auto space-y-0.5">
                {result.skipped.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
            <button className="btn-primary w-full" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {hint && <p className="text-sm text-black/55">{hint}</p>}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={(e) => onFile(e.target.files?.[0])}
                className="block flex-1 text-sm text-black/60 rounded-xl border border-black/10 bg-white px-3.5 py-2.5"
              />
              <button type="button" className="text-xs text-brand-600 hover:underline" onClick={downloadSample}>
                Download a template
              </button>
            </div>
            <p className="text-xs text-black/40">
              In Excel: File → Save As → CSV. Duplicate emails (already in the CRM) are skipped automatically.
            </p>
            {error && <div className="error-box">{error}</div>}

            {headers.length > 0 && (
              <>
                <div>
                  <div className="section-title mb-2">Match the columns</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {headers.map((h, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-32 truncate text-black/60" title={h}>
                          {h || `Column ${i + 1}`}
                        </span>
                        <select
                          className="input py-1.5 text-sm"
                          value={mapping[i] || ""}
                          onChange={(e) =>
                            setMapping((m) => m.map((v, j) => (j === i ? (e.target.value as LeadField | "") : v)))
                          }
                        >
                          <option value="">— ignore —</option>
                          {LEAD_FIELDS.map(([f, l]) => (
                            <option key={f} value={f}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="section-title mb-2">Preview ({rows.length} rows)</div>
                  <div className="overflow-x-auto rounded-xl border border-black/10">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-sand-50 text-left">
                          <th className="px-3 py-2">Company</th>
                          <th className="px-3 py-2">Contact</th>
                          <th className="px-3 py-2">Email</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">City</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mapped.slice(0, 5).map((r, i) => (
                          <tr key={i} className="border-t border-black/5">
                            <td className="px-3 py-1.5">{r.company}</td>
                            <td className="px-3 py-1.5">{r.name}</td>
                            <td className="px-3 py-1.5">{r.email}</td>
                            <td className="px-3 py-1.5">{r.phone}</td>
                            <td className="px-3 py-1.5">{r.city}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                {!hasName && <div className="error-box">Map at least a Contact name or Company column.</div>}
                <button className="btn-primary w-full" disabled={busy || !hasName} onClick={doImport}>
                  {busy ? "Importing…" : `Import ${rows.length} lead${rows.length === 1 ? "" : "s"}`}
                </button>
              </>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
