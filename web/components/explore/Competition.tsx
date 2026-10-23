"use client";

import { BarRow } from "@/components/charts/BarRow";
import { BIDDER_COLORS, BIDDER_LABELS, bidderGroup, type Fact } from "@/lib/facts";
import { inr } from "@/lib/format";

const GROUPS = ["1", "2", "3+"] as const;
type Group = (typeof GROUPS)[number];

/** Winning price against the official estimate, as a % (−18 = 18% below). Ratios outside 0.2–5× are data errors. */
function priceDiff(r: Fact): number | null {
  if (!r.ecv || !r.bid || r.ecv <= 0 || r.bid <= 0) return null;
  const ratio = r.bid / r.ecv;
  return ratio >= 0.2 && ratio <= 5 ? (ratio - 1) * 100 : null;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function pct(n: number, d: number): string {
  if (!d) return "—";
  const p = (n / d) * 100;
  return p > 0 && p < 1 ? "<1%" : `${Math.round(p)}%`;
}

/** "18% below", "at the estimate", "3% above". */
export function vsEstimate(d: number | null): string {
  if (d == null) return "—";
  const r = Math.round(Math.abs(d));
  return r === 0 ? "at the estimate" : `${r}% ${d < 0 ? "below" : "above"}`;
}

/** Open contracts with a winner and a published bidder count: the population every competition chart uses. */
export function competed(rows: Fact[]): (Fact & { group: Group })[] {
  return rows
    .filter((r) => r.selection != null && r.tenderType === "OPEN" && r.bidders != null)
    .map((r) => ({ ...r, group: bidderGroup(r.bidders) as Group }));
}

// ---------------------------------------------------------------- price by competition

/**
 * Same population as the findings page (every contract with an estimate, a winning price and a
 * bidder count, reserved tenders included), so the two pages always quote the same figures.
 */
export function priceByGroup(rows: Fact[]) {
  const priced = rows.filter((r) => r.selection != null && r.bidders != null && r.ecv && r.bid && r.ecv > 0 && r.bid > 0);
  return GROUPS.map((g) => {
    const diffs = priced.filter((r) => bidderGroup(r.bidders) === g).map((r) => (r.bid! / r.ecv! - 1) * 100);
    return { g, n: diffs.length, med: diffs.length >= 5 ? median(diffs) : null };
  });
}

/** Typical (median) winning price against the estimate, for 1, 2 and 3+ bidders: diverging bars from the estimate. */
export function PriceByCompetition({ rows }: { rows: Fact[] }) {
  const data = priceByGroup(rows);
  const shown = data.filter((d) => d.med != null);
  if (shown.length < 2) return <p className="text-sm text-muted">Not enough contracts with an estimate, a winning price and a bidder count in this selection yet.</p>;
  const max = Math.max(5, ...shown.map((d) => Math.ceil(Math.abs(d.med!) / 5) * 5));
  return (
    <figure>
      <div className="space-y-3">
        {data.map((d) => {
          const w = d.med == null ? 0 : (Math.abs(d.med) / max) * 50;
          const below = (d.med ?? 0) < 0;
          return (
            <BarRow
              key={d.g}
              labelWidth="8rem"
              valueWidth="9rem"
              title={`${BIDDER_LABELS[d.g]}: typical price ${vsEstimate(d.med)} the estimate (${d.n.toLocaleString("en-IN")} contracts)`}
              label={
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BIDDER_COLORS[d.g] }} />
                  {BIDDER_LABELS[d.g]}
                </span>
              }
              value={<>{d.med == null ? "too few" : vsEstimate(d.med)} <span className="text-muted">({d.n.toLocaleString("en-IN")})</span></>}
              bar={
                <span className="relative block h-5">
                  <span className="absolute inset-y-[-4px] left-1/2 w-px bg-ink-2" aria-hidden />
                  {d.med != null && w > 0 && (
                    <span
                      className={`absolute inset-y-0 ${below ? "rounded-l-[4px]" : "rounded-r-[4px]"}`}
                      style={{ background: BIDDER_COLORS[d.g], width: `${Math.max(w, 0.6)}%`, [below ? "right" : "left"]: "50%" }}
                    />
                  )}
                </span>
              }
            />
          );
        })}
      </div>
      <BarRow
        labelWidth="8rem"
        valueWidth="9rem"
        label={<span className="hidden sm:inline" />}
        value={<span className="hidden sm:inline" />}
        bar={
          <span className="flex justify-between text-xs text-muted">
            <span>← cheaper</span>
            <span className="text-ink-2">estimate</span>
            <span>dearer →</span>
          </span>
        }
      />
    </figure>
  );
}

// ---------------------------------------------------------------- job size

const BANDS = [
  { key: "lt10l", label: "Under ₹10 lakh", lo: 0, hi: 1e6 },
  { key: "10l-50l", label: "₹10–50 lakh", lo: 1e6, hi: 5e6 },
  { key: "50l-1cr", label: "₹50 lakh–1 crore", lo: 5e6, hi: 1e7 },
  { key: "1-5cr", label: "₹1–5 crore", lo: 1e7, hi: 5e7 },
  { key: "5cr+", label: "Over ₹5 crore", lo: 5e7, hi: Infinity },
];

export function sizeBands(rows: Fact[]) {
  const c = competed(rows).filter((r) => r.ecv && r.ecv > 0);
  const totalValue = c.reduce((a, r) => a + (r.bid ?? 0), 0);
  return BANDS.map((b) => {
    const rs = c.filter((r) => r.ecv! >= b.lo && r.ecv! < b.hi);
    const counts = Object.fromEntries(GROUPS.map((g) => [g, rs.filter((r) => r.group === g).length])) as Record<Group, number>;
    const value = rs.reduce((a, r) => a + (r.bid ?? 0), 0);
    const diffs = rs.map(priceDiff).filter((v): v is number => v != null);
    return { ...b, n: rs.length, counts, lowComp: counts["1"] + counts["2"], value, totalValue, med: diffs.length >= 5 ? median(diffs) : null };
  });
}

/** Competition and price by size of job: a 100% stacked bar of 1 / 2 / 3+ bidders per size band. */
export function SizeBands({ rows }: { rows: Fact[] }) {
  const data = sizeBands(rows).filter((b) => b.n >= 10);
  if (data.length < 2) return <p className="text-sm text-muted">Not enough contracts with a bidder count in this selection yet.</p>;
  const cols = "sm:grid-cols-[10rem_1fr_6rem_6rem_7.5rem]";
  return (
    <figure>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
        {GROUPS.map((g) => (
          <li key={g} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BIDDER_COLORS[g] }} />
            {BIDDER_LABELS[g]}
          </li>
        ))}
      </ul>
      <div className={`hidden gap-3 border-b border-line pb-1.5 label-mono text-muted sm:grid ${cols}`}>
        <span>Size of the job</span>
        <span>How many companies competed</span>
        <span className="text-right">Of the money</span>
        <span className="text-right">Two or fewer</span>
        <span className="text-right">Typical price</span>
      </div>
      <div className="divide-y divide-line">
        {data.map((b) => (
          <div key={b.key} className={`grid grid-cols-3 items-center gap-x-3 gap-y-1.5 py-2.5 text-sm ${cols}`}>
            <div className="col-span-3 sm:col-span-1">
              <div className="text-ink">{b.label}</div>
              <div className="text-xs text-muted tabular">
                {b.n.toLocaleString("en-IN")} contracts · {inr(b.value)}
              </div>
            </div>
            <div className="col-span-3 flex h-5 gap-[2px] sm:col-span-1" role="img" aria-label={GROUPS.map((g) => `${BIDDER_LABELS[g]} ${pct(b.counts[g], b.n)}`).join(", ")}>
              {GROUPS.map((g, i) =>
                b.counts[g] ? (
                  <span
                    key={g}
                    className={i === GROUPS.length - 1 || GROUPS.slice(i + 1).every((g2) => !b.counts[g2]) ? "rounded-r-[4px]" : ""}
                    style={{ width: `${(b.counts[g] / b.n) * 100}%`, background: BIDDER_COLORS[g] }}
                    title={`${BIDDER_LABELS[g]}: ${b.counts[g].toLocaleString("en-IN")} of ${b.n.toLocaleString("en-IN")} (${pct(b.counts[g], b.n)})`}
                  />
                ) : null,
              )}
            </div>
            <div className="tabular text-ink sm:text-right">
              <span className="block text-xs text-muted sm:hidden">Of the money</span>
              {pct(b.value, b.totalValue)}
            </div>
            <div className="tabular text-ink sm:text-right">
              <span className="block text-xs text-muted sm:hidden">Two or fewer</span>
              {pct(b.lowComp, b.n)}
            </div>
            <div className="tabular text-ink sm:text-right">
              <span className="block text-xs text-muted sm:hidden">Typical price</span>
              {vsEstimate(b.med)}
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}

/** Jobs of ₹1 crore or more against smaller ones: share of contracts, share of the money, competition and price. */
export function bigVsSmall(rows: Fact[]) {
  const c = competed(rows).filter((r) => r.ecv && r.ecv > 0);
  const big = c.filter((r) => r.ecv! >= 1e7);
  const small = c.filter((r) => r.ecv! < 1e7);
  const value = (rs: Fact[]) => rs.reduce((a, r) => a + (r.bid ?? 0), 0);
  const low = (rs: (Fact & { group: Group })[]) => rs.filter((r) => r.group !== "3+").length;
  const diffs = big.map(priceDiff).filter((v): v is number => v != null);
  return {
    n: c.length,
    big: { n: big.length, low: low(big), value: value(big), med: diffs.length >= 5 ? median(diffs) : null },
    small: { n: small.length, low: low(small) },
    totalValue: value(c),
  };
}

// ---------------------------------------------------------------- outcomes

const OUTCOMES = [
  { key: "awarded", label: "Contract awarded", statuses: ["AWARDED"] },
  { key: "chosen", label: "Winner chosen, no award recorded", statuses: ["EVALUATION_COMPLETED"] },
  { key: "evaluating", label: "Still being evaluated", statuses: ["UNDER_EVALUATION", "EVALUATION_SUSPENDED", "PUBLISHED"] },
  { key: "retendered", label: "Advertised again", statuses: ["RETENDERED"] },
  { key: "recalled", label: "Withdrawn", statuses: ["RECALLED"] },
  { key: "nobids", label: "No bids received", statuses: ["NO_BIDS_RECIEVED"] },
];

export function outcomes(rows: Fact[]) {
  const known = new Set(OUTCOMES.flatMap((o) => o.statuses));
  return {
    total: rows.length,
    other: rows.filter((r) => !known.has(r.status)).length,
    rows: OUTCOMES.map((o) => ({ ...o, n: rows.filter((r) => o.statuses.includes(r.status)).length })),
  };
}

/** Where each tender call ended up, as the portal last showed it. */
export function Outcomes({ rows }: { rows: Fact[] }) {
  const o = outcomes(rows);
  if (!o.total) return <p className="text-sm text-muted">No tenders in this selection.</p>;
  const max = Math.max(1, ...o.rows.map((r) => r.n));
  return (
    <div className="space-y-2.5">
      {o.rows.map((r) => (
        <BarRow
          key={r.key}
          labelWidth="13rem"
          title={`${r.label}: ${r.n.toLocaleString("en-IN")} of ${o.total.toLocaleString("en-IN")} tenders`}
          label={r.label}
          value={<>{r.n.toLocaleString("en-IN")} <span className="text-muted">({pct(r.n, o.total)})</span></>}
          bar={<span className="block h-5 rounded-r-[4px]" style={{ width: `${Math.max(0.5, (r.n / max) * 100)}%`, background: "var(--series-1)" }} />}
        />
      ))}
    </div>
  );
}
