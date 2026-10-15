"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { ErrorNote, FlagList, Loading, PageTitle, Section, Stat } from "@/components/ui";
import { inr, selectionLabel } from "@/lib/format";
import type { Graph, SupplierDoc } from "@/lib/types";
import { useJson, useRecord } from "@/lib/useJson";

export function SupplierView({ relationships }: { relationships: boolean }) {
  const id = useSearchParams().get("id");
  const safe = id && /^\d{1,9}$/.test(id) ? id : null;
  const { data: s, error, loading } = useRecord<SupplierDoc>("suppliers", safe);
  // The page shell is static, so name the browser tab after the record once it loads.
  useEffect(() => {
    if (s) document.title = `${s.name} · CivicTrace Bengaluru`;
  }, [s]);
  if (loading) return <Loading what="supplier" />;
  if (error || !s) return <ErrorNote message={error ?? "Supplier not found."} />;

  return (
    <div className="space-y-5">
      <PageTitle eyebrow={`Contractor · KPPP supplier ID ${s.supplier_id}`} title={s.name}>
        <p className="text-sm">
          Selections recorded on the Karnataka Public Procurement Portal for the Bengaluru buyers covered here. Winning
          tenders is what contractors do; a long list here is not, by itself, a sign of anything improper.
        </p>
        {s.names_seen.length > 1 && <p className="text-xs text-muted mt-1">Also listed as: {s.names_seen.filter((n) => n !== s.name).join("; ")}</p>}
      </PageTitle>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Contracts won" value={s.selections.toLocaleString("en-IN")} />
        <Stat label="Awarded" value={s.awarded.toLocaleString("en-IN")} />
        <Stat label="Won, no award recorded yet" value={s.selected_no_award.toLocaleString("en-IN")} />
        <Stat label="Total of winning bids" value={inr(s.total_bid_value)} />
      </div>

      <Section title="Warning signs involving this contractor">
        <FlagList flags={s.flags} empty="No warning signs involve this contractor's contracts." />
      </Section>

      {relationships && <Connections supplierId={s.supplier_id} />}

      <Section title="By department and financial year">
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Department</th>
                <th>Financial year</th>
                <th className="num">Contracts won</th>
                <th className="num">Winning bids</th>
              </tr>
            </thead>
            <tbody>
              {s.by_buyer_fy.map((r) => (
                <tr key={`${r.buyer_code}-${r.fy_decision}`}>
                  <td>
                    <Link href={`/buyers/${r.buyer_code}/`}>{r.buyer_code}</Link>
                  </td>
                  <td>{r.fy_decision}</td>
                  <td className="num">{r.selections}</td>
                  <td className="num">{inr(r.bid_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`Tenders (${s.tenders.length})`}>
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Tender</th>
                <th>Department · office</th>
                <th>FY</th>
                <th className="num">Estimate</th>
                <th className="num">Winning price</th>
                <th className="num">Companies bid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {s.tenders.map((t) => (
                <tr key={t.nit_id}>
                  <td className="max-w-md">
                    <Link href={`/tender/?id=${t.nit_id}`}>{t.title || t.tender_number}</Link>
                    <div className="text-xs text-muted tabular">{t.tender_number}</div>
                  </td>
                  <td className="text-ink-2">
                    {t.buyer} · {t.division}
                  </td>
                  <td>{t.fy}</td>
                  <td className="num">{inr(t.ecv)}</td>
                  <td className="num">{inr(t.bid_value)}</td>
                  <td className="num">{t.n_price_stage_bidders ?? "—"}</td>
                  <td className="text-xs">{selectionLabel(t.label)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Right of reply">
        <p className="text-sm text-ink-2">
          If you represent this supplier and believe a record is wrong or missing context, see{" "}
          <Link href="/corrections/">corrections &amp; right of reply</Link>. Disputed items can be withheld while they are
          reviewed.
        </p>
      </Section>
    </div>
  );
}

function Connections({ supplierId }: { supplierId: number }) {
  const { data } = useJson<Graph>("relationships/graph.json");
  const node = `kppp_supplier:${supplierId}`;
  const edges = data?.edges.filter((e) => e.source === node || e.target === node) ?? [];
  return (
    <Section title="Documented connections (internal build)">
      <p className="text-sm text-ink-2 mb-2">
        Each link is documented separately. Seeing them together does not show that any official influenced any award.
      </p>
      {edges.length ? (
        <p className="text-sm">
          This supplier appears in the <Link href={`/connections/?focus=${encodeURIComponent(node)}`}>documented-connections graph</Link> ({edges.length} direct
          link{edges.length === 1 ? "" : "s"}).
        </p>
      ) : (
        <p className="text-sm text-muted">No published claims link this supplier to anyone.</p>
      )}
    </Section>
  );
}
