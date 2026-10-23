"use client";

import { scaleBand, scaleLinear } from "d3-scale";
import { useMemo, useState } from "react";

import { niceTicks, BarPath } from "@/components/charts/Histogram";
import { BIDDER_COLORS, BIDDER_LABELS, type Fact } from "@/lib/facts";
import { useWidth } from "@/lib/useWidth";

const P = { l: 48, r: 12, t: 12, b: 28 };
const FONT = 12;

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
  const [box, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return <p className="text-sm text-muted">Not enough months in this selection yet.</p>;
  const H = 220;
  const x = scaleBand<string>().domain(data.map((d) => d.month)).range([P.l, W - P.r]).paddingInner(0.15);
  const max = Math.max(...data.map((d) => d.n));
  const ticks = niceTicks(max, 4);
  const y = scaleLinear().domain([0, Math.max(max, ticks[ticks.length - 1])]).range([H - P.b, P.t]);
  const bw = Math.max(2, Math.min(24, x.bandwidth()));
  // A label at least every ~60px, so they never run into each other.
  const every = Math.max(1, Math.ceil(60 / x.step()));
  return (
    <div className="relative" ref={box}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label="Tenders published per month">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={P.l - 6} y={y(t) + 4} fontSize={FONT} textAnchor="end" fill="var(--muted)" className="tabular">
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
                <text x={cx} y={H - 8} fontSize={FONT} textAnchor="middle" fill="var(--muted)">
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

const MIX = ["1", "2", "3+"] as const;
type Mix = { q: string; n: number } & Record<(typeof MIX)[number], number>;

/** Open contracts with a winner and a published bidder count, by quarter and by number of bidders. */
export function quarterMix(rows: Fact[], minPerQuarter = 10): Mix[] {
  const m = new Map<string, Mix>();
  for (const r of rows) {
    if (r.selection == null || r.bidders == null || r.tenderType !== "OPEN" || r.month === "—") continue;
    const [yy, mm] = r.month.split("-").map(Number);
    const q = `${yy}-Q${Math.floor((mm - 1) / 3) + 1}`;
    const e = m.get(q) ?? { q, n: 0, "1": 0, "2": 0, "3+": 0 };
    e.n += 1;
    e[r.bidders <= 1 ? "1" : r.bidders === 2 ? "2" : "3+"] += 1;
    m.set(q, e);
  }
  return [...m.values()].filter((e) => e.n >= minPerQuarter).sort((a, b) => a.q.localeCompare(b.q));
}

/**
 * How many companies competed, quarter by quarter, as 100% stacked columns (1 at the bottom).
 * The top of the blue segment is the share with two or fewer, so a falling orange band with
 * a growing blue one reads as "one-bidder contracts became two-bidder ones", not as more competition.
 */
export function CompetitionTrend({ rows }: { rows: Fact[] }) {
  const data = useMemo(() => quarterMix(rows), [rows]);
  const [box, W] = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return <p className="text-sm text-muted">Not enough contracts with published bidder counts in this selection yet (at least 10 per quarter needed).</p>;
  const H = 240;
  const pb = 40; // two rows of labels: quarter, then year
  const x = scaleBand<string>().domain(data.map((d) => d.q)).range([P.l, W - P.r]).paddingInner(0.2);
  const y = scaleLinear().domain([0, 1]).range([H - pb, P.t]);
  const bw = Math.min(40, x.bandwidth());
  const every = Math.max(1, Math.ceil(28 / x.step()));
  return (
    <div className="relative" ref={box}>
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Legend">
        {MIX.map((g) => (
          <li key={g} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BIDDER_COLORS[g] }} />
            {BIDDER_LABELS[g]}
          </li>
        ))}
      </ul>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block max-w-full" role="img" aria-label="How many companies competed for open contracts, by quarter" onMouseLeave={() => setHover(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={P.l - 6} y={y(t) + 4} fontSize={FONT} textAnchor="end" fill="var(--muted)" className="tabular">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = x(d.q)! + x.bandwidth() / 2;
          let acc = 0;
          const [year, quarter] = d.q.split("-");
          const showYear = i === 0 || quarter === "Q1";
          return (
            <g key={d.q} onMouseEnter={() => setHover(i)} opacity={hover === null || hover === i ? 1 : 0.55}>
              <rect x={x(d.q)} y={P.t} width={x.bandwidth()} height={H - P.t - pb} fill="transparent" />
              {MIX.map((g, gi) => {
                const share = d[g] / d.n;
                if (!share) return null;
                const y0 = y(acc), y1 = y(acc + share);
                acc += share;
                const gap = gi > 0 ? 2 : 0; // 2px surface gap between stacked segments
                return gi === MIX.length - 1 ? (
                  <BarPath key={g} x={cx - bw / 2} y={y1} w={bw} h={Math.max(0, y0 - y1 - gap)} fill={BIDDER_COLORS[g]} />
                ) : (
                  <rect key={g} x={cx - bw / 2} y={y1} width={bw} height={Math.max(0, y0 - y1 - gap)} fill={BIDDER_COLORS[g]} />
                );
              })}
              {i % every === 0 && (
                <text x={cx} y={H - pb + 16} fontSize={FONT} textAnchor="middle" fill="var(--muted)">
                  {quarter}
                </text>
              )}
              {showYear && (
                <text x={x(d.q)} y={H - 6} fontSize={FONT} textAnchor="start" fill="var(--ink-2)" className="tabular">
                  {year}
                </text>
              )}
            </g>
          );
        })}
        <line x1={P.l} x2={W - P.r} y1={y(0)} y2={y(0)} stroke="var(--axis)" />
      </svg>
      {hover !== null && (
        <div className="tooltip pointer-events-none absolute top-6 z-10 tabular" style={{ left: `${Math.min(85, Math.max(15, ((x(data[hover].q)! + x.bandwidth() / 2) / W) * 100))}%`, transform: "translateX(-50%)" }}>
          <div className="font-medium">{data[hover].q.replace("-", " ")} · {data[hover].n} contracts</div>
          {MIX.map((g) => (
            <div key={g}>
              {BIDDER_LABELS[g]}: <strong>{Math.round((data[hover][g] / data[hover].n) * 100)}%</strong> ({data[hover][g]})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
