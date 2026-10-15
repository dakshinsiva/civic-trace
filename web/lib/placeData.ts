// Build-time data for the area and ward pages (Server Components only).
import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import { computeStats, type AreaStat } from "./areaStats";
import { decodeFacts, type Fact, type FactsFile } from "./facts";
import { areaHref, slugify, wardHref, wardSlug } from "./places";
import type { TenderStub } from "./types";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const read = <T,>(rel: string): T => JSON.parse(readFileSync(path.join(DATA_DIR, rel), "utf8")) as T;

type AreaProps = { ac_no: number; name: string; corporations: string[]; population: number; wards: number; cx: number; cy: number };
type WardProps = { key: string; name: string; name_kn?: string; corporation: string; ac_no: number; ac: string; population: number; cx: number; cy: number };

export type PlaceLink = { name: string; href: string; tenders: number; spend: number };
export type RecentContract = {
  nit: number;
  title: string;
  division: string;
  fy: string;
  month: string;
  bid: number | null;
  ecv: number | null;
  bidders: number | null;
  supplier: string | null;
  flagged: boolean;
};
export type Place = {
  kind: "area" | "ward";
  /** ac_no for areas, ward key for wards: what the map and the explorer filter use. */
  id: string;
  slug: string;
  name: string;
  nameKn?: string;
  corporations: string[];
  population: number;
  /** Centre point, for geo tags and structured data. */
  lat: number;
  lon: number;
  area: { name: string; href: string; acNo: number };
  stat: AreaStat | null;
  perResident: number | null;
  topContractors: { id: number; name: string; wins: number; value: number }[];
  recent: RecentContract[];
  byYear: { fy: string; tenders: number; spend: number }[];
  workTypes: { category: string; tenders: number }[];
  /** Wards of an area, or the other wards of a ward's area. */
  wards: PlaceLink[];
};

// Read the release once per build, not once per page.
let cache: ReturnType<typeof load> | null = null;
function data() {
  cache ??= load();
  return cache;
}

function load() {
  const areas = read<{ features: { properties: AreaProps }[] }>("geo/areas.geojson").features.map((f) => f.properties);
  const wards = read<{ features: { properties: WardProps }[] }>("geo/wards.geojson").features.map((f) => f.properties);
  const facts = read<FactsFile>("facts.json");
  const rows = decodeFacts(facts);
  const titles = new Map(read<TenderStub[]>("tenders-index.json").map((t) => [t.nit_id, t.title || t.tender_number]));
  return {
    areas,
    wards,
    rows,
    titles,
    names: facts.suppliers,
    areaStats: computeStats(rows, (r) => (r.area == null ? null : String(r.area))),
    wardStats: computeStats(rows, (r) => r.ward),
  };
}

export function areaSlugs(): string[] {
  return data().areas.map((a) => slugify(a.name));
}
export function wardSlugs(): string[] {
  return data().wards.map((w) => wardSlug(w.name, w.key));
}

function summarise(rows: Fact[]) {
  const d = data();
  const recent = [...rows]
    .sort((a, b) => (b.month || "").localeCompare(a.month || "") || b.nit - a.nit)
    .slice(0, 12)
    .map((r) => ({
      nit: r.nit,
      title: d.titles.get(r.nit) ?? `${r.category} · ${r.division}`,
      division: r.division,
      fy: r.fy,
      month: r.month,
      bid: r.selection ? r.bid : null,
      ecv: r.ecv,
      bidders: r.bidders,
      supplier: r.supplier != null ? d.names[String(r.supplier)] ?? null : null,
      flagged: r.flags > 0,
    }));
  const years = new Map<string, { tenders: number; spend: number }>();
  const types = new Map<string, number>();
  for (const r of rows) {
    const y = years.get(r.fy) ?? { tenders: 0, spend: 0 };
    y.tenders += 1;
    if (r.selection) y.spend += r.bid ?? 0;
    years.set(r.fy, y);
    types.set(r.category, (types.get(r.category) ?? 0) + 1);
  }
  return {
    recent,
    byYear: [...years.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fy, v]) => ({ fy, ...v })),
    workTypes: [...types.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([category, tenders]) => ({ category, tenders })),
  };
}

function contractors(stat: AreaStat | null) {
  const d = data();
  return (stat?.suppliers ?? []).slice(0, 8).map((s) => ({ ...s, name: d.names[String(s.id)] ?? `Contractor ${s.id}` }));
}

export function getArea(slug: string): Place | null {
  const d = data();
  const a = d.areas.find((x) => slugify(x.name) === slug);
  if (!a) return null;
  const stat = d.areaStats.get(String(a.ac_no)) ?? null;
  const rows = d.rows.filter((r) => r.area === a.ac_no);
  return {
    kind: "area",
    id: String(a.ac_no),
    slug,
    name: a.name,
    corporations: a.corporations,
    population: a.population,
    lat: a.cy,
    lon: a.cx,
    area: { name: a.name, href: areaHref(a.name), acNo: a.ac_no },
    stat,
    perResident: stat && a.population ? stat.spend / a.population : null,
    topContractors: contractors(stat),
    ...summarise(rows),
    wards: d.wards
      .filter((w) => w.ac_no === a.ac_no)
      .map((w) => {
        const s = d.wardStats.get(w.key);
        return { name: w.name, href: wardHref(w.name, w.key), tenders: s?.tenders ?? 0, spend: s?.spend ?? 0 };
      })
      .sort((x, y) => y.tenders - x.tenders || x.name.localeCompare(y.name)),
  };
}

export function getWard(slug: string): Place | null {
  const d = data();
  const w = d.wards.find((x) => wardSlug(x.name, x.key) === slug);
  if (!w) return null;
  const stat = d.wardStats.get(w.key) ?? null;
  const rows = d.rows.filter((r) => r.ward === w.key);
  return {
    kind: "ward",
    id: w.key,
    slug,
    name: w.name,
    nameKn: w.name_kn,
    corporations: [w.corporation],
    population: w.population,
    lat: w.cy,
    lon: w.cx,
    area: { name: w.ac, href: areaHref(w.ac), acNo: w.ac_no },
    stat,
    perResident: stat && w.population ? stat.spend / w.population : null,
    topContractors: contractors(stat),
    ...summarise(rows),
    wards: d.wards
      .filter((x) => x.ac_no === w.ac_no && x.key !== w.key)
      .map((x) => {
        const s = d.wardStats.get(x.key);
        return { name: x.name, href: wardHref(x.name, x.key), tenders: s?.tenders ?? 0, spend: s?.spend ?? 0 };
      })
      .sort((x, y) => y.tenders - x.tenders || x.name.localeCompare(y.name)),
  };
}

/** Every area with its wards, for the /areas/ index. */
export function allAreas() {
  const d = data();
  return d.areas
    .map((a) => {
      const s = d.areaStats.get(String(a.ac_no));
      return {
        name: a.name,
        href: areaHref(a.name),
        corporations: a.corporations,
        population: a.population,
        tenders: s?.tenders ?? 0,
        spend: s?.spend ?? 0,
        wards: d.wards
          .filter((w) => w.ac_no === a.ac_no)
          .map((w) => ({ name: w.name, href: wardHref(w.name, w.key), tenders: d.wardStats.get(w.key)?.tenders ?? 0 }))
          .sort((x, y) => x.name.localeCompare(y.name)),
      };
    })
    .sort((x, y) => x.name.localeCompare(y.name));
}
