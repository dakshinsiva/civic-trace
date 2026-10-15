"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

import { Select } from "@/app/flags/FlagsExplorer";
import { Loading } from "@/components/ui";
import { inr, statusLabel } from "@/lib/format";
import type { TenderStub } from "@/lib/types";
import { useJson } from "@/lib/useJson";

const PAGE = 100;

export function TendersExplorer({ buyers }: { buyers: string[] }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data, loading, error } = useJson<TenderStub[]>("tenders-index.json");

  const buyer = sp.get("buyer") ?? "";
  const fy = sp.get("fy") ?? "";
  const status = sp.get("status") ?? "";
  const cat = sp.get("cat") ?? "";
  const flagged = sp.get("flagged") ?? "";
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
    const fys = new Set<string>(), sts = new Set<string>(), cats = new Set<string>();
    for (const t of data ?? []) {
      if (t.fy) fys.add(t.fy);
      sts.add(t.status);
      cats.add(t.work_category);
    }
    return { fys: [...fys].sort(), sts: [...sts].sort(), cats: [...cats].sort() };
  }, [data]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data ?? []).filter(
      (t) =>
        (!buyer || t.buyer === buyer) &&
        (!fy || t.fy === fy) &&
        (!status || t.status === status) &&
        (!cat || t.work_category === cat) &&
        (!flagged || t.n_flags > 0) &&
        (!needle || [t.title, t.tender_number, t.supplier_name, t.division].some((s) => (s ?? "").toLowerCase().includes(needle))),
    );
  }, [data, buyer, fy, status, cat, flagged, q]);

  if (loading) return <Loading what="tenders" />;
  if (error) return <p className="text-critical">{error}</p>;
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap gap-3 items-end p-4" role="group" aria-label="Filters">
        <Select label="Buyer" value={buyer} onChange={(v) => set("buyer", v)} options={buyers.map((b) => [b, b])} />
        <Select label="Fiscal year (published)" value={fy} onChange={(v) => set("fy", v)} options={options.fys.map((f) => [f, f])} />
        <Select label="Status" value={status} onChange={(v) => set("status", v)} options={options.sts.map((s) => [s, statusLabel(s)])} />
        <Select label="Work category" value={cat} onChange={(v) => set("cat", v)} options={options.cats.map((c) => [c, c])} />
        <Select label="Indicators" value={flagged} onChange={(v) => set("flagged", v)} options={[["1", "With tender-level indicators"]]} />
        <label className="flex w-full flex-col gap-1 sm:w-auto">
          <span className="field-label">Search</span>
          <input defaultValue={q} onChange={(e) => set("q", e.target.value)} placeholder="title, tender no., supplier, ward" className="field w-full sm:w-64" />
        </label>
      </div>
      <p className="text-sm text-muted tabular">
        {rows.length.toLocaleString("en-IN")} of {(data ?? []).length.toLocaleString("en-IN")} tender calls
      </p>
      <div className="overflow-x-auto card">
        <table className="data">
          <thead>
            <tr>
              <th className="pl-4">Tender</th>
              <th>Buyer · division</th>
              <th>Status</th>
              <th>Selected supplier</th>
              <th className="num">Estimate</th>
              <th className="num">Bid</th>
              <th className="num pr-4">Indicators</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.nit_id}>
                <td className="pl-4 max-w-md">
                  <Link href={`/tender/?id=${t.nit_id}`}>{t.title || t.tender_number}</Link>
                  <div className="text-xs text-muted tabular">{t.tender_number}</div>
                </td>
                <td className="text-ink-2">
                  {t.buyer} · {t.division}
                </td>
                <td className="text-xs">{statusLabel(t.status)}</td>
                <td>{t.supplier_id ? <Link href={`/supplier/?id=${t.supplier_id}`}>{t.supplier_name}</Link> : "—"}</td>
                <td className="num">{inr(t.ecv)}</td>
                <td className="num">{inr(t.bid_value)}</td>
                <td className="num pr-4">{t.n_flags || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > PAGE && (
        <div className="flex gap-3 text-sm items-center">
          <button disabled={page === 0} onClick={() => set("page", String(page - 1))} className="btn-outline disabled:pointer-events-none disabled:opacity-40">
            Previous
          </button>
          <span className="tabular text-muted">
            Page {page + 1} of {Math.ceil(rows.length / PAGE)}
          </span>
          <button disabled={(page + 1) * PAGE >= rows.length} onClick={() => set("page", String(page + 1))} className="btn-outline disabled:pointer-events-none disabled:opacity-40">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
