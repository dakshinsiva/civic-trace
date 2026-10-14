"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { describe, formatMetric, METRICS, metricValue, RAMPS, type AreaStat, type MetricKey } from "@/lib/areaStats";
import type { Fact } from "@/lib/facts";
import { BIDDER_COLORS } from "@/lib/facts";
import { inr } from "@/lib/format";

import { CityMap, type Level, type MapSelection } from "./CityMap";

type Geo = { features: { properties: Record<string, unknown> }[] } | null;
type Stats = { areas: Map<string, AreaStat>; wards: Map<string, AreaStat>; areaGeo: Geo; wardGeo: Geo };

/** Ready-made views, phrased as the questions people actually ask. */
const QUICK_VIEWS: { id: string; question: string; metric: MetricKey; level: Level; dots?: boolean }[] = [
  { id: "money", question: "Where is the money going?", metric: "per_capita", level: "areas" },
  { id: "competition", question: "Where is competition weakest?", metric: "low_comp_rate", level: "areas" },
  { id: "single", question: "Where does only one company bid?", metric: "single_rate", level: "areas" },
  { id: "estimate", question: "Where do prices sit at the estimate?", metric: "at_estimate_rate", level: "areas" },
  { id: "dominate", question: "Where do a few contractors dominate?", metric: "top3_share", level: "areas" },
  { id: "contracts", question: "Show me every contract", metric: "tenders", level: "wards", dots: true },
];

export function MapExplorer({
  rows,
  names,
  fys,
  fy,
  setFy,
  area,
  setArea,
  measure,
  level,
  setView,
  focusKey = "",
}: {
  rows: Fact[];
  names: Record<string, string>;
  fys: string[];
  fy: string;
  setFy: (v: string) => void;
  area: string;
  setArea: (v: string) => void;
  measure: MetricKey;
  level: Level;
  setView: (v: { measure?: MetricKey; level?: Level }) => void;
  /** "buyer|division" from the filters; the map zooms to the region it covers. */
  focusKey?: string;
}) {
  const [showDots, setShowDots] = useState(false);
  const [wardSel, setWardSel] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState("");
  const [footprintOf, setFootprintOf] = useState<number | null>(null);
  const [resetCmd, setResetCmd] = useState(0);
  const [isFull, setIsFull] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const metric = METRICS.find((m) => m.key === measure) ?? METRICS[1];
  const activeQuick = QUICK_VIEWS.find((q) => q.metric === measure && q.level === level);

  const selection: MapSelection = level === "wards" && wardSel ? { level: "wards", id: wardSel } : area ? { level: "areas", id: area } : null;
  const onSelect = useCallback(
    (s: MapSelection) => {
      if (!s) return;
      setHintDismissed(true);
      if (s.level === "areas") setArea(s.id === area ? "" : s.id);
      else setWardSel(s.id === wardSel ? null : s.id);
    },
    [area, setArea, wardSel],
  );
  const onStats = useCallback((s: Stats) => setStats(s), []);

  // Play through financial years
  useEffect(() => {
    if (!playing) return;
    const seq = ["", ...fys];
    const t = setTimeout(() => {
      const i = seq.indexOf(fy);
      if (i === seq.length - 1) setPlaying(false);
      else setFy(seq[i + 1]);
    }, 1800);
    return () => clearTimeout(t);
  }, [playing, fy, fys, setFy]);

  // The first-visit hint goes away as soon as someone points at the map.
  useEffect(() => {
    if (hintDismissed) return;
    const off = (e: Event) => (e as CustomEvent).detail && setHintDismissed(true);
    window.addEventListener("civictrace:hover", off);
    return () => window.removeEventListener("civictrace:hover", off);
  }, [hintDismissed]);

  // Fullscreen
  useEffect(() => {
    const on = () => setIsFull(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else shellRef.current?.requestFullscreen?.();
  };

  const areaFeat = useCallback((id: string) => stats?.areaGeo?.features.find((f) => String(f.properties.ac_no) === id)?.properties, [stats]);
  const wardFeat = useCallback((id: string) => stats?.wardGeo?.features.find((f) => String(f.properties.key) === id)?.properties, [stats]);

  const ranking = useMemo(() => {
    if (!stats) return [];
    const src = level === "areas" ? stats.areas : stats.wards;
    const list: { id: string; name: string; value: number; n: number }[] = [];
    for (const [id, s] of src) {
      const props = level === "areas" ? areaFeat(id) : wardFeat(id);
      if (!props) continue;
      const v = metricValue(s, metric, Number(props.population) || null);
      if (v.value != null) list.push({ id, name: String(props.name), value: v.value, n: v.n });
    }
    return list.sort((a, b) => b.value - a.value).slice(0, 8);
  }, [stats, level, metric, areaFeat, wardFeat]);

  // Region covered by the current "who issued it / local office" filter: the areas holding at
  // least 5% of its placed tenders (so one stray placement does not zoom the map out).
  const focusFilter = focusKey.replace("|", "") ? focusKey : "";
  const fitIds = useMemo(() => {
    if (!focusFilter) return null;
    const counts = new Map<string, number>();
    let total = 0;
    for (const r of rows) {
      if (r.area == null) continue;
      counts.set(String(r.area), (counts.get(String(r.area)) ?? 0) + 1);
      total++;
    }
    return [...counts.entries()].filter(([, n]) => n >= Math.max(1, total * 0.05)).map(([id]) => id);
  }, [rows, focusFilter]);

  // Contractor footprint: places (at the current level) where it won anything
  const highlight = useMemo(() => {
    if (footprintOf == null || !stats) return null;
    const src = level === "areas" ? stats.areas : stats.wards;
    const set = new Set<string>();
    for (const [id, s] of src) if (s.suppliers.some((x) => x.id === footprintOf)) set.add(id);
    return set;
  }, [footprintOf, stats, level]);

  const wardNames = useMemo(
    () => (stats?.wardGeo?.features ?? []).map((f) => ({ key: String(f.properties.key), name: String(f.properties.name), ac: String(f.properties.ac) })),
    [stats],
  );
  const areaNames = useMemo(() => (stats?.areaGeo?.features ?? []).map((f) => ({ id: String(f.properties.ac_no), name: String(f.properties.name) })), [stats]);
  const q = query.trim().toLowerCase();
  const searchHits =
    q.length >= 2
      ? [
          ...areaNames.filter((a) => a.name.toLowerCase().includes(q)).map((a) => ({ kind: "area" as const, id: a.id, name: a.name, sub: "area" })),
          ...wardNames.filter((w) => w.name.toLowerCase().includes(q)).map((w) => ({ kind: "ward" as const, id: w.key, name: w.name, sub: `ward · ${w.ac}` })),
        ].slice(0, 8)
      : [];

  const sel = selection
    ? selection.level === "areas"
      ? { stat: stats?.areas.get(selection.id), props: areaFeat(selection.id), kind: "Area" as const }
      : { stat: stats?.wards.get(selection.id), props: wardFeat(selection.id), kind: "Ward" as const }
    : null;


  return (
    <div ref={shellRef} className={`card overflow-hidden ${isFull ? "flex flex-col bg-[var(--page)]" : ""}`}>
      {/* Quick views */}
      <div className="border-b border-line p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xl font-semibold text-ink">{activeQuick?.question ?? metric.question}</h3>
          <select
            value={measure}
            onChange={(e) => setView({ measure: e.target.value as MetricKey })}
            className="rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink-2"
            aria-label="Choose what the map shows"
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                Map shows: {m.label}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-sm text-ink-2">{metric.explain}</p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Quick views">
          {QUICK_VIEWS.map((v) => {
            const on = activeQuick?.id === v.id;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setView({ measure: v.metric, level: v.level });
                  setShowDots(!!v.dots);
                  setFootprintOf(null);
                }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition-colors ${on ? "border-[var(--accent)] bg-[var(--series-1-wash)] font-medium text-ink" : "border-line text-ink-2 hover:bg-surface-2"}`}
              >
                {v.question}
              </button>
            );
          })}
        </div>
      </div>

      <div className={`grid lg:grid-cols-[1fr_23rem] ${isFull ? "min-h-0 flex-1" : ""}`}>
        <div className={`relative ${isFull ? "h-full min-h-[60vh]" : "h-[68vh] max-h-[680px] min-h-[440px]"}`}>
          <CityMap
            rows={rows}
            metricKey={measure}
            level={level}
            showDots={showDots}
            selection={selection}
            onSelect={onSelect}
            onStats={onStats}
            highlight={highlight}
            resetCmd={resetCmd}
            fitKey={focusFilter}
            fitIds={fitIds}
          />

          {/* Top-left: detail level, layers, search */}
          <div className="absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-start gap-2 sm:max-w-[calc(100%-17rem)]">
            <div className="flex overflow-hidden rounded-md border border-line bg-surface/95 text-sm shadow-sm" role="radiogroup" aria-label="Map detail">
              {(["areas", "wards"] as const).map((l) => (
                <button key={l} type="button" role="radio" aria-checked={level === l} onClick={() => setView({ level: l })} className={`px-3 py-1.5 ${level === l ? "bg-surface-2 font-medium text-ink" : "text-ink-2"}`}>
                  {l === "areas" ? "Areas" : "Wards"}
                </button>
              ))}
            </div>
            <button type="button" aria-pressed={showDots} onClick={() => setShowDots((d) => !d)} className={`rounded-md border px-3 py-1.5 text-sm shadow-sm ${showDots ? "border-[var(--accent)] bg-surface text-ink" : "border-line bg-surface/95 text-ink-2"}`}>
              {showDots ? "✓ " : ""}Contracts
            </button>
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a place…"
                className="w-40 rounded-md border border-line bg-surface/95 px-2.5 py-1.5 text-sm shadow-sm sm:w-48"
                aria-label="Find a place"
              />
              {searchHits.length > 0 && (
                <ul className="absolute left-0 z-20 mt-1 w-64 overflow-hidden rounded-md border border-line bg-surface text-sm shadow-lg">
                  {searchHits.map((h) => (
                    <li key={`${h.kind}-${h.id}`}>
                      <button
                        type="button"
                        className="block w-full px-3 py-1.5 text-left hover:bg-surface-2"
                        onClick={() => {
                          if (h.kind === "ward") {
                            setView({ level: "wards" });
                            setWardSel(h.id);
                          } else {
                            setView({ level: "areas" });
                            setArea(h.id);
                          }
                          setQuery("");
                          setHintDismissed(true);
                        }}
                      >
                        {h.name} <span className="text-xs text-muted">· {h.sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Top-right: view controls */}
          <div className="absolute right-3 top-3 z-10 hidden flex-col items-end gap-2 sm:flex">
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setResetCmd((n) => n + 1)} className="rounded-md border border-line bg-surface/95 px-2.5 py-1.5 text-sm text-ink-2 shadow-sm" title="Show the whole city">
                ⟲ Whole city
              </button>
              <button type="button" onClick={toggleFull} className="rounded-md border border-line bg-surface/95 px-2.5 py-1.5 text-sm text-ink-2 shadow-sm" aria-pressed={isFull}>
                {isFull ? "Exit full screen" : "⤢ Full screen"}
              </button>
            </div>
          </div>

          {/* First-visit hint */}
          {!hintDismissed && !selection && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm text-[var(--page)] opacity-85 shadow-lg sm:block">
              Hover over an area for a summary · click it for the full story
            </div>
          )}

          {/* Bottom: time */}
          <div className="absolute bottom-3 left-3 right-14 z-10 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <button
              type="button"
              onClick={() => {
                if (!playing && fy === fys[fys.length - 1]) setFy("");
                setPlaying((p) => !p);
              }}
              className="shrink-0 rounded-md border border-line bg-surface/95 px-2.5 py-1.5 text-sm text-ink shadow-sm"
              aria-pressed={playing}
              aria-label={playing ? "Pause" : "Play through the years"}
            >
              {playing ? "❚❚ Pause" : "▶ Play years"}
            </button>
            {["", ...fys].map((y) => (
              <button
                key={y || "all"}
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setFy(y);
                }}
                className={`shrink-0 rounded-md border px-2.5 py-1.5 text-sm shadow-sm tabular ${fy === y ? "border-[var(--accent)] bg-surface font-medium text-ink" : "border-line bg-surface/90 text-ink-2"}`}
              >
                {y ? `FY ${y}` : "All years"}
              </button>
            ))}
          </div>
        </div>


        {/* Side panel */}
        <aside className={`overflow-y-auto border-t border-line p-4 lg:border-l lg:border-t-0 ${isFull ? "lg:h-full" : "lg:h-[min(68vh,680px)] lg:min-h-[440px]"}`}>
          {sel && sel.props ? (
            <Profile
              kind={sel.kind}
              props={sel.props}
              stat={sel.stat}
              names={names}
              metric={metric}
              footprintOf={footprintOf}
              setFootprintOf={setFootprintOf}
              onClose={() => {
                setFootprintOf(null);
                if (sel.kind === "Area") setArea("");
                else setWardSel(null);
              }}
            />
          ) : (
            <>
              <div className="text-xs uppercase tracking-wide text-muted">
                {fy ? `FY ${fy}` : "All years"} · {level === "areas" ? "28 areas" : "369 wards"}
              </div>
              <h3 className="mt-1 font-semibold text-ink">Highest on this measure</h3>
              <ol className="mt-2 space-y-1">
                {ranking.map((h, i) => {
                  const maxV = ranking[0]?.value || 1;
                  return (
                    <li key={h.id}>
                      <button type="button" onClick={() => (level === "areas" ? setArea(h.id) : setWardSel(h.id))} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-2">
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="truncate text-ink">
                            <span className="mr-1.5 text-muted tabular">{i + 1}</span>
                            {h.name}
                          </span>
                          <span className="font-medium tabular">{formatMetric(h.value, metric)}</span>
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-[var(--grid)]">
                          <div className="h-1 rounded-full" style={{ width: `${(h.value / maxV) * 100}%`, background: RAMPS[metric.kind][3] }} />
                        </div>
                        <div className="mt-0.5 text-xs text-muted">{h.n.toLocaleString("en-IN")} records</div>
                      </button>
                    </li>
                  );
                })}
                {!ranking.length && <li className="text-sm text-muted">Not enough contracts placed on the map yet for this measure.</li>}
              </ol>
              <details className="mt-5 rounded-md bg-surface-2 p-3 text-xs text-ink-2">
                <summary className="cursor-pointer font-medium text-ink">How to read this map</summary>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Point at any area for a one-line summary. The list on the right ranks places on the chosen question.</li>
                  <li>Click an area to see its full story. All the charts below then show only that area.</li>
                  <li>Inside an area&apos;s story, point at a contractor to light up (in orange) everywhere it won.</li>
                  <li>With &ldquo;Contracts&rdquo; on, each dot is one contract: orange = only one company competed, blue = two, green = three or more.</li>
                  <li>Use ctrl/⌘ + scroll, or two fingers, to zoom the map.</li>
                  <li>
                    Tenders are placed by the office that issued them and by place names in their titles. Zone-wide work, such as lakes or
                    street lights, is left off the map rather than guessed.
                  </li>
                  <li>Areas are administrative geography only. A pattern in an area says nothing about its elected representative.</li>
                </ul>
              </details>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Profile({
  kind,
  props,
  stat,
  names,
  metric,
  footprintOf,
  setFootprintOf,
  onClose,
}: {
  kind: "Area" | "Ward";
  props: Record<string, unknown>;
  stat?: AreaStat;
  names: Record<string, string>;
  metric: (typeof METRICS)[number];
  footprintOf: number | null;
  setFootprintOf: (id: number | null) => void;
  onClose: () => void;
}) {
  const pop = Number(props.population) || null;
  const total = stat ? stat.single + stat.two + stat.threePlus : 0;
  const v = metricValue(stat, metric, pop);
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">{kind === "Area" ? "Area" : `Ward in ${String(props.ac)}`}</div>
          <h3 className="text-xl font-semibold text-ink">{String(props.name)}</h3>
          <div className="text-xs text-muted">
            {kind === "Area" ? `${(props.corporations as string[] | undefined)?.join(", ")} corporation` : `${String(props.corporation)} corporation`}
            {pop ? ` · ${pop.toLocaleString("en-IN")} residents (2011)` : ""}
          </div>
        </div>
        <button type="button" onClick={onClose} className="rounded-md border border-line px-2 py-1 text-sm text-ink-2 hover:bg-surface-2">
          ✕ Close
        </button>
      </div>
      <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-sm text-ink">{describe(metric, v.value, v.n)}</p>
      {!stat ? (
        <p className="mt-3 text-sm text-muted">No contracts placed here in the current selection.</p>
      ) : (
        <div className="mt-4 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Tenders" value={stat.tenders.toLocaleString("en-IN")} />
            <Mini label="Winning bids" value={inr(stat.spend)} />
            <Mini label="Per resident" value={pop && stat.spend ? `₹${Math.round(stat.spend / pop).toLocaleString("en-IN")}` : "—"} />
            <Mini label="Warning signs" value={`${stat.flagged}`} sub={stat.fetched ? `in ${stat.fetched} tenders` : undefined} />
          </div>
          <div>
            <div className="mb-1 text-xs text-muted">How many companies competed ({total} contracts)</div>
            {total ? (
              <>
                <div className="flex h-4 overflow-hidden rounded-[4px]">
                  {(
                    [
                      ["1", stat.single],
                      ["2", stat.two],
                      ["3+", stat.threePlus],
                    ] as const
                  ).map(([g, n]) => (n ? <span key={g} style={{ width: `${(n / total) * 100}%`, background: BIDDER_COLORS[g] }} className="border-r-2 border-surface last:border-r-0" /> : null))}
                </div>
                <div className="mt-1 flex justify-between text-xs text-ink-2 tabular">
                  <span>only 1: {Math.round((stat.single / total) * 100)}%</span>
                  <span>2: {Math.round((stat.two / total) * 100)}%</span>
                  <span>3+: {Math.round((stat.threePlus / total) * 100)}%</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted">No published bidder counts yet.</p>
            )}
          </div>
          <div className="text-ink-2">
            Typical winning price:{" "}
            <strong className="text-ink">
              {stat.medianVsEstimate == null
                ? "—"
                : Math.abs(stat.medianVsEstimate) < 0.005
                  ? "right at the estimate"
                  : `${Math.abs(stat.medianVsEstimate * 100).toFixed(1)}% ${stat.medianVsEstimate < 0 ? "below" : "above"} the estimate`}
            </strong>
          </div>
          <div>
            <div className="mb-1 text-xs text-muted">
              Most frequent winners{stat.top3 != null ? ` · top 3 won ${Math.round(stat.top3 * 100)}%` : ""} · point at one to light up everywhere it won (orange)
            </div>
            <ul className="space-y-0.5">
              {stat.suppliers.slice(0, 8).map((s) => (
                <li
                  key={s.id}
                  onMouseEnter={() => setFootprintOf(s.id)}
                  onMouseLeave={() => setFootprintOf(null)}
                  className={`flex items-center justify-between gap-2 rounded px-1.5 py-1 ${footprintOf === s.id ? "bg-surface-2" : ""}`}
                >
                  <Link href={`/supplier/?id=${s.id}`} className="truncate" onFocus={() => setFootprintOf(s.id)} onBlur={() => setFootprintOf(null)}>
                    {names[String(s.id)] ?? `Supplier ${s.id}`}
                  </Link>
                  <span className="whitespace-nowrap text-xs text-ink-2 tabular">
                    {s.wins} · {inr(s.value)}
                  </span>
                </li>
              ))}
              {!stat.suppliers.length && <li className="text-xs text-muted">No winners recorded yet.</li>}
            </ul>
          </div>
          {kind === "Area" && <p className="text-xs text-muted">The charts below now show only this area. Close it to see the whole city again.</p>}
          <p className="text-xs text-muted">Winning often is not wrongdoing: local markets for small civil works can be genuinely thin.</p>
        </div>
      )}
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-3 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-semibold text-ink tabular">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}
