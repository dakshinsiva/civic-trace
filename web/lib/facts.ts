// Decoder for facts.json — the compact, columnar table behind the interactive explorer.

export type FactsFile = {
  n: number;
  rule_bits: Record<string, number>;
  dict: Record<"buyer" | "division" | "category" | "fy" | "month" | "tender_type" | "status", string[]> & { ward?: string[] };
  cols: {
    buyer: number[];
    division: number[];
    category: number[];
    fy: number[];
    month: number[];
    tender_type: number[];
    status: number[];
    nit: number[];
    call_no: number[];
    ecv: (number | null)[];
    bid: (number | null)[];
    bidders: (number | null)[];
    window: (number | null)[];
    corr: number[];
    ext: number[];
    sel: number[];
    supplier: (number | null)[];
    flags: number[];
    ac?: (number | null)[];
    ward?: (number | null)[];
  };
  suppliers: Record<string, string>;
};

export type Fact = {
  nit: number;
  buyer: string;
  division: string;
  category: string;
  fy: string;
  month: string;
  tenderType: string;
  status: string;
  callNo: number;
  ecv: number | null;
  bid: number | null;
  bidders: number | null;
  window: number | null;
  corr: number;
  ext: number;
  selection: "awarded" | "selected_no_award" | null;
  supplier: number | null;
  flags: number;
  /** Assembly-constituency area number (administrative geography only). */
  area: number | null;
  /** Ward key, e.g. "East-14", when a ward is named in the tender. */
  ward: string | null;
};

export function decodeFacts(f: FactsFile): Fact[] {
  const c = f.cols;
  const d = f.dict;
  const out: Fact[] = new Array(f.n);
  for (let i = 0; i < f.n; i++) {
    out[i] = {
      nit: c.nit[i],
      buyer: d.buyer[c.buyer[i]],
      division: d.division[c.division[i]],
      category: d.category[c.category[i]],
      fy: d.fy[c.fy[i]],
      month: d.month[c.month[i]],
      tenderType: d.tender_type[c.tender_type[i]],
      status: d.status[c.status[i]],
      callNo: c.call_no[i],
      ecv: c.ecv[i],
      bid: c.bid[i],
      bidders: c.bidders[i],
      window: c.window[i],
      corr: c.corr[i],
      ext: c.ext[i],
      selection: c.sel[i] === 1 ? "awarded" : c.sel[i] === 2 ? "selected_no_award" : null,
      supplier: c.supplier[i],
      flags: c.flags[i],
      area: c.ac?.[i] ?? null,
      ward: c.ward && c.ward[i] != null && d.ward ? d.ward[c.ward[i] as number] : null,
    };
  }
  return out;
}

export type Filters = { buyer: string; fy: string; category: string; division: string; tenderType: string; area: string };
export const EMPTY_FILTERS: Filters = { buyer: "", fy: "", category: "", division: "", tenderType: "", area: "" };

export function applyFilters(rows: Fact[], f: Filters): Fact[] {
  return rows.filter(
    (r) =>
      (!f.buyer || r.buyer === f.buyer) &&
      (!f.fy || r.fy === f.fy) &&
      (!f.category || r.category === f.category) &&
      (!f.division || r.division === f.division) &&
      (!f.tenderType || r.tenderType === f.tenderType) &&
      (!f.area || String(r.area) === f.area),
  );
}

export function bidderGroup(n: number | null): "1" | "2" | "3+" | "unknown" {
  if (n == null) return "unknown";
  if (n <= 1) return "1";
  if (n === 2) return "2";
  return "3+";
}

/** Colors follow the category, everywhere on the site. "1 company" gets the attention hue. */
export const BIDDER_COLORS: Record<string, string> = {
  "1": "var(--series-2)",
  "2": "var(--series-1)",
  "3+": "var(--series-3)",
  unknown: "var(--axis)",
};
export const BIDDER_LABELS: Record<string, string> = {
  "1": "Only 1 company",
  "2": "2 companies",
  "3+": "3 or more",
  unknown: "Not published",
};
