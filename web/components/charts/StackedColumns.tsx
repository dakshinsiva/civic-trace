"use client";

import { useState } from "react";

import { BarPath, niceTicks } from "./Histogram";

type Series = { key: string; label: string; color: string };

/** Two-series stacked columns with a 2px surface gap between segments and a legend. */
export function StackedColumns({ data, series, title, xKey }: { data: Record<string, number | string>[]; series: Series[]; title: string; xKey: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, P = { l: 48, r: 8, t: 12, b: 28 };
  const iw = W - P.l - P.r, ih = H - P.t - P.b;
  const totals = data.map((d) => series.reduce((a, s) => a + Number(d[s.key] || 0), 0));
  const max = Math.max(1, ...totals);
  const ticks = niceTicks(max, 4);
  const top = Math.max(max, ticks[ticks.length - 1]);
  const band = iw / Math.max(1, data.length);
  const bw = Math.min(24 * 2, band * 0.6);
  const y = (v: number) => P.t + ih - (v / top) * ih;
  return (
    <figure>
      <figcaption className="text-sm font-medium text-ink mb-1">{title}</figcaption>
      <ul className="flex flex-wrap gap-4 text-xs text-ink-2 mb-1" aria-label="Legend">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={title}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
              <text x={P.l - 6} y={y(t) + 4} fontSize={11} textAnchor="end" fill="var(--muted)" className="tabular">
                {t.toLocaleString("en-IN")}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = P.l + band * i + band / 2;
            let acc = 0;
            return (
              <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={P.l + band * i} y={P.t} width={band} height={ih} fill="transparent" />
                {series.map((s, si) => {
                  const v = Number(d[s.key] || 0);
                  if (!v) return null;
                  const y0 = y(acc), y1 = y(acc + v);
                  acc += v;
                  const isTop = series.slice(si + 1).every((s2) => !Number(d[s2.key] || 0));
                  const h = Math.max(0, y0 - y1 - (acc > v ? 2 : 0));
                  return isTop ? (
                    <BarPath key={s.key} x={cx - bw / 2} y={y1} w={bw} h={h} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.55} />
                  ) : (
                    <rect key={s.key} x={cx - bw / 2} y={y1} width={bw} height={h} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.55} />
                  );
                })}
                <text x={cx} y={H - 8} fontSize={11} textAnchor="middle" fill="var(--muted)">
                  {String(d[xKey])}
                </text>
              </g>
            );
          })}
          <line x1={P.l} x2={W - P.r} y1={P.t + ih} y2={P.t + ih} stroke="var(--axis)" />
        </svg>
        {hover !== null && (
          <div
            className="tooltip pointer-events-none absolute top-0 z-10 tabular"
            style={{ left: `${((P.l + band * hover + band / 2) / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            <div className="font-medium">{String(data[hover][xKey])}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: s.color }} />
                {s.label}: {Number(data[hover][s.key] || 0).toLocaleString("en-IN")}
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
