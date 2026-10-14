"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MLMap, MapGeoJSONFeature } from "maplibre-gl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { classBreaks, computeStats, formatMetric, METRICS, metricValue, NO_DATA, RAMPS, type AreaStat, type MetricKey } from "@/lib/areaStats";
import type { Fact } from "@/lib/facts";
import { useJson } from "@/lib/useJson";

type FC = { type: "FeatureCollection"; attribution?: string; features: { type: "Feature"; properties: Record<string, unknown>; geometry: unknown }[] };
export type Level = "areas" | "wards";

const CENTER: [number, number] = [77.59, 12.97];
const DOT_COLORS: Record<string, string> = { "1": "#eb6834", "2": "#2a78d6", "3+": "#1baf7a", unknown: "#9a9890" };

function hash(n: number) {
  let x = n | 0;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  x = ((x >>> 16) ^ x) * 0x45d9f3b;
  return ((x >>> 16) ^ x) >>> 0;
}

export type MapSelection = { level: Level; id: string } | null;

export function CityMap({
  rows,
  metricKey,
  level,
  threeD,
  showDots,
  selection,
  onSelect,
  onStats,
}: {
  rows: Fact[];
  metricKey: MetricKey;
  level: Level;
  threeD: boolean;
  showDots: boolean;
  selection: MapSelection;
  onSelect: (s: MapSelection) => void;
  onStats?: (s: { areas: Map<string, AreaStat>; wards: Map<string, AreaStat>; breaks: number[]; areaGeo: FC | null; wardGeo: FC | null }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; w: number; title: string; sub: string; value: string; n: string } | null>(null);
  const router = useRouter();
  const { data: areaGeo } = useJson<FC>("geo/areas.geojson");
  const { data: wardGeo } = useJson<FC>("geo/wards.geojson");
  const { data: corpGeo } = useJson<FC>("geo/corporations.geojson");
  const metric = METRICS.find((m) => m.key === metricKey)!;

  const areaStats = useMemo(() => computeStats(rows, (r) => (r.area == null ? null : String(r.area))), [rows]);
  const wardStats = useMemo(() => computeStats(rows, (r) => r.ward), [rows]);
  const pop = useMemo(() => {
    const p = new Map<string, number>();
    for (const f of areaGeo?.features ?? []) p.set(`a:${f.properties.ac_no}`, Number(f.properties.population) || 0);
    for (const f of wardGeo?.features ?? []) p.set(`w:${f.properties.key}`, Number(f.properties.population) || 0);
    return p;
  }, [areaGeo, wardGeo]);

  const values = useMemo(() => {
    const stats = level === "areas" ? areaStats : wardStats;
    const feats = (level === "areas" ? areaGeo : wardGeo)?.features ?? [];
    const out = new Map<string, { value: number | null; n: number }>();
    for (const f of feats) {
      const id = String(level === "areas" ? f.properties.ac_no : f.properties.key);
      out.set(id, metricValue(stats.get(id), metric, pop.get(`${level === "areas" ? "a" : "w"}:${id}`)));
    }
    return out;
  }, [level, areaStats, wardStats, areaGeo, wardGeo, metric, pop]);

  const breaks = useMemo(() => classBreaks([...values.values()].map((v) => v.value).filter((v): v is number => v != null)), [values]);

  useEffect(() => {
    onStats?.({ areas: areaStats, wards: wardStats, breaks, areaGeo, wardGeo });
  }, [areaStats, wardStats, breaks, areaGeo, wardGeo, onStats]);

  // ---- create the map once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    let cancelled = false;
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !ref.current) return;
      const map = new maplibregl.Map({
        container: ref.current,
        style: `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`,
        center: CENTER,
        zoom: 10.2,
        minZoom: 9,
        maxZoom: 16,
        attributionControl: { compact: true, customAttribution: "Boundaries: GBA delimitation 2025 via OpenCity (public domain) · Tenders: KPPP" },
        cooperativeGestures: false,
      });
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      map.on("load", () => {
        if (!cancelled) setReady(true);
      });
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- add sources/layers once data + map are ready
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !areaGeo || !wardGeo || map.getSource("areas")) return;
    const firstSymbol = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
    map.addSource("areas", { type: "geojson", data: areaGeo as never, promoteId: "ac_no" });
    map.addSource("wards", { type: "geojson", data: wardGeo as never, promoteId: "key" });
    if (corpGeo) map.addSource("corps", { type: "geojson", data: corpGeo as never });
    map.addSource("area-labels", {
      type: "geojson",
      data: { type: "FeatureCollection", features: areaGeo.features.map((f) => ({ type: "Feature", properties: { name: f.properties.name }, geometry: { type: "Point", coordinates: [f.properties.cx, f.properties.cy] } })) } as never,
    });
    map.addSource("dots", { type: "geojson", data: { type: "FeatureCollection", features: [] } as never });

    for (const lvl of ["areas", "wards"] as const) {
      map.addLayer({ id: `${lvl}-fill`, type: "fill", source: lvl, paint: { "fill-color": NO_DATA, "fill-opacity": 0.72 } }, firstSymbol);
      map.addLayer(
        {
          id: `${lvl}-extrude`,
          type: "fill-extrusion",
          source: lvl,
          layout: { visibility: "none" },
          paint: { "fill-extrusion-color": NO_DATA, "fill-extrusion-height": 0, "fill-extrusion-opacity": 0.85 },
        },
        firstSymbol,
      );
      map.addLayer(
        {
          id: `${lvl}-line`,
          type: "line",
          source: lvl,
          paint: {
            "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#0b0b0b", ["boolean", ["feature-state", "hover"], false], "#3a3a3a", "#ffffff"],
            "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, ["boolean", ["feature-state", "hover"], false], 2, lvl === "areas" ? 1 : 0.4],
          },
        },
        firstSymbol,
      );
    }
    if (corpGeo) map.addLayer({ id: "corps-line", type: "line", source: "corps", paint: { "line-color": "#0b0b0b", "line-width": 1.6, "line-dasharray": [3, 2], "line-opacity": 0.55 } });
    map.addLayer({
      id: "area-labels",
      type: "symbol",
      source: "area-labels",
      layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 9, 9, 12, 13], "text-allow-overlap": false },
      paint: { "text-color": "#1f1f1e", "text-halo-color": "rgba(255,255,255,0.85)", "text-halo-width": 1.4 },
    });
    map.addLayer({
      id: "dots",
      type: "circle",
      source: "dots",
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 14, 6],
        "circle-color": ["match", ["get", "g"], "1", DOT_COLORS["1"], "2", DOT_COLORS["2"], "3+", DOT_COLORS["3+"], DOT_COLORS.unknown],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1,
        "circle-opacity": 0.9,
      },
    });

    // hover + click
    let hovered: { src: string; id: string | number } | null = null;
    const setHover = (src: string, id: string | number | null) => {
      if (hovered) map.setFeatureState({ source: hovered.src, id: hovered.id }, { hover: false });
      hovered = id == null ? null : { src, id };
      if (hovered) map.setFeatureState({ source: hovered.src, id: hovered.id }, { hover: true });
    };
    for (const lvl of ["areas", "wards"] as const) {
      for (const layer of [`${lvl}-fill`, `${lvl}-extrude`]) {
        map.on("mousemove", layer, (e) => {
          const f = e.features?.[0] as MapGeoJSONFeature | undefined;
          if (!f) return;
          map.getCanvas().style.cursor = "pointer";
          setHover(lvl, f.id as string | number);
          window.dispatchEvent(new CustomEvent("civictrace:hover", { detail: { lvl, id: String(f.id), x: e.point.x, y: e.point.y, props: f.properties } }));
        });
        map.on("mouseleave", layer, () => {
          map.getCanvas().style.cursor = "";
          setHover(lvl, null);
          window.dispatchEvent(new CustomEvent("civictrace:hover", { detail: null }));
        });
        map.on("click", layer, (e) => {
          const f = e.features?.[0];
          if (f) window.dispatchEvent(new CustomEvent("civictrace:select", { detail: { level: lvl, id: String(f.id) } }));
        });
      }
    }
    map.on("click", "dots", (e) => {
      const f = e.features?.[0];
      if (f) window.dispatchEvent(new CustomEvent("civictrace:open", { detail: f.properties?.nit }));
    });
    map.on("mouseenter", "dots", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "dots", () => (map.getCanvas().style.cursor = ""));
  }, [ready, areaGeo, wardGeo, corpGeo]);

  // ---- events from map → React (keeps handlers above stable)
  useEffect(() => {
    const onHover = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d) return setTip(null);
      const v = values.get(d.id);
      const title = d.lvl === "areas" ? `${d.props.name}` : `${d.props.name}`;
      const sub = d.lvl === "areas" ? `${d.props.corporations ?? ""} · assembly constituency area` : `Ward in ${d.props.ac} · ${d.props.corporation} corporation`;
      setTip({ x: d.x, y: d.y, w: ref.current?.clientWidth ?? 600, title, sub, value: formatMetric(v?.value ?? null, metric), n: v ? `${v.n.toLocaleString("en-IN")} records` : "no records" });
    };
    const onSel = (e: Event) => onSelect((e as CustomEvent).detail);
    const onOpen = (e: Event) => router.push(`/tender/?id=${(e as CustomEvent).detail}`);
    window.addEventListener("civictrace:hover", onHover);
    window.addEventListener("civictrace:select", onSel);
    window.addEventListener("civictrace:open", onOpen);
    return () => {
      window.removeEventListener("civictrace:hover", onHover);
      window.removeEventListener("civictrace:select", onSel);
      window.removeEventListener("civictrace:open", onOpen);
    };
  }, [values, metric, onSelect, router]);

  // ---- paint: colours, extrusion, visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !map.getLayer("areas-fill")) return;
    const ramp = RAMPS[metric.kind];
    const colorFor = (v: number | null) => {
      if (v == null) return NO_DATA;
      let i = 0;
      while (i < breaks.length && v >= breaks[i]) i++;
      return ramp[Math.min(ramp.length - 1, Math.round((i / Math.max(1, breaks.length)) * (ramp.length - 1)))];
    };
    const maxV = Math.max(1e-9, ...[...values.values()].map((v) => v.value ?? 0));
    const color: unknown[] = ["match", ["to-string", ["id"]]];
    const height: unknown[] = ["match", ["to-string", ["id"]]];
    const opacity: unknown[] = ["match", ["to-string", ["id"]]];
    for (const [id, v] of values) {
      color.push(id, colorFor(v.value));
      opacity.push(id, v.value == null ? 0.18 : 0.78);
      height.push(id, v.value == null ? 0 : 200 + (v.value / maxV) * (level === "areas" ? 6000 : 3000));
    }
    color.push(NO_DATA);
    height.push(0);
    opacity.push(0.18);
    const cExpr = (values.size ? color : NO_DATA) as never;
    const hExpr = (values.size ? height : 0) as never;
    for (const lvl of ["areas", "wards"] as const) {
      const active = lvl === level;
      map.setLayoutProperty(`${lvl}-fill`, "visibility", active && !threeD ? "visible" : "none");
      map.setLayoutProperty(`${lvl}-extrude`, "visibility", active && threeD ? "visible" : "none");
      map.setLayoutProperty(`${lvl}-line`, "visibility", active ? "visible" : "none");
      if (active) {
        map.setPaintProperty(`${lvl}-fill`, "fill-color", cExpr);
        map.setPaintProperty(`${lvl}-fill`, "fill-opacity", (values.size ? opacity : 0.18) as never);
        map.setPaintProperty(`${lvl}-extrude`, "fill-extrusion-color", cExpr);
        map.setPaintProperty(`${lvl}-extrude`, "fill-extrusion-height", hExpr);
      }
    }
    map.setLayoutProperty("area-labels", "visibility", level === "areas" ? "visible" : "none");
    map.easeTo({ pitch: threeD ? 55 : 0, bearing: threeD ? -17 : 0, duration: 800 });
  }, [ready, values, breaks, metric, level, threeD]);

  // ---- tender dots (placed at the named ward, jittered deterministically)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !wardGeo || !map.getSource("dots")) return;
    const centers = new Map<string, [number, number]>();
    for (const f of wardGeo.features) centers.set(String(f.properties.key), [Number(f.properties.cx), Number(f.properties.cy)]);
    const feats = [];
    for (const r of rows) {
      if (!r.ward || !r.selection) continue;
      const c = centers.get(r.ward);
      if (!c) continue;
      const h = hash(r.nit);
      const ang = ((h % 3600) / 3600) * Math.PI * 2;
      const rad = 0.0006 + ((h >>> 12) % 1000) / 1000 * 0.0028;
      const g = r.bidders == null ? "unknown" : r.bidders <= 1 ? "1" : r.bidders === 2 ? "2" : "3+";
      feats.push({ type: "Feature", properties: { nit: r.nit, g }, geometry: { type: "Point", coordinates: [c[0] + Math.cos(ang) * rad, c[1] + Math.sin(ang) * rad] } });
    }
    (map.getSource("dots") as GeoJSONSource).setData({ type: "FeatureCollection", features: feats } as never);
    map.setLayoutProperty("dots", "visibility", showDots ? "visible" : "none");
  }, [ready, rows, wardGeo, showDots]);

  // ---- selection highlight + fly
  const prevSel = useRef<MapSelection>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !map.getSource("areas")) return;
    const fid = (s: NonNullable<MapSelection>) => (s.level === "areas" ? Number(s.id) : s.id);
    if (prevSel.current) map.setFeatureState({ source: prevSel.current.level, id: fid(prevSel.current) }, { selected: false });
    prevSel.current = selection;
    if (!selection) return;
    map.setFeatureState({ source: selection.level, id: fid(selection) }, { selected: true });
    const geo = selection.level === "areas" ? areaGeo : wardGeo;
    const f = geo?.features.find((x) => String(selection.level === "areas" ? x.properties.ac_no : x.properties.key) === selection.id);
    if (f) map.flyTo({ center: [Number(f.properties.cx), Number(f.properties.cy)], zoom: selection.level === "areas" ? 11.6 : 13.6, duration: 900 });
  }, [ready, selection, areaGeo, wardGeo]);

  return (
    <div className="relative h-full w-full">
      {/* maplibre's CSS sets position:relative on the container, so size it explicitly */}
      <div ref={ref} style={{ width: "100%", height: "100%" }} aria-label="Map of Bengaluru" role="region" />
      {!ready && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">Loading the map…</div>}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 w-64 rounded-md border border-line bg-surface p-3 text-xs shadow-lg"
          style={{ left: Math.min(tip.x + 14, tip.w - 270), top: Math.max(8, tip.y - 10) }}
        >
          <div className="font-semibold text-ink text-sm">{tip.title}</div>
          <div className="text-muted">{tip.sub}</div>
          <div className="mt-1.5 text-ink">
            {metric.label}: <strong>{tip.value}</strong>
          </div>
          <div className="text-muted">{tip.n} · click for the full profile</div>
        </div>
      )}
    </div>
  );
}
