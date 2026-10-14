"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Term } from "@/components/Term";
import { formatMetric, METRICS, metricValue, NO_DATA, RAMPS, type AreaStat, type MetricKey } from "@/lib/areaStats";
import type { Fact } from "@/lib/facts";
import { BIDDER_COLORS } from "@/lib/facts";
import { inr } from "@/lib/format";

import { CityMap, type Level, type MapSelection } from "./CityMap";

type Geo = { features: { properties: Record<string, unknown> }[] } | null;
type Stats = { areas: Map<string, AreaStat>; wards: Map<string, AreaStat>; breaks: number[]; areaGeo: Geo; wardGeo: Geo };

export function MapExplorer({
  rows,
  names,
  fys,
  fy,
  setFy,
  area,
  setArea,
}: {
  rows: Fact[];
  names: Record<string, string>;
  fys: string[];
  fy: string;
  setFy: (v: string) => void;
  area: string;
  setArea: (v: string) => void;
}) {
  const [metricKey, setMetricKey] = useState<MetricKey>("low_comp_rate");
  const [level, setLevel] = useState<Level>("areas");
  const [threeD, setThreeD] = useState(false);
  const [showDots, setShowDots] = useState(false);
  const [wardSel, setWardSel] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [playing, setPlaying] = useState(false);
  const [query, setQuery] = useState("");
  const metric = METRICS.find((m) => m.key === metricKey)!;

  const selection: MapSelection = level === "wards" && wardSel ? { level: "wards", id: wardSel } : area ? { level: "areas", id: area } : null;
  const onSelect = useCallback(
    (s: MapSelection) => {
      if (!s) return;
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
    const t = setInterval(() => {
      const i = seq.indexOf(fy);
      setFy(seq[(i + 1) % seq.length]);
    }, 2200);
    return () => clearInterval(t);
  }, [playing, fy, fys, setFy]);

  const areaFeat = (id: string) => stats?.areaGeo?.features.find((f) => String(f.properties.ac_no) === id)?.properties;
  const wardFeat = (id: string) => stats?.wardGeo?.features.find((f) => String(f.properties.key) === id)?.properties;

  const hotspots = useMemo(() => {
    if (!stats) return [];
    const src = level === "areas" ? stats.areas : stats.wards;
    const list: { id: string; name: string; value: number; n: number }[] = [];
    for (const [id, s] of src) {
      const props = level === "areas" ? areaFeat(id) : wardFeat(id);
      if (!props) continue;
      const v = metricValue(s, metric, Number(props.population) || null);
      if (v.value != null) list.push({ id, name: String(props.name), value: v.value, n: v.n });
    }
    return list.sort((a, b) => b.value - a.value).slice(0, 6);
  }, [stats, level, metric]); // eslint-disable-line react-hooks/exhaustive-deps

  const wardNames = useMemo(
    () => (stats?.wardGeo?.features ?? []).map((f) => ({ key: String(f.properties.key), name: String(f.properties.name), ac: String(f.properties.ac) })),
    [stats],
  );
  const searchHits = query.length >= 2 ? wardNames.filter((w) => w.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : [];

  const sel = selection
    ? selection.level === "areas"
      ? { stat: stats?.areas.get(selection.id), props: areaFeat(selection.id), kind: "Area" }
      : { stat: stats?.wards.get(selection.id), props: wardFeat(selection.id), kind: "Ward" }
    : null;

  return (
    <div className="card overflow-hidden">
      {/* Controls */}
      <div className="border-b border-line p-4 space-y-3">
        <div>
          <div className="text-xs text-muted mb-1.5">What should the map show?</div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Map measure">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={m.key === metricKey}
                onClick={() => setMetricKey(m.key)}
                className={`rounded-full border px-3 py-1 text-sm ${m.key === metricKey ? "border-[var(--accent)] bg-[var(--series-1-wash)] text-ink font-medium" : "border-line text-ink-2 hover:bg-surface-2"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <div className="flex rounded-md border border-line overflow-hidden" role="radiogroup" aria-label="Map detail">
            {(["areas", "wards"] as const).map((l) => (
              <button key={l} type="button" role="radio" aria-checked={level === l} onClick={() => setLevel(l)} className={`px-3 py-1 ${level === l ? "bg-surface-2 font-medium text-ink" : "text-ink-2"}`}>
                {l === "areas" ? "28 areas" : "369 wards"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-ink-2">
            <input type="checkbox" checked={threeD} onChange={(e) => setThreeD(e.target.checked)} /> 3D (height = value)
          </label>
          <label className="flex items-center gap-1.5 text-ink-2">
            <input type="checkbox" checked={showDots} onChange={(e) => setShowDots(e.target.checked)} /> Show individual contracts
          </label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPlaying((p) => !p)} className="rounded-md border border-line px-2.5 py-1 text-ink" aria-pressed={playing}>
              {playing ? "❚❚ Pause" : "▶ Play years"}
            </button>
            <span className="tabular text-ink-2 min-w-[6rem]">{fy ? `FY ${fy}` : "All years"}</span>
          </div>
          <div className="relative ml-auto">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a locality…"
              className="rounded-md border border-line bg-surface px-2 py-1 w-52"
              aria-label="Find a locality"
            />
            {searchHits.length > 0 && (
              <ul className="absolute right-0 z-20 mt-1 w-64 rounded-md border border-line bg-surface shadow-lg text-sm">
                {searchHits.map((w) => (
                  <li key={w.key}>
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left hover:bg-surface-2"
                      onClick={() => {
                        setLevel("wards");
                        setWardSel(w.key);
                        setQuery("");
                      }}
                    >
                      {w.name} <span className="text-xs text-muted">· {w.ac}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_22rem]">
        <div className="relative h-[520px] lg:h-[620px]">
          <CityMap rows={rows} metricKey={metricKey} level={level} threeD={threeD} showDots={showDots} selection={selection} onSelect={onSelect} onStats={onStats} />
          {/* Legend */}
          <div className="absolute left-3 bottom-3 z-10 max-w-[18rem] rounded-md border border-line bg-surface/95 p-3 text-xs shadow-sm">
            <div className="font-medium text-ink">{metric.label}</div>
            <div className="mt-1.5 flex items-center gap-1">
              {RAMPS[metric.kind].map((c) => (
                <span key={c} className="h-3 flex-1 rounded-sm" style={{ background: c }} />
              ))}
            </div>
            <div className="mt-0.5 flex justify-between text-muted tabular">
              <span>{stats?.breaks.length ? formatMetric(Math.min(...[...(level === "areas" ? stats.areas : stats.wards).values()].map((s) => metricValue(s, metric).value ?? Infinity)), metric) : "low"}</span>
              <span>higher →</span>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-muted">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: NO_DATA }} /> too few contracts to say (fewer than {metric.minN})
            </div>
            {showDots && (
              <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-muted">
                {(["1", "2", "3+"] as const).map((g) => (
                  <span key={g} className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: g === "1" ? "#eb6834" : g === "2" ? "#2a78d6" : "#1baf7a" }} />
                    {g === "1" ? "1 company" : g === "2" ? "2 companies" : "3 or more"}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1.5 hidden text-muted sm:block">{metric.explain}</p>
          </div>
        </div>

        {/* Side panel: profile or hotspots */}
        <aside className="border-t lg:border-t-0 lg:border-l border-line p-4 overflow-y-auto lg:h-[620px]">
          {sel && sel.props ? (
            <Profile kind={sel.kind} props={sel.props} stat={sel.stat} names={names} onClose={() => (sel.kind === "Area" ? setArea("") : setWardSel(null))} />
          ) : (
            <>
              <h3 className="font-semibold text-ink">{metric.question}</h3>
              <p className="text-xs text-muted mt-1">
                Highest {level === "areas" ? "areas" : "wards"} on this measure{fy ? ` in FY ${fy}` : ""}. Only places with enough contracts are ranked.
              </p>
              <ol className="mt-3 space-y-1.5">
                {hotspots.map((h, i) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => (level === "areas" ? setArea(h.id) : setWardSel(h.id))} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-surface-2">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="text-ink">
                          <span className="tabular text-muted mr-1.5">{i + 1}.</span>
                          {h.name}
                        </span>
                        <span className="tabular font-medium">{formatMetric(h.value, metric)}</span>
                      </div>
                      <div className="text-xs text-muted pl-5">{h.n.toLocaleString("en-IN")} records</div>
                    </button>
                  </li>
                ))}
                {!hotspots.length && <li className="text-sm text-muted">Not enough contracts placed on the map yet for this measure.</li>}
              </ol>
              <div className="mt-5 rounded-md bg-surface-2 p-3 text-xs text-ink-2 space-y-1.5">
                <p>
                  <strong className="text-ink">How tenders are placed:</strong> by the engineering division that issued them (BBMP divisions are
                  organised by assembly constituency) and by locality names in the tender title. Zone-wide departments such as lakes or
                  street lighting are left off the map rather than guessed.
                </p>
                <p>
                  Areas are <Term k="division">administrative geography</Term> only. A pattern in an area says nothing about its elected
                  representative.
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function Profile({ kind, props, stat, names, onClose }: { kind: string; props: Record<string, unknown>; stat?: AreaStat; names: Record<string, string>; onClose: () => void }) {
  const pop = Number(props.population) || null;
  const total = stat ? stat.single + stat.two + stat.threePlus : 0;
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-muted">{kind === "Area" ? "Assembly constituency area" : `Ward · ${String(props.ac)}`}</div>
          <h3 className="text-lg font-semibold text-ink">{String(props.name)}</h3>
          <div className="text-xs text-muted">
            {kind === "Area" ? (props.corporations as string[] | undefined)?.join(", ") + " corporation" : `${String(props.corporation)} corporation`}
            {pop ? ` · ${pop.toLocaleString("en-IN")} residents (2011)` : ""}
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-sm text-accent underline">
          Close
        </button>
      </div>
      {!stat ? (
        <p className="mt-3 text-sm text-muted">No contracts placed here in the current selection.</p>
      ) : (
        <div className="mt-3 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <Mini label="Tenders" value={stat.tenders.toLocaleString("en-IN")} />
            <Mini label="Winning bids" value={inr(stat.spend)} />
            <Mini label="Per resident" value={pop && stat.spend ? `₹${Math.round(stat.spend / pop).toLocaleString("en-IN")}` : "—"} />
            <Mini label="Warning signs" value={`${stat.flagged}`} sub={stat.fetched ? `in ${stat.fetched} tenders` : undefined} />
          </div>
          <div>
            <div className="text-xs text-muted mb-1">How many companies competed ({total} contracts)</div>
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
                  <span>1: {Math.round((stat.single / total) * 100)}%</span>
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
            {stat.priced ? <span className="text-xs text-muted"> ({stat.atEstimate} of {stat.priced} within 1%)</span> : null}
          </div>
          <div>
            <div className="text-xs text-muted mb-1">
              Most frequent winners{stat.top3 != null ? ` · top 3 won ${Math.round(stat.top3 * 100)}%` : ""}
            </div>
            <ul className="space-y-1">
              {stat.suppliers.slice(0, 6).map((s) => (
                <li key={s.id} className="flex justify-between gap-2">
                  <Link href={`/supplier/?id=${s.id}`} className="truncate">
                    {names[String(s.id)] ?? `Supplier ${s.id}`}
                  </Link>
                  <span className="tabular text-xs text-ink-2 whitespace-nowrap">
                    {s.wins} · {inr(s.value)}
                  </span>
                </li>
              ))}
              {!stat.suppliers.length && <li className="text-xs text-muted">No winners recorded yet.</li>}
            </ul>
          </div>
          {kind === "Area" && <p className="text-xs text-muted">All charts below now show only this area. Close to see the whole city again.</p>}
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
