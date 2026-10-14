"use client";

import { useState } from "react";

export type RateRow = { key: string; label: string; n: number; d: number; href?: string; note?: string };

/**
 * Horizontal bars of a rate (n / d), one series. Every bar is labelled with
 * its numerator and denominator: a rate without its denominator misleads.
 */
export function RateBars({ rows, title, valueLabel, benchmark }: { rows: RateRow[]; title: string; valueLabel: string; benchmark?: { value: number; label: string } }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(0.05, benchmark?.value ?? 0, ...rows.map((r) => (r.d ? r.n / r.d : 0)));
  return (
    <figure>
      <figcaption className="text-sm font-medium text-ink mb-2">{title}</figcaption>
      <div className="space-y-1.5">
        {rows.map((r) => {
          const v = r.d ? r.n / r.d : 0;
          return (
            <div
              key={r.key}
              className="grid grid-cols-[minmax(7rem,12rem)_1fr_auto] items-center gap-3 text-sm"
              onMouseEnter={() => setHover(r.key)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="truncate text-ink-2" title={r.label}>
                {r.href ? <a href={r.href}>{r.label}</a> : r.label}
              </div>
              <div className="relative h-4">
                {benchmark && (
                  <div className="absolute top-[-3px] bottom-[-3px] w-px bg-[var(--ink-2)] opacity-60" style={{ left: `${(benchmark.value / max) * 100}%` }} title={benchmark.label} />
                )}
                <div
                  className="h-4 rounded-r-[4px]"
                  style={{ width: `${Math.max(0.5, (v / max) * 100)}%`, background: "var(--series-1)", opacity: hover === null || hover === r.key ? 1 : 0.55 }}
                />
              </div>
              <div className="tabular text-ink whitespace-nowrap">
                {r.d ? `${(v * 100).toFixed(1)}%` : "—"} <span className="text-muted">({r.n.toLocaleString("en-IN")} of {r.d.toLocaleString("en-IN")})</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">
        {valueLabel}
        {benchmark ? ` Vertical rule: ${benchmark.label}.` : ""}
      </p>
    </figure>
  );
}
