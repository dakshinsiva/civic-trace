// Per-area (or per-ward) statistics for the map. One function feeds the map colours,
// tooltips, hotspot list and area profile so they can never disagree.

import type { Fact } from "./facts";

export type MetricKey =
  | "warning_rate"
  | "single_rate"
  | "low_comp_rate"
  | "at_estimate_rate"
  | "top3_share"
  | "short_window"
  | "tenders"
  | "spend"
  | "per_capita";

export type Metric = {
  key: MetricKey;
  label: string;
  question: string;
  kind: "risk" | "volume";
  unit: "pct" | "count" | "inr" | "inr_pc" | "days";
  minN: number;
  /** Plain explanation shown under the legend. */
  explain: string;
};

export const METRICS: Metric[] = [
  {
    key: "single_rate",
    label: "Only one company competed",
    question: "Where did contracts have no price competition?",
    kind: "risk",
    unit: "pct",
    minN: 10,
    explain: "Share of open contracts with a winner where only one company reached the price round.",
  },
  {
    key: "low_comp_rate",
    label: "Two or fewer companies competed",
    question: "Where is competition thin?",
    kind: "risk",
    unit: "pct",
    minN: 10,
    explain: "Share of open contracts where at most two companies competed on price. With three or more, prices are typically far below the estimate.",
  },
  {
    key: "at_estimate_rate",
    label: "Winning price at the estimate",
    question: "Where do winning prices sit right at the government's own estimate?",
    kind: "risk",
    unit: "pct",
    minN: 10,
    explain: "Share of winning prices within 1% of the official estimate. Common when bidders quote the government's own rates and nobody undercuts.",
  },
  {
    key: "top3_share",
    label: "Work won by the top 3 contractors",
    question: "Where do a few contractors win most of the work?",
    kind: "risk",
    unit: "pct",
    minN: 15,
    explain: "Share of contracts won by the three most frequent winners in the area.",
  },
  {
    key: "warning_rate",
    label: "Tenders with a warning sign",
    question: "Where do warning signs appear most often?",
    kind: "risk",
    unit: "pct",
    minN: 20,
    explain: "Share of tenders (with full details) that carry at least one tender-level warning sign.",
  },
  {
    key: "short_window",
    label: "Less than a week to bid",
    question: "Where are bidders rushed?",
    kind: "risk",
    unit: "pct",
    minN: 15,
    explain: "Share of tenders that gave companies fewer than 7 days to bid.",
  },
  {
    key: "spend",
    label: "Money in winning bids",
    question: "Where is the money going?",
    kind: "volume",
    unit: "inr",
    minN: 1,
    explain: "Sum of the winning prices of contracts placed in the area.",
  },
  {
    key: "per_capita",
    label: "Winning bids per resident",
    question: "Where is spending highest per person?",
    kind: "volume",
    unit: "inr_pc",
    minN: 5,
    explain: "Sum of winning prices divided by the area's population (2011 census, as published with the 2025 ward map).",
  },
  {
    key: "tenders",
    label: "Number of tenders",
    question: "Where are tenders being issued?",
    kind: "volume",
    unit: "count",
    minN: 1,
    explain: "Tender calls placed in the area.",
  },
];

export type AreaStat = {
  id: string;
  tenders: number;
  fetched: number;
  selections: number;
  spend: number;
  openKnown: number;
  single: number;
  two: number;
  threePlus: number;
  priced: number;
  atEstimate: number;
  windows: number;
  shortWindows: number;
  flagged: number;
  suppliers: { id: number; wins: number; value: number }[];
  top3: number | null;
  medianVsEstimate: number | null;
};

export function computeStats(rows: Fact[], key: (f: Fact) => string | null): Map<string, AreaStat> {
  const m = new Map<string, AreaStat & { _sup: Map<number, { wins: number; value: number }>; _ratios: number[] }>();
  for (const r of rows) {
    const id = key(r);
    if (id == null) continue;
    let s = m.get(id);
    if (!s) {
      s = {
        id, tenders: 0, fetched: 0, selections: 0, spend: 0, openKnown: 0, single: 0, two: 0, threePlus: 0,
        priced: 0, atEstimate: 0, windows: 0, shortWindows: 0, flagged: 0, suppliers: [], top3: null,
        medianVsEstimate: null, _sup: new Map(), _ratios: [],
      };
      m.set(id, s);
    }
    s.tenders += 1;
    s.fetched += 1;
    if (r.flags & (2 | 4 | 8 | 16)) s.flagged += 1; // tender-level rules only
    if (r.window != null) {
      s.windows += 1;
      if (r.window < 7) s.shortWindows += 1;
    }
    if (r.selection) {
      s.selections += 1;
      s.spend += r.bid ?? 0;
      if (r.supplier != null) {
        const e = s._sup.get(r.supplier) ?? { wins: 0, value: 0 };
        e.wins += 1;
        e.value += r.bid ?? 0;
        s._sup.set(r.supplier, e);
      }
      if (r.tenderType === "OPEN" && r.bidders != null) {
        s.openKnown += 1;
        if (r.bidders <= 1) s.single += 1;
        else if (r.bidders === 2) s.two += 1;
        else s.threePlus += 1;
      }
      if (r.ecv && r.bid && r.ecv > 0) {
        const ratio = r.bid / r.ecv;
        if (ratio >= 0.2 && ratio <= 5) {
          s.priced += 1;
          s._ratios.push(ratio - 1);
          if (Math.abs(ratio - 1) <= 0.01) s.atEstimate += 1;
        }
      }
    }
  }
  const out = new Map<string, AreaStat>();
  for (const [id, s] of m) {
    const sup = [...s._sup.entries()].map(([sid, e]) => ({ id: sid, ...e })).sort((a, b) => b.wins - a.wins);
    const withSupplier = sup.reduce((a, x) => a + x.wins, 0);
    const ratios = s._ratios.sort((a, b) => a - b);
    const { _sup, _ratios, ...rest } = s; // eslint-disable-line @typescript-eslint/no-unused-vars
    out.set(id, {
      ...rest,
      suppliers: sup,
      top3: withSupplier ? sup.slice(0, 3).reduce((a, x) => a + x.wins, 0) / withSupplier : null,
      medianVsEstimate: ratios.length ? ratios[Math.floor(ratios.length / 2)] : null,
    });
  }
  return out;
}

/** Value of a metric for one area, or null when there are too few records to say. */
export function metricValue(s: AreaStat | undefined, metric: Metric, population?: number | null): { value: number | null; n: number } {
  if (!s) return { value: null, n: 0 };
  const rate = (k: number, n: number) => ({ value: n >= metric.minN ? k / n : null, n });
  switch (metric.key) {
    case "single_rate":
      return rate(s.single, s.openKnown);
    case "low_comp_rate":
      return rate(s.single + s.two, s.openKnown);
    case "at_estimate_rate":
      return rate(s.atEstimate, s.priced);
    case "top3_share":
      return { value: s.selections >= metric.minN ? s.top3 : null, n: s.selections };
    case "warning_rate":
      return rate(s.flagged, s.fetched);
    case "short_window":
      return rate(s.shortWindows, s.windows);
    case "spend":
      return { value: s.spend || null, n: s.selections };
    case "per_capita":
      return { value: population && s.selections >= metric.minN ? s.spend / population : null, n: s.selections };
    case "tenders":
      return { value: s.tenders, n: s.tenders };
  }
}

export function formatMetric(v: number | null, metric: Metric): string {
  if (v == null) return "Too few contracts to say";
  switch (metric.unit) {
    case "pct":
      return `${Math.round(v * 100)}%`;
    case "count":
      return v.toLocaleString("en-IN");
    case "inr":
      return v >= 1e7 ? `₹${(v / 1e7).toFixed(1)} cr` : `₹${(v / 1e5).toFixed(1)} lakh`;
    case "inr_pc":
      return `₹${Math.round(v).toLocaleString("en-IN")} per person`;
    case "days":
      return `${v.toFixed(0)} days`;
  }
}

/** Quantile class breaks (k classes) over the non-null values. */
export function classBreaks(values: number[], k = 5): number[] {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return [];
  const out: number[] = [];
  for (let i = 1; i < k; i++) out.push(v[Math.min(v.length - 1, Math.floor((i * v.length) / k))]);
  return [...new Set(out)];
}

// Single-hue sequential ramps (light → dark). Risk metrics: orange; volume metrics: blue.
export const RAMPS = {
  risk: ["#fde5d6", "#f8b994", "#f08a55", "#d95926", "#9c3a12"],
  volume: ["#cde2fb", "#9ec5f4", "#5598e7", "#256abf", "#104281"],
};
export const NO_DATA = "#c3c2b7";

/** One plain-English sentence describing a place on the current measure. */
export function describe(metric: Metric, v: number | null, n: number): string {
  if (v == null) return n ? `Only ${n} record${n === 1 ? "" : "s"} here so far: too few to say.` : "No contracts placed here yet.";
  const p = `${Math.round(v * 100)}%`;
  switch (metric.key) {
    case "single_rate":
      return `${p} of ${n} open contracts had only one company competing.`;
    case "low_comp_rate":
      return `${p} of ${n} open contracts had two or fewer companies competing.`;
    case "at_estimate_rate":
      return `${p} of ${n} winning prices were within 1% of the official estimate.`;
    case "top3_share":
      return `The three most frequent winners took ${p} of ${n} contracts.`;
    case "warning_rate":
      return `${p} of ${n} tenders carried a warning sign.`;
    case "short_window":
      return `${p} of ${n} tenders gave companies less than a week to bid.`;
    case "spend":
      return `${formatMetric(v, metric)} in winning bids across ${n} contracts.`;
    case "per_capita":
      return `${formatMetric(v, metric)} in winning bids (${n} contracts).`;
    case "tenders":
      return `${n} tenders placed here.`;
  }
}
