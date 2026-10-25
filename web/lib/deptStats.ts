// Department-by-department comparison, computed at build time from facts.json with the same
// definitions as the homepage charts, so the two always agree.
import type { Fact } from "./facts";

export type Rate = { k: number; n: number };
export type DeptStats = {
  tenders: number;
  value: number;
  one: Rate; // only one company, of open contracts with a winner and a bidder count
  low: Rate; // two or fewer, same population
  medPrice: number | null; // median winning price vs estimate (%), contracts with both
  priced: number;
  rerun: Rate; // withdrawn or advertised again, of all tender calls
  noAward: Rate; // winner chosen but no award recorded, of tenders with a winner
};

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function deptStats(rows: Fact[]): DeptStats {
  const sel = rows.filter((r) => r.selection != null);
  const open = sel.filter((r) => r.tenderType === "OPEN" && r.bidders != null);
  const diffs = sel.filter((r) => r.ecv && r.bid && r.ecv > 0 && r.bid > 0).map((r) => (r.bid! / r.ecv! - 1) * 100);
  const awarded = rows.filter((r) => r.status === "AWARDED").length;
  const chosen = rows.filter((r) => r.status === "EVALUATION_COMPLETED").length;
  return {
    tenders: rows.length,
    value: sel.reduce((a, r) => a + (r.bid ?? 0), 0),
    one: { k: open.filter((r) => r.bidders! <= 1).length, n: open.length },
    low: { k: open.filter((r) => r.bidders! <= 2).length, n: open.length },
    medPrice: median(diffs),
    priced: diffs.length,
    rerun: { k: rows.filter((r) => r.status === "RETENDERED" || r.status === "RECALLED").length, n: rows.length },
    noAward: { k: chosen, n: awarded + chosen },
  };
}

export function byDepartment(rows: Fact[]): { code: string; stats: DeptStats }[] {
  const groups = new Map<string, Fact[]>();
  for (const r of rows) groups.set(r.buyer, [...(groups.get(r.buyer) ?? []), r]);
  return [...groups.entries()].map(([code, rs]) => ({ code, stats: deptStats(rs) })).sort((a, b) => b.stats.tenders - a.stats.tenders);
}
