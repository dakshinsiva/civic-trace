"use client";

import { Delaunay } from "d3-delaunay";
import { scaleLinear, scaleLog } from "d3-scale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";

import { BIDDER_COLORS, BIDDER_LABELS, bidderGroup, type Fact } from "@/lib/facts";
import { inr } from "@/lib/format";
import { useRecord } from "@/lib/useJson";
import type { TenderDoc } from "@/lib/types";

const W = 760, H = 380, P = { l: 64, r: 16, t: 16, b: 44 };
const GROUPS = ["1", "2", "3+", "unknown"] as const;

/**
 * Each dot is one contract: how big the job was (x) against how far the winning
 * price was from the official estimate (y). Hover for details; click to open.
 */
export function PriceScatter({ rows }: { rows: Fact[] }) {
  const pts = useMemo(
    () =>
      rows
        .filter((r) => r.ecv && r.bid && r.ecv > 0 && r.bid > 0)
        .map((r) => ({ r, ratio: r.bid! / r.ecv!, g: bidderGroup(r.bidders) }))
        .filter((p) => p.ratio >= 0.2 && p.ratio <= 5),
    [rows],
  );
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const router = useRouter();

  const visible = pts.filter((p) => !hidden.has(p.g));
  const xDomain = useMemo(() => {
    const v = pts.map((p) => p.r.ecv!);
    return v.length ? [Math.max(1e4, Math.min(...v) * 0.9), Math.max(...v) * 1.1] : [1e5, 1e8];
  }, [pts]);
  const yMax = useMemo(() => Math.min(60, Math.max(15, ...pts.map((p) => Math.abs(p.ratio - 1) * 100 + 3))), [pts]);
  const x = scaleLog().domain(xDomain).range([P.l, W - P.r]);
  const y = scaleLinear().domain([-yMax, yMax]).range([H - P.b, P.t]).clamp(true);
  const delaunay = useMemo(
    () => Delaunay.from(visible, (p) => x(p.r.ecv!), (p) => y((p.ratio - 1) * 100)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, xDomain, yMax],
  );

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || !visible.length) return;
    const rect = svg.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    const my = ((e.clientY - rect.top) / rect.height) * H;
    const i = delaunay.find(mx, my);
    const p = visible[i];
    const dist = Math.hypot(x(p.r.ecv!) - mx, y((p.ratio - 1) * 100) - my);
    setHover(dist < 24 ? i : null);
  };
  const hp = hover != null ? visible[hover] : null;
  const counts = Object.fromEntries(GROUPS.map((g) => [g, pts.filter((p) => p.g === g).length]));
  const xTicks = [1e5, 1e6, 1e7, 1e8, 1e9].filter((t) => t >= xDomain[0] && t <= xDomain[1]);
  const tickLabel = (t: number) => (t >= 1e7 ? `₹${t / 1e7} cr` : `₹${t / 1e5} lakh`);

  if (!pts.length) return <p className="text-sm text-muted">No contracts with both an estimate and a winning price in this selection yet.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2" role="group" aria-label="Show or hide groups">
        <span className="text-xs text-muted mr-1">Companies that competed on price:</span>
        {GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={!hidden.has(g)}
            onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(g)) n.delete(g); else n.add(g); return n; })}
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${hidden.has(g) ? "border-line text-muted opacity-60" : "border-line bg-surface text-ink"}`}
          >
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: BIDDER_COLORS[g] }} />
            {BIDDER_LABELS[g]} <span className="tabular text-muted">{counts[g].toLocaleString("en-IN")}</span>
          </button>
        ))}
        <button type="button" onClick={() => setTable((t) => !t)} className="ml-auto text-xs text-accent underline">
          {table ? "Show chart" : "Show as table"}
        </button>
      </div>

      {table ? (
        <ScatterTable pts={visible} />
      ) : (
        <div className="relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto touch-none"
            role="img"
            aria-label={`Scatter of ${visible.length} contracts: estimate against winning price difference`}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onClick={() => hp && router.push(`/tender/?id=${hp.r.nit}`)}
            style={{ cursor: hp ? "pointer" : "default" }}
          >
            {/* zones */}
            <rect x={P.l} y={y(yMax)} width={W - P.l - P.r} height={y(5) - y(yMax)} fill="var(--series-2)" opacity={0.05} />
            <text x={W - P.r - 6} y={y(yMax) + 14} textAnchor="end" fontSize={11} fill="var(--ink-2)">
              Paid more than the estimate ↑
            </text>
            <text x={W - P.r - 6} y={y(-yMax) - 8} textAnchor="end" fontSize={11} fill="var(--ink-2)">
              Paid less than the estimate ↓
            </text>
            {y.ticks(6).map((t) => (
              <g key={t}>
                <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--ink-2)" : "var(--grid)"} strokeWidth={t === 0 ? 1.5 : 1} />
                <text x={P.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular">
                  {t === 0 ? "= estimate" : `${t > 0 ? "+" : ""}${t}%`}
                </text>
              </g>
            ))}
            {xTicks.map((t) => (
              <text key={t} x={x(t)} y={H - P.b + 18} textAnchor="middle" fontSize={11} fill="var(--muted)" className="tabular">
                {tickLabel(t)}
              </text>
            ))}
            <text x={(P.l + W - P.r) / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--ink-2)">
              Size of the job (official estimate, log scale) →
            </text>
            {GROUPS.filter((g) => !hidden.has(g)).flatMap((g) =>
              visible
                .filter((p) => p.g === g)
                .map((p) => (
                  <circle
                    key={p.r.nit}
                    cx={x(p.r.ecv!)}
                    cy={y((p.ratio - 1) * 100)}
                    r={g === "1" ? 4.5 : 3.5}
                    fill={BIDDER_COLORS[g]}
                    stroke="var(--surface)"
                    strokeWidth={1}
                    opacity={hp && hp !== p ? 0.35 : 0.85}
                  />
                )),
            )}
            {hp && (
              <circle cx={x(hp.r.ecv!)} cy={y((hp.ratio - 1) * 100)} r={7} fill="none" stroke="var(--ink)" strokeWidth={2} />
            )}
          </svg>
          {hp && <ScatterTip p={hp} left={(x(hp.r.ecv!) / W) * 100} top={(y((hp.ratio - 1) * 100) / H) * 100} />}
        </div>
      )}
    </div>
  );
}

function ScatterTip({ p, left, top }: { p: { r: Fact; ratio: number; g: string }; left: number; top: number }) {
  const { data } = useRecord<TenderDoc>("tenders", String(p.r.nit));
  const diff = (p.ratio - 1) * 100;
  return (
    <div
      className="pointer-events-none absolute z-10 w-72 rounded-md border border-line bg-surface p-3 text-xs shadow-lg"
      style={{ left: `${Math.min(70, Math.max(0, left - 10))}%`, top: `${top > 55 ? top - 40 : top + 4}%` }}
    >
      <div className="font-medium text-ink line-clamp-2">{data?.title ?? "Loading…"}</div>
      <div className="text-muted mt-0.5">
        {p.r.buyer} · {p.r.division}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-2 tabular">
        <span className="text-ink-2">Estimate</span>
        <span>{inr(p.r.ecv)}</span>
        <span className="text-ink-2">Winning price</span>
        <span>
          {inr(p.r.bid)} ({diff >= 0 ? "+" : ""}
          {diff.toFixed(1)}%)
        </span>
        <span className="text-ink-2">Companies competing</span>
        <span>{p.r.bidders ?? "not published"}</span>
      </div>
      {data?.selection?.supplier_name && <div className="mt-1.5 text-ink-2">Won by {data.selection.supplier_name}</div>}
      <div className="mt-1.5 text-accent">Click to open this tender</div>
    </div>
  );
}

function ScatterTable({ pts }: { pts: { r: Fact; ratio: number; g: string }[] }) {
  const sorted = [...pts].sort((a, b) => Math.abs(b.ratio - 1) - Math.abs(a.ratio - 1)).slice(0, 200);
  return (
    <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
      <table className="data">
        <thead>
          <tr>
            <th>Tender</th>
            <th>Where</th>
            <th className="num">Estimate</th>
            <th className="num">Winning price</th>
            <th className="num">Difference</th>
            <th className="num">Companies</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.r.nit}>
              <td>
                <Link href={`/tender/?id=${p.r.nit}`}>Open</Link>
              </td>
              <td className="text-ink-2">
                {p.r.buyer} · {p.r.division}
              </td>
              <td className="num">{inr(p.r.ecv)}</td>
              <td className="num">{inr(p.r.bid)}</td>
              <td className="num">
                {p.ratio >= 1 ? "+" : ""}
                {((p.ratio - 1) * 100).toFixed(1)}%
              </td>
              <td className="num">{p.r.bidders ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted mt-2">Showing the 200 contracts furthest from their estimate.</p>
    </div>
  );
}
