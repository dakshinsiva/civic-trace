"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import type { GeoJSONSource, Map as MLMap, MapGeoJSONFeature, MapMouseEvent } from "maplibre-gl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ContractCard } from "@/components/ContractCard";
import { Icon } from "@/components/Icon";

import { computeStats, describe, METRICS, metricValue, type AreaStat, type MetricKey } from "@/lib/areaStats";
import type { Fact } from "@/lib/facts";
import { useJson } from "@/lib/useJson";

type FC = { type: "FeatureCollection"; attribution?: string; features: { type: "Feature"; properties: Record<string, unknown>; geometry: unknown }[] };
export type Level = "areas" | "wards";

const CENTER: [number, number] = [77.59, 12.97];
// Outlines and hover use the site accent (--accent), per theme.
const accent = (dark: boolean) => (dark ? "#4fd9f2" : "#087a92");
const FOOTPRINT = "#eb6834";
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
  showDots,
  selection,
  onSelect,
  onStats,
  highlight = null,
  resetCmd = 0,
  fitKey = "",
  fitIds = null,
  names = {},
}: {
  rows: Fact[];
  metricKey: MetricKey;
  level: Level;
  showDots: boolean;
  selection: MapSelection;
  onSelect: (s: MapSelection) => void;
  onStats?: (s: { areas: Map<string, AreaStat>; wards: Map<string, AreaStat>; areaGeo: FC | null; wardGeo: FC | null }) => void;
  /** Ids (at the current level) to keep lit, e.g. a contractor's footprint; everything else fades. */
  highlight?: Set<string> | null;
  /** Increment to fly back to the whole city. */
  resetCmd?: number;
  /** When this key changes, zoom to fit these area numbers (empty key: whole city). */
  fitKey?: string;
  fitIds?: string[] | null;
  /** Supplier id → name, for the contract card. */
  names?: Record<string, string>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; w: number; title: string; text: string } | null>(null);
  // The contract under the pointer (or tapped, on touch screens, where it stays until closed).
  const [dot, setDot] = useState<{ nit: number; x: number; y: number; w: number; h: number; pinned: boolean } | null>(null);
  const darkRef = useRef(false);
  const router = useRouter();
  const { data: areaGeo } = useJson<FC>("geo/areas.geojson");
  const { data: wardGeo } = useJson<FC>("geo/wards.geojson");
  const { data: corpGeo } = useJson<FC>("geo/corporations.geojson");
  const metric = METRICS.find((m) => m.key === metricKey)!;

  const byNit = useMemo(() => new Map(rows.map((r) => [r.nit, r])), [rows]);
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


  useEffect(() => {
    onStats?.({ areas: areaStats, wards: wardStats, areaGeo, wardGeo });
  }, [areaStats, wardStats, areaGeo, wardGeo, onStats]);

  // ---- create the map once
  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    let cancelled = false;
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
    darkRef.current = dark;
    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !ref.current) return;
      let map: MLMap;
      try {
        map = new maplibregl.Map({
        container: ref.current,
        style: `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`,
        center: CENTER,
        zoom: 10.2,
        minZoom: 9,
        maxZoom: 16,
        attributionControl: { compact: true, customAttribution: "Boundaries: GBA delimitation 2025 via OpenCity (public domain) · Tenders: KPPP" },
        // Embedded in a scrolling page: plain scroll moves the page; ctrl/⌘+scroll or two fingers move the map.
        cooperativeGestures: true,
        });
      } catch {
        setFailed(true); // e.g. WebGL unavailable or blocked by the browser
        return;
      }
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      map.on("load", () => {
        // Start the attribution collapsed (the "i" button) so it never covers the controls.
        ref.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
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
    map.addSource("dots", { type: "geojson", data: { type: "FeatureCollection", features: [] } as never, promoteId: "nit" });
    const dark = darkRef.current;
    const ACCENT = accent(dark);

    for (const lvl of ["areas", "wards"] as const) {
      map.addLayer({ id: `${lvl}-fill`, type: "fill", source: lvl, paint: { "fill-color": ACCENT, "fill-opacity": 0.02 } }, firstSymbol);
      map.addLayer(
        {
          id: `${lvl}-line`,
          type: "line",
          source: lvl,
          paint: {
            "line-color": ["case", ["boolean", ["feature-state", "selected"], false], FOOTPRINT, ACCENT],
            "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, ["boolean", ["feature-state", "hover"], false], 2.4, lvl === "areas" ? 1.5 : 0.7],
            "line-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 1, ["boolean", ["feature-state", "hover"], false], 1, lvl === "areas" ? 0.6 : 0.4],
          },
        },
        firstSymbol,
      );
    }
    if (corpGeo) map.addLayer({ id: "corps-line", type: "line", source: "corps", paint: { "line-color": dark ? "#ededef" : "#0b0b0b", "line-width": 1.6, "line-dasharray": [3, 2], "line-opacity": 0.55 } });
    map.addLayer({
      id: "area-labels",
      type: "symbol",
      source: "area-labels",
      layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 9, 9, 12, 13], "text-allow-overlap": false },
      paint: dark
        ? { "text-color": "#ededef", "text-halo-color": "rgba(7,8,10,0.85)", "text-halo-width": 1.4 }
        : { "text-color": "#1f1f1e", "text-halo-color": "rgba(255,255,255,0.85)", "text-halo-width": 1.4 },
    });
    map.addLayer({
      id: "dots",
      type: "circle",
      source: "dots",
      // Small dots draw on top of big ones so nothing hides.
      layout: { visibility: "none", "circle-sort-key": ["-", 0, ["get", "r"]] },
      paint: {
        // Size grows with the winning price (log scale, see the legend); the hovered dot grows and gets a ring.
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          10,
          ["+", ["*", ["get", "r"], 0.7], ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 0]],
          14,
          ["+", ["*", ["get", "r"], 1.6], ["case", ["boolean", ["feature-state", "hover"], false], 4, 0]],
        ],
        "circle-color": ["match", ["get", "g"], "1", DOT_COLORS["1"], "2", DOT_COLORS["2"], "3+", DOT_COLORS["3+"], DOT_COLORS.unknown],
        "circle-stroke-color": ["case", ["boolean", ["feature-state", "hover"], false], dark ? "#ffffff" : "#0a0b0d", dark ? "rgba(7,8,10,0.8)" : "#ffffff"],
        "circle-stroke-width": ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1],
        "circle-opacity": 0.92,
      },
    });

    // hover + click
    let hovered: { src: string; id: string | number } | null = null;
    const setHover = (src: string, id: string | number | null) => {
      if (hovered) map.setFeatureState({ source: hovered.src, id: hovered.id }, { hover: false });
      hovered = id == null ? null : { src, id };
      if (hovered) map.setFeatureState({ source: hovered.src, id: hovered.id }, { hover: true });
    };
    // Dots sit above the areas: while the pointer is on a dot, the area under it neither shows its summary nor selects.
    const dotAt = (e: MapMouseEvent) => map.getLayoutProperty("dots", "visibility") === "visible" && map.queryRenderedFeatures(e.point, { layers: ["dots"] }).length > 0;
    for (const lvl of ["areas", "wards"] as const) {
      for (const layer of [`${lvl}-fill`]) {
        map.on("mousemove", layer, (e) => {
          const f = e.features?.[0] as MapGeoJSONFeature | undefined;
          if (!f || dotAt(e)) return;
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
          if (f && !dotAt(e)) window.dispatchEvent(new CustomEvent("civictrace:select", { detail: { level: lvl, id: String(f.id) } }));
        });
      }
    }
    const canvasSize = () => ({ w: map.getCanvas().clientWidth, h: map.getCanvas().clientHeight });
    map.on("mousemove", "dots", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      setHover("dots", f.id as number);
      window.dispatchEvent(new CustomEvent("civictrace:hover", { detail: null }));
      window.dispatchEvent(new CustomEvent("civictrace:dot", { detail: { nit: Number(f.properties?.nit), x: e.point.x, y: e.point.y, ...canvasSize(), pinned: false } }));
    });
    map.on("mouseleave", "dots", () => {
      map.getCanvas().style.cursor = "";
      setHover("dots", null);
      window.dispatchEvent(new CustomEvent("civictrace:dot", { detail: null }));
    });
    // With a mouse, a click opens the record. On a touch screen there is no hover, so a tap pins the card instead.
    map.on("click", "dots", (e) => {
      const f = e.features?.[0];
      if (!f) return;
      if (window.matchMedia("(hover: hover)").matches) window.dispatchEvent(new CustomEvent("civictrace:open", { detail: f.properties?.nit }));
      else window.dispatchEvent(new CustomEvent("civictrace:dot", { detail: { nit: Number(f.properties?.nit), x: e.point.x, y: e.point.y, ...canvasSize(), pinned: true } }));
    });
  }, [ready, areaGeo, wardGeo, corpGeo]);

  // ---- events from map → React (keeps handlers above stable)
  useEffect(() => {
    const onHover = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d) return setTip(null);
      const v = values.get(d.id);
      setTip({ x: d.x, y: d.y, w: ref.current?.clientWidth ?? 600, title: String(d.props.name), text: describe(metric, v?.value ?? null, v?.n ?? 0) });
    };
    const onDot = (e: Event) => {
      const d = (e as CustomEvent).detail;
      // A pinned card (touch) stays until closed or another dot is tapped; hover-leave does not clear it.
      setDot((cur) => (d ? d : cur?.pinned ? cur : null));
    };
    const onSel = (e: Event) => onSelect((e as CustomEvent).detail);
    const onOpen = (e: Event) => router.push(`/tender/?id=${(e as CustomEvent).detail}`);
    window.addEventListener("civictrace:hover", onHover);
    window.addEventListener("civictrace:dot", onDot);
    window.addEventListener("civictrace:select", onSel);
    window.addEventListener("civictrace:open", onOpen);
    return () => {
      window.removeEventListener("civictrace:hover", onHover);
      window.removeEventListener("civictrace:dot", onDot);
      window.removeEventListener("civictrace:select", onSel);
      window.removeEventListener("civictrace:open", onOpen);
    };
  }, [values, metric, onSelect, router]);

  // ---- paint: an outline map. Places are not shaded by value (the ranking beside the map and the
  // hover sentence carry the numbers); fills light up only on hover, selection or a contractor footprint.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !map.getLayer("areas-fill")) return;
    const lit = highlight && highlight.size ? [...highlight] : null;
    const ACCENT = accent(darkRef.current);
    const color = (lit ? ["match", ["to-string", ["id"]], lit, FOOTPRINT, ACCENT] : ACCENT) as never;
    const opacity = [
      "case",
      ["boolean", ["feature-state", "selected"], false],
      0.3,
      ["boolean", ["feature-state", "hover"], false],
      0.18,
      lit ? ["match", ["to-string", ["id"]], lit, 0.4, 0.02] : 0.02,
    ] as never;
    for (const lvl of ["areas", "wards"] as const) {
      const active = lvl === level;
      map.setLayoutProperty(`${lvl}-fill`, "visibility", active ? "visible" : "none");
      map.setLayoutProperty(`${lvl}-line`, "visibility", active ? "visible" : "none");
      if (active) {
        map.setPaintProperty(`${lvl}-fill`, "fill-color", color);
        map.setPaintProperty(`${lvl}-fill`, "fill-opacity", opacity);
      }
    }
    map.setLayoutProperty("area-labels", "visibility", level === "areas" ? "visible" : "none");
    if (map.getLayer("dots")) map.setLayoutProperty("dots", "visibility", showDots ? "visible" : "none");
  }, [ready, level, showDots, highlight]);

  // ---- zoom to the region covered by a filter (who issued the tender / local office)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !areaGeo) return;
    if (!fitKey || !fitIds || !fitIds.length) {
      if (fitKey === "") map.flyTo({ center: CENTER, zoom: 10.2, duration: 900 });
      return;
    }
    const ids = new Set(fitIds);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const visit = (c: unknown): void => {
      if (Array.isArray(c) && typeof c[0] === "number") {
        const [x, y] = c as number[];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else if (Array.isArray(c)) c.forEach(visit);
    };
    for (const f of areaGeo.features) if (ids.has(String(f.properties.ac_no))) visit((f.geometry as { coordinates: unknown }).coordinates);
    if (!Number.isFinite(minX)) return;
    const w = ref.current?.clientWidth ?? 800;
    map.fitBounds(
      [
        [minX, minY],
        [maxX, maxY],
      ],
      { padding: { top: 70, bottom: 60, left: 30, right: w > 640 ? 270 : 30 }, maxZoom: 13, duration: 1000 },
    );
  }, [ready, fitKey, areaGeo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- reset view
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !resetCmd) return;
    map.flyTo({ center: CENTER, zoom: 10.2, duration: 900 });
  }, [ready, resetCmd]);

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
      // Base radius from the winning price: ₹1 lakh → 2, ₹1 crore → 5, ₹100 crore → 8 (log scale).
      const size = r.bid ? Math.min(8, 2 + 1.5 * Math.log10(Math.max(1, r.bid / 1e5))) : 2;
      feats.push({ type: "Feature", properties: { nit: r.nit, g, r: size }, geometry: { type: "Point", coordinates: [c[0] + Math.cos(ang) * rad, c[1] + Math.sin(ang) * rad] } });
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
      {!ready && !failed && <div className="absolute inset-0 flex items-center justify-center text-sm text-muted">Loading the map…</div>}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-ink-2">
          <p className="max-w-sm">
            Your browser couldn&apos;t start the interactive map (it needs WebGL). Everything else on this page still works: the
            ranking beside the map, the search box and all the charts below. Reloading the page or trying another browser usually fixes it.
          </p>
        </div>
      )}
      {dot && byNit.get(dot.nit) && (
        <div
          className={`tooltip absolute z-20 p-4 ${dot.pinned ? "" : "pointer-events-none"}`}
          style={{
            left: Math.max(8, Math.min(dot.x + 16, dot.w - 336)),
            top: dot.y > dot.h / 2 ? Math.max(8, dot.y - 16) : dot.y + 16,
            transform: dot.y > dot.h / 2 ? "translateY(-100%)" : undefined,
          }}
          role={dot.pinned ? "dialog" : "tooltip"}
          aria-label="Contract overview"
        >
          <ContractCard
            fact={byNit.get(dot.nit)!}
            supplierName={names[String(byNit.get(dot.nit)!.supplier)]}
            footer={
              dot.pinned ? (
                <div className="mt-3 flex items-center gap-2">
                  <Link href={`/tender/?id=${dot.nit}`} className="btn-primary h-9 flex-1">
                    Open full record
                    <Icon name="arrow-right" size={16} />
                  </Link>
                  <button type="button" className="icon-btn" aria-label="Close" onClick={() => setDot(null)}>
                    <Icon name="x" size={18} />
                  </button>
                </div>
              ) : (
                <p className="label-mono mt-3 text-accent">Click the dot to open the full record</p>
              )
            }
          />
        </div>
      )}
      {tip && (
        <div
          className="tooltip pointer-events-none absolute z-10 max-w-[14rem]"
          style={{ left: Math.min(tip.x + 12, tip.w - 220), top: Math.max(8, tip.y + 12) }}
        >
          <div className="text-title-s text-ink">{tip.title}</div>
          <div className="text-ink-2">{tip.text}</div>
        </div>
      )}
    </div>
  );
}
