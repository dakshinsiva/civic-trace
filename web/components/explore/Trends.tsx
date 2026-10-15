"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import { useMemo, useState } from "react";

import { niceTicks, BarPath } from "@/components/charts/Histogram";
import type { Fact } from "@/lib/facts";

const W = 760;
const P = { l: 48, r: 12, t: 12, b: 28 };

function monthLabel(m: string) {
  const [y, mm] = m.split("-").map(Number);
  return new Date(y, mm - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

/** Tenders published each month (columns). March year-end rushes show up clearly. */
export function MonthlyVolume({ rows }: { rows: Fact[] }) {
  const data = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) if (r.month && r.month !== "—") m.set(r.month, (m.get(r.month) ?? 0) + 1);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, n]) => ({ month, n }));
  }, [rows]);
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return <p className="text-sm text-muted">Not enough months in this selection yet.</p>;
  const H = 200;
  const x = scaleBand<string>().domain(data.map((d) => d.month)).range([P.l, W - P.r]).paddingInner(0.15);
  const max = Math.max(...data.map((d) => d.n));
  const ticks = niceTicks(max, 4);
  const y = scaleLinear().domain([0, Math.max(max, ticks[ticks.length - 1])]).range([H - P.b, P.t]);
  const bw = Math.min(24, x.bandwidth());
  const every = Math.ceil(data.length / 12);
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Tenders published per month">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={P.l - 6} y={y(t) + 4} fontSize={11} textAnchor="end" fill="var(--muted)" className="tabular">
              {t.toLocaleString("en-IN")}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = x(d.month)! + x.bandwidth() / 2;
          const isMarch = d.month.endsWith("-03");
          return (
            <g key={d.month} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x(d.month)} y={P.t} width={x.bandwidth()} height={H - P.t - P.b} fill="transparent" />
              <BarPath x={cx - bw / 2} y={y(d.n)} w={bw} h={y(0) - y(d.n)} fill={isMarch ? "var(--series-2)" : "var(--series-1)"} opacity={hover === null || hover === i ? 1 : 0.55} />
              {i % every === 0 && (
                <text x={cx} y={H - 8} fontSize={10} textAnchor="middle" fill="var(--muted)">
                  {monthLabel(d.month)}
                </text>
              )}
            </g>
          );
        })}
        <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
      </svg>
      {hover !== null && (
        <div className="tooltip pointer-events-none absolute top-0 z-10 tabular" style={{ left: `${((x(data[hover].month)! + x.bandwidth() / 2) / W) * 100}%`, transform: "translateX(-50%)" }}>
          {monthLabel(data[hover].month)}: <strong>{data[hover].n.toLocaleString("en-IN")}</strong> tenders
        </div>
      )}
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "var(--series-2)" }} /> March, the last month of the financial year
      </p>
    </div>
  );
}

/** Share of contracts with only one company competing, per quarter (line, single series). */
export function SingleBidTrend({ rows }: { rows: Fact[] }) {
  const data = useMemo(() => {
    const m = new Map<string, { one: number; known: number }>();
    for (const r of rows) {
      if (r.selection == null || r.bidders == null || r.tenderType !== "OPEN" || r.month === "—") continue;
      const [yy, mm] = r.month.split("-").map(Number);
      const q = `${yy}-Q${Math.floor((mm - 1) / 3) + 1}`;
      const e = m.get(q) ?? { one: 0, known: 0 };
      e.known += 1;
      if (r.bidders <= 1) e.one += 1;
      m.set(q, e);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([q, e]) => ({ q, ...e, rate: e.one / e.known }));
  }, [rows]);
  const [hover, setHover] = useState<number | null>(null);
  const shown = data.filter((d) => d.known >= 10);
  if (shown.length < 2) return <p className="text-sm text-muted">Not enough contracts with published bidder counts in this selection yet (at least 10 per quarter needed).</p>;
  const H = 200;
  const x = scaleBand<string>().domain(shown.map((d) => d.q)).range([P.l, W - P.r]).paddingInner(0);
  const yMax = Math.max(0.3, ...shown.map((d) => d.rate)) * 1.1;
  const y = scaleLinear().domain([0, yMax]).range([H - P.b, P.t]);
  const cx = (d: { q: string }) => x(d.q)! + x.bandwidth() / 2;
  const path = shown.map((d, i) => `${i ? "L" : "M"}${cx(d)},${y(d.rate)}`).join("");
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Share of contracts with only one company competing, by quarter" onMouseLeave={() => setHover(null)}>
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={P.l - 6} y={y(t) + 4} fontSize={11} textAnchor="end" fill="var(--muted)">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        <path d={path} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {shown.map((d, i) => (
          <g key={d.q} onMouseEnter={() => setHover(i)}>
            <rect x={x(d.q)} y={P.t} width={x.bandwidth()} height={H - P.t - P.b} fill="transparent" />
            {hover === i && <line x1={cx(d)} x2={cx(d)} y1={P.t} y2={H - P.b} stroke="var(--ink-2)" strokeWidth={1} />}
            <circle cx={cx(d)} cy={y(d.rate)} r={4} fill="var(--series-2)" stroke="var(--surface)" strokeWidth={2} />
            <text x={cx(d)} y={H - 8} fontSize={10} textAnchor="middle" fill="var(--muted)">
              {d.q.replace("-", " ")}
            </text>
          </g>
        ))}
        <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
      </svg>
      {hover !== null && (
        <div className="tooltip pointer-events-none absolute top-0 z-10 tabular" style={{ left: `${(cx(shown[hover]) / W) * 100}%`, transform: "translateX(-50%)" }}>
          {shown[hover].q.replace("-", " ")}: <strong>{Math.round(shown[hover].rate * 100)}%</strong> ({shown[hover].one} of {shown[hover].known} contracts)
        </div>
      )}
    </div>
  );
}
