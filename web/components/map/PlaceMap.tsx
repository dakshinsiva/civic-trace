"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { BIDDER_COLORS, decodeFacts, type FactsFile } from "@/lib/facts";
import { areaHref, wardHref } from "@/lib/places";
import { useJson } from "@/lib/useJson";

import { CityMap, type MapSelection } from "./CityMap";

type Geo<P> = { features: { properties: P }[] };

/** The city map zoomed to one area or ward, with every contract as a dot. Clicking another place opens its page. */
export function PlaceMap({ kind, id }: { kind: "area" | "ward"; id: string }) {
  const router = useRouter();
  const { data, error } = useJson<FactsFile>("facts.json");
  const { data: areas } = useJson<Geo<{ ac_no: number; name: string }>>("geo/areas.geojson");
  const { data: wards } = useJson<Geo<{ key: string; name: string }>>("geo/wards.geojson");
  const rows = useMemo(() => (data ? decodeFacts(data) : []), [data]);
  const level = kind === "area" ? "areas" : "wards";
  const selection = useMemo<MapSelection>(() => ({ level, id }), [level, id]);
  // Only this place's contracts as dots; the outlines around it stay for context.
  const dotRows = useMemo(() => rows.filter((r) => (kind === "ward" ? r.ward === id : String(r.area) === id)), [rows, kind, id]);

  const onSelect = useCallback(
    (s: MapSelection) => {
      if (!s || s.id === id) return;
      if (s.level === "areas") {
        const a = areas?.features.find((f) => String(f.properties.ac_no) === s.id);
        if (a) router.push(areaHref(a.properties.name));
      } else {
        const w = wards?.features.find((f) => f.properties.key === s.id);
        if (w) router.push(wardHref(w.properties.name, w.properties.key));
      }
    },
    [areas, wards, id, router],
  );

  return (
    <figure className="card overflow-hidden">
      <div className="relative h-[60vh] max-h-[520px] min-h-[360px]">
        {error ? (
          <p className="p-6 text-body-m text-muted">The map data is not available in this release.</p>
        ) : (
          <CityMap rows={rows} dotRows={dotRows} metricKey="tenders" level={level} showDots selection={selection} onSelect={onSelect} names={data?.suppliers ?? {}} />
        )}
      </div>
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 text-body-s text-ink-2">
        <span className="label-mono text-muted">Each dot is a contract</span>
        {(["1", "2", "3+", "unknown"] as const).map((g) => (
          <span key={g} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: BIDDER_COLORS[g] }} aria-hidden />
            {g === "1" ? "Only 1 company bid" : g === "2" ? "2 companies" : g === "3+" ? "3 or more" : "Not published"}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-2 ring-1 ring-ink" aria-hidden />
          at the place named in the tender
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-ink-2 opacity-50" aria-hidden />
          somewhere in the ward or area (approximate)
        </span>
        <span className="text-muted">· Bigger dot = bigger winning price · Point at a dot for the contract, click to open it</span>
      </figcaption>
    </figure>
  );
}
