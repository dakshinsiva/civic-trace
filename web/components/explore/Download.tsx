"use client";

import { Icon } from "@/components/Icon";
import { csvFilename, downloadCsv, toCsv, type CsvColumn } from "@/lib/csv";
import type { Fact, Filters } from "@/lib/facts";
import { statusLabel } from "@/lib/format";
import { SITE_URL } from "@/lib/seo";

type Names = {
  buyer: Record<string, string>;
  supplier: Record<string, string>;
  rule: Record<string, string>;
  ruleBits: Record<string, number>;
  area: (id: string) => string | undefined;
  ward: (key: string) => string | undefined;
};

function columns(n: Names): CsvColumn<Fact>[] {
  const signs = (bits: number) =>
    Object.entries(n.ruleBits)
      .filter(([, bit]) => bits & bit)
      .map(([id]) => n.rule[id] ?? id)
      .join("; ");
  return [
    { header: "Tender ID", value: (r) => r.nit },
    { header: "Tender page", value: (r) => `${SITE_URL}/tender/?id=${r.nit}` },
    { header: "Department", value: (r) => r.buyer },
    { header: "Department name", value: (r) => n.buyer[r.buyer] ?? r.buyer },
    { header: "Local office (division)", value: (r) => r.division },
    { header: "Type of work", value: (r) => r.category },
    { header: "Financial year published", value: (r) => r.fy },
    { header: "Month published", value: (r) => r.month },
    { header: "Open or reserved", value: (r) => (r.tenderType === "OPEN" ? "Open" : r.tenderType === "RESERVED" ? "Reserved" : r.tenderType) },
    { header: "Times advertised", value: (r) => r.callNo },
    { header: "Status on the portal", value: (r) => statusLabel(r.status) },
    { header: "Official estimate (Rs)", value: (r) => r.ecv },
    { header: "Winning price (Rs)", value: (r) => r.bid },
    { header: "Winning price vs estimate (%)", value: (r) => (r.ecv && r.bid ? (r.bid / r.ecv - 1) * 100 : null) },
    { header: "Companies that competed on price", value: (r) => r.bidders },
    { header: "Days given to bid", value: (r) => r.window },
    { header: "Change notices", value: (r) => r.corr },
    { header: "Winner (as published)", value: (r) => (r.supplier != null ? n.supplier[String(r.supplier)] : null) },
    { header: "Assembly constituency", value: (r) => (r.area != null ? n.area(String(r.area)) : null) },
    { header: "Ward", value: (r) => (r.ward ? n.ward(r.ward) : null) },
    { header: "Warning signs", value: (r) => signs(r.flags) },
  ];
}

/** Download exactly the tenders in the current view as a spreadsheet (CSV). */
export function DownloadView({ rows, filters, names }: { rows: Fact[]; filters: Filters; names: Names }) {
  const save = () => {
    const name = csvFilename([filters.buyer, filters.division, filters.fy, filters.category, filters.tenderType, filters.area ? names.area(filters.area) ?? "" : ""]);
    downloadCsv(name, toCsv(rows, columns(names)));
  };
  return (
    <button type="button" className="btn-outline" onClick={save} disabled={!rows.length}>
      <Icon name="download" size={16} />
      Download {rows.length.toLocaleString("en-IN")} tenders (CSV)
    </button>
  );
}
