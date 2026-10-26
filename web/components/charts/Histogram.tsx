"use client";

import { scaleLinear } from "d3-scale";
import { useId, useMemo, useState } from "react";

import { useWidth } from "@/lib/useWidth";

type Props = {
  counts: number[];
  edges: number[];
  log?: boolean;
  /** Value to mark (e.g. this tender's window). Drawn as a vertical rule in series-2. */
  marker?: number | null;
  markerLabel?: string;
  /** Reference lines (e.g. lower fence, median). */
  refs?: { value: number; label: string }[];
  xLabel: string;
  /** Serializable so Server Components can pass it. */
  format?: "days" | "ratio" | "number" | "inr";
  /** Index of one bar to draw in the highlight colour (series-2). */
  highlight?: number;
  height?: number;
  title: string;
};

const PAD = { l: 48, r: 12, t: 24, b: 40 };

const FORMATS = {
  days: (v: number) => v.toFixed(0),
  ratio: (v: number) => `${v.toFixed(2)}×`,
  number: (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)),
  inr: (v: number) => (v >= 1e7 ? `₹${(v / 1e7).toFixed(2).replace(/\.?0+$/, "")} cr` : `₹${(v / 1e5).toFixed(1).replace(/\.0$/, "")} lakh`),
};

export function Histogram({ counts, edges, log = false, marker, markerLabel, refs = [], xLabel, format = "number", height = 220, title, highlight }: Props) {
  const id = useId();
  const [box, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const fx = FORMATS[format];
  const H = height;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;

  const t = (v: number) => (log ? Math.log(v) : v);
  const lo = t(edges[0]);
  const hi = t(edges[edges.length - 1]);
  // Rounded to 0.01px: server and browser can differ in the last digits of Math.log, which React reports as a hydration mismatch.
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const x = (v: number) => r2(PAD.l + ((t(v) - lo) / (hi - lo || 1)) * innerW);
  const maxC = Math.max(1, ...counts);
  const y = (c: number) => r2(PAD.t + innerH - (c / maxC) * innerH);

  const yTicks = useMemo(() => niceTicks(maxC, 4), [maxC]);
  // Round-number ticks on a linear axis; evenly spaced (in log space) on a log axis. Fewer on narrow screens.
  const nTicks = Math.max(3, Math.min(8, Math.floor(innerW / 90)));
  const xTicks = useMemo(() => {
    if (!log) return scaleLinear().domain([lo, hi]).ticks(nTicks);
    return Array.from({ length: nTicks + 1 }, (_, i) => Math.exp(lo + ((hi - lo) * i) / nTicks));
  }, [lo, hi, log, nTicks]);

  const inRange = (v: number | null | undefined) => v !== null && v !== undefined && t(v) >= lo && t(v) <= hi;
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <figure className="w-full">
      <figcaption className="text-sm font-medium text-ink mb-1">{title}</figcaption>
      <div className="relative" ref={box}>
        <div>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-labelledby={`${id}-desc`}>
            <desc id={`${id}-desc`}>
              Histogram of {xLabel}, {total} records{marker != null ? `; marked value ${fx(marker)}` : ""}.
            </desc>
            {yTicks.map((tv) => (
              <g key={tv}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(tv)} y2={y(tv)} stroke="var(--grid)" strokeWidth={1} />
                <text x={PAD.l - 6} y={y(tv) + 4} textAnchor="end" fontSize={12} fill="var(--muted)" className="tabular">
                  {tv.toLocaleString("en-IN")}
                </text>
              </g>
            ))}
            {counts.map((c, i) => {
              const x0 = x(edges[i]);
              const x1 = x(edges[i + 1]);
              const w = Math.max(1, r2(x1 - x0 - 2));
              const h = r2((c / maxC) * innerH);
              return (
                <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  <rect x={x0} y={PAD.t} width={Math.max(1, x1 - x0)} height={innerH} fill="transparent" />
                  {c > 0 && <BarPath x={x0 + 1} y={y(c)} w={w} h={h} fill={i === highlight ? "var(--series-2)" : "var(--series-1)"} opacity={hover === null || hover === i ? 1 : 0.55} />}
                </g>
              );
            })}
            <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + innerH} y2={PAD.t + innerH} stroke="var(--axis)" strokeWidth={1} />
            {xTicks.map((tv, i) => (
              // A label near the right edge is right-aligned so it isn't clipped.
              <text key={i} x={x(tv)} y={H - PAD.b + 16} textAnchor={x(tv) > W - PAD.r - 28 ? "end" : "middle"} fontSize={12} fill="var(--muted)" className="tabular">
                {fx(tv)}
              </text>
            ))}
            <text x={PAD.l + innerW / 2} y={H - 4} textAnchor="middle" fontSize={12} fill="var(--ink-2)">
              {xLabel}
              {log ? " (log scale)" : ""}
            </text>
            {refs.filter((r) => inRange(r.value)).map((r) => (
              <g key={r.label}>
                <line x1={x(r.value)} x2={x(r.value)} y1={PAD.t - 4} y2={PAD.t + innerH} stroke="var(--ink-2)" strokeWidth={1} strokeDasharray="0" opacity={0.7} />
                <text x={x(r.value) + 4} y={PAD.t + 6} fontSize={12} fill="var(--ink)" stroke="var(--surface)" strokeWidth={4} paintOrder="stroke" strokeLinejoin="round">
                  {r.label}
                </text>
              </g>
            ))}
            {inRange(marker) && (
              <g>
                <line x1={x(marker!)} x2={x(marker!)} y1={PAD.t - 12} y2={PAD.t + innerH} stroke="var(--series-2)" strokeWidth={2} />
                <circle cx={x(marker!)} cy={PAD.t - 12} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
                <text x={x(marker!) + (x(marker!) > W * 0.7 ? -8 : 8)} y={PAD.t - 8} fontSize={12} fontWeight={600} fill="var(--ink)" textAnchor={x(marker!) > W * 0.7 ? "end" : "start"}>
                  {markerLabel ?? "This record"}: {fx(marker!)}
                </text>
              </g>
            )}
          </svg>
        </div>
        {hover !== null && (
          <div
            className="tooltip pointer-events-none absolute top-0 z-10 tabular"
            style={{ left: `${(x((edges[hover] + edges[hover + 1]) / 2) / W) * 100}%`, transform: "translateX(-50%)" }}
          >
            {fx(edges[hover])} – {fx(edges[hover + 1])}: <strong>{counts[hover].toLocaleString("en-IN")}</strong>
          </div>
        )}
      </div>
    </figure>
  );
}

/** Column with a 4px rounded data-end and a square baseline. */
export function BarPath({ x, y, w, h, fill, opacity = 1 }: { x: number; y: number; w: number; h: number; fill: string; opacity?: number }) {
  const r = Math.min(4, w / 2, h);
  const d = `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`;
  return <path d={d} fill={fill} opacity={opacity} />;
}

export function niceTicks(max: number, n: number): number[] {
  if (max <= 0) return [0];
  const raw = max / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) out.push(Math.round(v));
  return out;
}
