// CSV export for "download this view". Plain numbers (no ₹ or commas) so spreadsheets can sum
// them, a UTF-8 byte-order mark so Excel reads ₹ and Kannada correctly, and RFC 4180 quoting.

export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

function field(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = typeof v === "number" ? (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "") : v;
  // Quote anything with a comma, quote or line break; a leading = + - @ could run as a formula, so quote and prefix it.
  const safe = /^[=+\-@]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\r\n]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(rows: T[], cols: CsvColumn<T>[]): string {
  const lines = [cols.map((c) => field(c.header)).join(",")];
  for (const r of rows) lines.push(cols.map((c) => field(c.value(r))).join(","));
  return lines.join("\r\n") + "\r\n";
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "civictrace-bengaluru-tenders-bbmp-2024-25-2026-10-25.csv" */
export function csvFilename(parts: string[]): string {
  const slug = parts
    .filter(Boolean)
    .map((p) => p.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("-");
  const day = new Date().toISOString().slice(0, 10);
  return `civictrace-bengaluru-tenders${slug ? `-${slug}` : ""}-${day}.csv`;
}
