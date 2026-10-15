"use client";

import { BIDDER_COLORS, bidderGroup, type Fact } from "@/lib/facts";
import { inr } from "@/lib/format";
import type { TenderDoc } from "@/lib/types";
import { useRecord } from "@/lib/useJson";

import { Icon } from "./Icon";

function bitCount(n: number): number {
  let c = 0;
  for (let x = n; x; x &= x - 1) c++;
  return c;
}

function vsEstimate(bid: number | null, ecv: number | null): { text: string; tone: "up" | "down" | "flat" } | null {
  if (!bid || !ecv) return null;
  const d = (bid / ecv - 1) * 100;
  if (Math.abs(d) < 0.5) return { text: "at the estimate", tone: "flat" };
  return { text: `${Math.abs(d).toFixed(Math.abs(d) < 10 ? 1 : 0)}% ${d > 0 ? "above" : "below"} estimate`, tone: d > 0 ? "up" : "down" };
}

/**
 * Overview of one contract, for the map's dots and the price chart. Figures come from the explorer's facts at once;
 * the title, winner's name and warning-sign names arrive with the tender record.
 */
export function ContractCard({
  fact,
  supplierName,
  where,
  footer,
}: {
  fact: Fact;
  supplierName?: string;
  /** The ward or area the contract is in, for contracts without a named place ("J.P Nagar ward", "Bommanahalli area"). */
  where?: string;
  footer?: React.ReactNode;
}) {
  const { data } = useRecord<TenderDoc>("tenders", String(fact.nit));
  const g = bidderGroup(fact.bidders);
  const est = vsEstimate(fact.bid, fact.ecv);
  const flagNames = data?.flags.map((f) => f.rule_plain_name || f.rule_name) ?? [];
  const nFlags = data ? flagNames.length : bitCount(fact.flags);
  const winner = data?.selection?.supplier_name ?? supplierName;
  return (
    <div className="w-[19.5rem] max-w-full">
      <div className="label-mono flex items-center justify-between gap-2 text-muted">
        <span className={fact.selection === "awarded" ? "text-accent" : ""}>{fact.selection === "awarded" ? "Awarded" : "Winner chosen · no award yet"}</span>
        <span>FY {fact.fy}</span>
      </div>
      <div className="mt-2 line-clamp-3 text-title-s text-ink">{data?.title ?? `${fact.category} · ${fact.division}`}</div>
      <div className="mt-0.5 truncate text-body-s text-muted">
        {fact.buyer} · {fact.division}
      </div>
      {fact.site ? (
        <div className="mt-2 flex items-start gap-1.5 text-body-s text-ink">
          <Icon name="map-pin" size={14} className="mt-0.5 text-accent" />
          <span>
            At <strong className="font-medium">{fact.site.name}</strong>
            <span className="text-muted"> · named in the title, located with OpenStreetMap</span>
          </span>
        </div>
      ) : where ? (
        <div className="mt-2 flex items-start gap-1.5 text-body-s text-muted">
          <Icon name="map-pin" size={14} className="mt-0.5" />
          <span>Somewhere in {where} · approximate: the tender names no exact place</span>
        </div>
      ) : null}

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div>
          <dt className="label-mono text-muted">Winning price</dt>
          <dd className="font-mono text-body-m text-ink tabular">{inr(fact.bid)}</dd>
          {est && (
            <dd className={`text-body-s ${est.tone === "up" ? "text-notice-ink" : est.tone === "down" ? "text-accent" : "text-ink-2"}`}>{est.text}</dd>
          )}
        </div>
        <div>
          <dt className="label-mono text-muted">Official estimate</dt>
          <dd className="font-mono text-body-m text-ink tabular">{inr(fact.ecv)}</dd>
        </div>
        <div>
          <dt className="label-mono text-muted">Companies bid</dt>
          <dd className="flex items-center gap-1.5 text-body-m text-ink">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: BIDDER_COLORS[g] }} aria-hidden />
            {fact.bidders == null ? "Not published" : fact.bidders === 1 ? "Only 1" : fact.bidders}
          </dd>
        </div>
        <div>
          <dt className="label-mono text-muted">Time to bid</dt>
          <dd className="font-mono text-body-m text-ink tabular">{fact.window != null ? `${Math.round(fact.window)} days` : "—"}</dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-line pt-2.5 text-body-s">
        <span className="text-muted">Won by </span>
        <span className="text-ink">{winner ?? "—"}</span>
      </div>
      {nFlags > 0 && (
        <div className="mt-1.5 flex items-start gap-1.5 text-body-s text-notice-ink">
          <Icon name="flag" size={14} className="mt-0.5" />
          <span>{flagNames.length ? flagNames.join(" · ") : `${nFlags} warning sign${nFlags > 1 ? "s" : ""}`}</span>
        </div>
      )}
      {footer}
    </div>
  );
}
