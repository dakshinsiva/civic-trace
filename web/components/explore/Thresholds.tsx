"use client";

import { useState } from "react";

import { Histogram } from "@/components/charts/Histogram";
import type { Fact } from "@/lib/facts";

/** Round figures where estimates pile up just below the line in this data. */
export const LIMITS = [
  { v: 5e5, label: "₹5 lakh" },
  { v: 1e6, label: "₹10 lakh" },
  { v: 1e7, label: "₹1 crore" },
];

const FROM = -20; // 1% bands from 80% …
const TO = 10; // … to 110% of the limit
const JUST_UNDER = -FROM - 1; // index of the band [99%, 100%)

/** Official estimates in 1% bands around a limit, and how many times more sit just under it than in a typical band nearby. */
export function bunching(rows: Fact[], limit: number) {
  const edges = Array.from({ length: TO - FROM + 1 }, (_, i) => limit * (1 + (FROM + i) / 100));
  const counts = edges.slice(0, -1).map(() => 0);
  for (const r of rows) {
    const e = r.ecv;
    if (!e || e < edges[0] || e >= edges[edges.length - 1]) continue;
    // Whole-percent arithmetic, so an estimate of exactly 99% of the limit lands in the 99–100% band.
    counts[Math.min(counts.length - 1, Math.floor((e * 100) / limit) - (100 + FROM))] += 1;
  }
  // The typical band is the median of the bands nearby, leaving out the three around the line itself. A median, not a
  // mean: standard packages (hundreds of works at one figure, e.g. ₹8.4 lakh) would otherwise inflate it and hide a spike.
  const ref = counts.filter((_, i) => Math.abs(i - JUST_UNDER) > 1).sort((x, y) => x - y);
  const m = Math.floor(ref.length / 2);
  const typical = ref.length % 2 ? ref[m] : (ref[m - 1] + ref[m]) / 2;
  const just = counts[JUST_UNDER];
  return { edges, counts, just, typical, factor: typical > 0 ? just / typical : null, total: counts.reduce((a, b) => a + b, 0) };
}

export function thresholdTakeaway(rows: Fact[]): string | undefined {
  const all = LIMITS.map((l) => ({ ...l, ...bunching(rows, l.v) })).filter((b) => b.total >= 40 && b.factor != null);
  const strong = all.filter((b) => b.factor! >= 2.5 && b.just >= 10);
  if (!all.length) return undefined;
  if (!strong.length) return "In this selection, estimates don't pile up just under ₹5 lakh, ₹10 lakh or ₹1 crore.";
  const parts = strong.map((b) => `${b.label} (${b.just.toLocaleString("en-IN")}, about ${Math.round(b.factor!)} times a typical 1% band)`);
  return `Estimates pile up in the 1% just under ${parts.join(", ")}.`;
}

/** Pick a limit; see how many estimates sit in each 1% band around it, with the band just under it highlighted. */
export function Thresholds({ rows }: { rows: Fact[] }) {
  const [limit, setLimit] = useState(LIMITS[1].v);
  const b = bunching(rows, limit);
  const label = LIMITS.find((l) => l.v === limit)!.label;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Choose a limit">
        {LIMITS.map((l) => {
          const f = bunching(rows, l.v).factor;
          return (
            <button
              key={l.v}
              type="button"
              aria-pressed={l.v === limit}
              onClick={() => setLimit(l.v)}
              className={`rounded-full border px-3 py-1 text-xs ${l.v === limit ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-accent"}`}
            >
              {l.label}
              {f != null && f >= 1.5 && <span className="ml-1.5 tabular text-muted">{f.toFixed(1)}×</span>}
            </button>
          );
        })}
      </div>
      {b.total < 20 ? (
        <p className="text-sm text-muted">Too few tenders with an estimate near {label} in this selection.</p>
      ) : (
        <>
          <Histogram
            title=""
            counts={b.counts}
            edges={b.edges}
            xLabel={`official estimate, in 1% bands from 80% to 110% of ${label}`}
            format="inr"
            refs={[{ value: limit, label }]}
            highlight={JUST_UNDER}
            height={210}
          />
          <p className="mt-1 text-sm text-ink-2">
            <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: "var(--series-2)" }} />
            The 1% just under {label}: <strong className="font-medium text-ink tabular">{b.just.toLocaleString("en-IN")}</strong> tenders, against about{" "}
            <span className="tabular">{Math.round(b.typical)}</span> in a typical 1% band nearby
            {b.factor != null && b.factor >= 1.5 ? ` (${b.factor.toFixed(1)} times as many)` : ""}.
          </p>
        </>
      )}
    </div>
  );
}
