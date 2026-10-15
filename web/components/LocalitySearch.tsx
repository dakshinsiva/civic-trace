"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { useJson } from "@/lib/useJson";

import { Icon } from "./Icon";

type Ring = [number, number][];
type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };
type Geo<P> = { features: { properties: P; geometry?: Geometry }[] };
type WardProps = { key: string; name: string; name_kn?: string; ac_no: number; ac: string; corporation: string };
type AreaProps = { ac_no: number; name: string; wards: number };
type Hit = { kind: "ward" | "area"; id: string; ac: number; name: string; alt?: string; sub: string };

/**
 * Spelling-tolerant key: letters only, and no "h" or vowels after the first letter, so "B.T.M Layout" matches
 * "btm layout", "Malleswaram" matches "Malleshwaram" and "KR Puram" matches "K.R. Pura".
 * (The same idea as the ward matching in pipeline/civictrace/geo.py.)
 */
function skeleton(s: string): string {
  const letters = s.toLowerCase().replace(/[^a-z]/g, "");
  return letters.slice(0, 1) + letters.slice(1).replace(/[aeiouh]/g, "");
}

function matches(name: string, query: string): boolean {
  if (name.toLowerCase().includes(query.toLowerCase())) return true;
  const b = skeleton(query);
  if (b.length < 3) return false;
  // The tolerant match must start at a word, or "kengeri" would match "Tilak Nagara".
  const words = name.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const a = skeleton(words.slice(i).join(" "));
    if (a.startsWith(b) || (a.length >= 4 && b.startsWith(a))) return true;
  }
  return false;
}

/** Ray-casting point-in-polygon on [lon, lat] rings (holes count as outside). */
function inRings(pt: [number, number], rings: Ring[]): boolean {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}
function contains(g: Geometry | undefined, pt: [number, number]): boolean {
  if (!g) return false;
  return g.type === "Polygon" ? inRings(pt, g.coordinates) : g.coordinates.some((poly) => inRings(pt, poly));
}

/** "Find your area": search wards and constituency areas (English or Kannada), or use the device location. */
export function LocalitySearch() {
  const router = useRouter();
  const listId = useId();
  const { data: wards } = useJson<Geo<WardProps>>("geo/wards.geojson");
  const { data: areas } = useJson<Geo<AreaProps>>("geo/areas.geojson");
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [locating, setLocating] = useState(false);
  const [locNote, setLocNote] = useState<string | null>(null);

  const query = q.trim();
  const hits = useMemo<Hit[]>(() => {
    if (query.length < 2) return [];
    const out: Hit[] = [];
    for (const f of areas?.features ?? []) {
      const p = f.properties;
      if (matches(p.name, query)) out.push({ kind: "area", id: String(p.ac_no), ac: p.ac_no, name: p.name, sub: `Constituency area · ${p.wards} wards` });
    }
    for (const f of wards?.features ?? []) {
      const p = f.properties;
      if (matches(p.name, query) || p.name_kn?.includes(query))
        out.push({ kind: "ward", id: p.key, ac: p.ac_no, name: p.name, alt: p.name_kn, sub: `Ward in ${p.ac} · ${p.corporation} corporation` });
    }
    // Names that start with the query first
    const t = query.toLowerCase();
    return out.sort((a, b) => Number(!a.name.toLowerCase().startsWith(t)) - Number(!b.name.toLowerCase().startsWith(t))).slice(0, 8);
  }, [query, wards, areas]);

  const open = (h: { kind: "ward" | "area"; id: string; ac: number }) => {
    // Open the place on the map with its contracts shown as dots.
    const params = new URLSearchParams(
      h.kind === "ward" ? { level: "wards", ward: h.id, area: String(h.ac), dots: "1" } : { level: "areas", area: h.id, dots: "1" },
    );
    router.push(`/?${params.toString()}`, { scroll: false });
    setQ("");
    setLocNote(null);
    // Bring the map and the place's profile fully into view, below the sticky filters.
    document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  // The position is used only in this browser, to find the ward; it is never sent anywhere.
  const locateMe = () => {
    if (!("geolocation" in navigator)) {
      setLocNote("This browser cannot share its location. Type your ward or area instead.");
      return;
    }
    setLocating(true);
    setLocNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const pt: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        const w = wards?.features.find((f) => contains(f.geometry, pt));
        if (w) open({ kind: "ward", id: w.properties.key, ac: w.properties.ac_no });
        else setLocNote("You seem to be outside the Greater Bengaluru wards. Type a ward or area name instead.");
      },
      (err) => {
        setLocating(false);
        setLocNote(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was not given. Type your ward or area instead."
            : "Could not get your location. Type your ward or area instead.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  };

  const expanded = hits.length > 0;
  const noMatch = query.length >= 3 && !expanded && !!wards;
  return (
    <div className="relative w-full max-w-xl">
      <label htmlFor={`${listId}-input`} className="label-mono mb-2 block text-muted">
        Find your area
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Icon name="search" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-accent" />
          <input
            id={`${listId}-input`}
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
              setLocNote(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setQ("");
              if (!expanded) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, hits.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                open(hits[active]);
              }
            }}
            placeholder="Ward or area, e.g. Hebbal, Jayanagar"
            className="field h-14 w-full rounded-lg pl-12 pr-4 text-body-l shadow-[0_0_0_4px_var(--accent-soft)] placeholder:text-muted"
          />
        </div>
        <button type="button" onClick={locateMe} disabled={locating || !wards} className="btn-outline h-14 rounded-lg px-4 disabled:opacity-60">
          <Icon name="locate-fixed" size={18} />
          {locating ? "Finding you…" : "Use my location"}
        </button>
      </div>
      {expanded && (
        <ul id={listId} role="listbox" className="tooltip absolute left-0 right-0 z-20 mt-2 p-1.5">
          {hits.map((h, i) => (
            <li
              key={`${h.kind}-${h.id}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                open(h);
              }}
              className={`flex cursor-pointer items-center gap-3 rounded-sm px-3 py-2 ${i === active ? "bg-accent-soft" : ""}`}
            >
              <Icon name={h.kind === "ward" ? "map-pin" : "map"} size={16} className={i === active ? "text-accent" : "text-muted"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-m text-ink">
                  {h.name}
                  {h.alt && <span className="ml-2 text-muted">{h.alt}</span>}
                </span>
                <span className="block truncate text-body-s text-muted">{h.sub}</span>
              </span>
              {i === active && <Icon name="arrow-right" size={16} className="text-accent" />}
            </li>
          ))}
        </ul>
      )}
      {noMatch && (
        <p role="status" className="tooltip absolute left-0 right-0 z-20 mt-2 px-4 py-3 text-body-m text-ink-2">
          No ward or area called &ldquo;{query}&rdquo;. Some well-known neighbourhoods are not ward names in the 2025 ward map. Try a
          nearby ward, your constituency, or <strong className="font-medium text-ink">Use my location</strong>.
        </p>
      )}
      {locNote && (
        <p role="status" className="mt-2 text-body-s text-notice-ink">
          {locNote}
        </p>
      )}
    </div>
  );
}
