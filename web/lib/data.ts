// Build-time data access (Server Components only). The JSON files are the
// static data release in public/data, written by `civictrace export`.
import "server-only";

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import type { BuyerDoc, Meta, Overview } from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

function read<T>(rel: string): T {
  return JSON.parse(readFileSync(path.join(DATA_DIR, rel), "utf8")) as T;
}

export function hasData(): boolean {
  return existsSync(path.join(DATA_DIR, "meta.json"));
}

export function getMeta(): Meta {
  return read<Meta>("meta.json");
}

export function getOverview(): Overview {
  return read<Overview>("overview.json");
}

export function getBuyer(code: string): BuyerDoc {
  return read<BuyerDoc>(path.join("buyers", `${code}.json`));
}

export type Stat = { k: number; n: number; share: number | null; ci95: [number, number] | null };
export type Findings = {
  coverage: { listed_calls: number; fetched_calls: number; fetched_share: number | null; sampling: string };
  any_warning_sign: Stat;
  two_or_more_signs: Stat;
  single_bidder: Stat;
  two_bidders: Stat;
  price_within_1pct_of_estimate: Stat;
  price_over_5pct_above_estimate: Stat;
  window_under_7_days: Stat;
  changed_3_plus_times: Stat;
  median_window_days: number | null;
  median_price_vs_estimate_by_bidders: { one: number | null; two: number | null; three_plus: number | null; n_one: number; n_two: number; n_three_plus: number };
  price_vs_estimate_by_category: { category: string; low_competition: number | null; n_low: number; three_plus: number | null; n_three_plus: number }[];
  competition_gap: { amount: number; of_value: number; share: number | null };
  single_bidder_value: number;
  selected_value: number;
  status_all_listed: { awarded: number; evaluation_completed_no_award: number; recalled: number; retendered: number; listed: number };
};

export function getFindings(): Findings | null {
  return existsSync(path.join(DATA_DIR, "findings.json")) ? read<Findings>("findings.json") : null;
}

export function relationshipsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_INCLUDE_RELATIONSHIPS === "1";
}
