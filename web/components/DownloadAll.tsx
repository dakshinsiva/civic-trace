"use client";

import { useMemo } from "react";

import { DownloadView } from "@/components/explore/Download";
import { decodeFacts, EMPTY_FILTERS, type FactsFile } from "@/lib/facts";
import { useJson } from "@/lib/useJson";

/** The whole dataset as one spreadsheet: the homepage's download with no filters applied. */
export function DownloadAll({ buyerNames, ruleNames }: { buyerNames: Record<string, string>; ruleNames: Record<string, string> }) {
  const { data } = useJson<FactsFile>("facts.json");
  const { data: areas } = useJson<{ features: { properties: { ac_no: number; name: string } }[] }>("geo/areas.geojson");
  const { data: wards } = useJson<{ features: { properties: { key: string; name: string } }[] }>("geo/wards.geojson");
  const rows = useMemo(() => (data ? decodeFacts(data) : []), [data]);
  const names = useMemo(() => {
    const a = new Map((areas?.features ?? []).map((f) => [String(f.properties.ac_no), f.properties.name]));
    const w = new Map((wards?.features ?? []).map((f) => [f.properties.key, f.properties.name]));
    return { area: (id: string) => a.get(id), ward: (key: string) => w.get(key) };
  }, [areas, wards]);
  if (!data) return <p className="text-sm text-muted">Loading the data…</p>;
  return (
    <DownloadView
      rows={rows}
      filters={EMPTY_FILTERS}
      names={{ buyer: buyerNames, supplier: data.suppliers, rule: ruleNames, ruleBits: data.rule_bits, area: names.area, ward: names.ward }}
    />
  );
}
