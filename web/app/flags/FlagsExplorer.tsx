"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { Loading, RuleBadge } from "@/components/ui";
import { inr } from "@/lib/format";
import type { FlagStub, Overview } from "@/lib/types";
import { useJson } from "@/lib/useJson";

const PAGE = 100;

export function FlagsExplorer({ rules, buyers }: { rules: Overview["rules"]; buyers: string[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data, loading, error } = useJson<FlagStub[]>("flags-index.json");

  const rule = sp.get("rule") ?? "";
  const buyer = sp.get("buyer") ?? "";
  const fy = sp.get("fy") ?? "";
  const cat = sp.get("cat") ?? "";
  const q = sp.get("q") ?? "";
  const page = Math.max(0, Number(sp.get("page") ?? 0) || 0);

  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== "page") next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const options = useMemo(() => {
    const fys = new Set<string>();
    const cats = new Set<string>();
    for (const f of data ?? []) {
      if (f.fiscal_year) fys.add(f.fiscal_year);
      if (f.work_category) cats.add(f.work_category);
    }
    return { fys: [...fys].sort(), cats: [...cats].sort() };
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter(
      (f) =>
        (!rule || f.rule_id === rule) &&
        (!buyer || f.buyer === buyer) &&
        (!fy || f.fiscal_year === fy) &&
        (!cat || f.work_category === cat) &&
        (!needle ||
          [f.headline, f.tender_number, f.supplier_name, f.division].some((s) => (s ?? "").toLowerCase().includes(needle))),
    );
  }, [data, rule, buyer, fy, cat, q]);

  if (loading) return <Loading what="indicators" />;
  if (error) return <p className="text-critical">{error}</p>;

  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end text-sm" role="group" aria-label="Filters">
        <Select label="Warning sign" value={rule} onChange={(v) => set("rule", v)} options={rules.filter((r) => r.enabled).map((r) => [r.rule_id, r.plain_name])} />
        <Select label="Department" value={buyer} onChange={(v) => set("buyer", v)} options={buyers.map((b) => [b, b])} />
        <Select label="Fiscal year" value={fy} onChange={(v) => set("fy", v)} options={options.fys.map((f) => [f, f])} />
        <Select label="Type of work" value={cat} onChange={(v) => set("cat", v)} options={options.cats.map((c) => [c, c])} />
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Search</span>
          <input
            defaultValue={q}
            onChange={(e) => set("q", e.target.value)}
            placeholder="tender no., supplier, division"
            className="rounded-md border border-line bg-surface px-2 py-1.5 w-56"
          />
        </label>
      </div>
      <p className="text-sm text-muted tabular">
        {rows.length.toLocaleString("en-IN")} of {(data ?? []).length.toLocaleString("en-IN")} warning signs
      </p>
      <div className="overflow-x-auto card">
        <table className="data">
          <thead>
            <tr>
              <th className="pl-4">Warning sign</th>
              <th>What we found</th>
              <th>Department</th>
              <th>Type of work</th>
              <th>Year</th>
              <th className="num pr-4">Estimate</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((f) => (
              <tr key={f.flag_id}>
                <td className="pl-4">
                  <RuleBadge n={f.rule_number} name={f.rule_plain_name} />
                </td>
                <td className="max-w-xl">
                  <Link href={`/flag/?id=${f.flag_id}`}>{f.headline}</Link>
                  {f.title && <div className="text-xs text-ink-2 line-clamp-1">{f.title}</div>}
                  {f.partial_period && <span className="text-xs text-muted">(partial year)</span>}
                </td>
                <td>{f.buyer}</td>
                <td className="text-ink-2">{f.work_category}</td>
                <td className="tabular">{f.fiscal_year ?? "—"}</td>
                <td className="num pr-4">{inr(f.ecv)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE && (
        <div className="flex gap-3 text-sm items-center">
          <button disabled={page === 0} onClick={() => set("page", String(page - 1))} className="rounded-md border border-line px-3 py-1 disabled:opacity-40">
            Previous
          </button>
          <span className="tabular text-muted">
            Page {page + 1} of {Math.ceil(rows.length / PAGE)}
          </span>
          <button
            disabled={(page + 1) * PAGE >= rows.length}
            onClick={() => set("page", String(page + 1))}
            className="rounded-md border border-line px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1.5 max-w-[16rem]">
        <option value="">All</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
