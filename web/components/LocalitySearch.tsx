"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";

import { useJson } from "@/lib/useJson";

import { Icon } from "./Icon";

type Geo<P> = { features: { properties: P }[] };
type WardProps = { key: string; name: string; name_kn?: string; ac_no: number; ac: string; corporation: string };
type AreaProps = { ac_no: number; name: string; wards: number };
type Hit = { kind: "ward" | "area"; id: string; ac: number; name: string; alt?: string; sub: string };

/** "Find your area": search wards and constituency areas (English or Kannada) and open them on the map. */
export function LocalitySearch() {
  const router = useRouter();
  const listId = useId();
  const { data: wards } = useJson<Geo<WardProps>>("geo/wards.geojson");
  const { data: areas } = useJson<Geo<AreaProps>>("geo/areas.geojson");
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const out: Hit[] = [];
    for (const f of areas?.features ?? []) {
      const p = f.properties;
      if (p.name.toLowerCase().includes(t)) out.push({ kind: "area", id: String(p.ac_no), ac: p.ac_no, name: p.name, sub: `Constituency area · ${p.wards} wards` });
    }
    for (const f of wards?.features ?? []) {
      const p = f.properties;
      if (p.name.toLowerCase().includes(t) || p.name_kn?.includes(q.trim()))
        out.push({ kind: "ward", id: p.key, ac: p.ac_no, name: p.name, alt: p.name_kn, sub: `Ward in ${p.ac} · ${p.corporation} corporation` });
    }
    // Names that start with the query first
    return out.sort((a, b) => Number(!a.name.toLowerCase().startsWith(t)) - Number(!b.name.toLowerCase().startsWith(t))).slice(0, 8);
  }, [q, wards, areas]);

  const open = (h: Hit) => {
    const params = new URLSearchParams(h.kind === "ward" ? { level: "wards", ward: h.id, area: String(h.ac) } : { level: "areas", area: h.id });
    router.push(`/?${params.toString()}`, { scroll: false });
    setQ("");
    // Bring the map and the place's profile fully into view, below the sticky filters.
    document.getElementById("map")?.scrollIntoView({ behavior: "smooth", block: "end" });
  };

  const expanded = hits.length > 0;
  return (
    <div className="relative w-full max-w-xl">
      <label htmlFor={`${listId}-input`} className="label-mono mb-2 block text-muted">
        Find your area
      </label>
      <div className="relative">
        <Icon name="map-pin" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-accent" />
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
          }}
          onKeyDown={(e) => {
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
            } else if (e.key === "Escape") setQ("");
          }}
          placeholder="Your ward or neighbourhood, e.g. Hebbal, Jayanagar"
          className="field h-14 w-full rounded-lg pl-12 pr-4 text-body-l shadow-[0_0_0_4px_var(--accent-soft)] placeholder:text-muted"
        />
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
    </div>
  );
}
