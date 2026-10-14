"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Histogram } from "@/components/charts/Histogram";
import { ErrorNote, KV, Loading, PageTitle, RuleBadge, Section } from "@/components/ui";
import { date, num, pct } from "@/lib/format";
import type { Flag, RuleConfig } from "@/lib/types";
import { useJson } from "@/lib/useJson";

export function FlagView({ rules }: { rules: Record<string, RuleConfig> }) {
  const id = useSearchParams().get("id");
  const safe = id && /^[0-9a-f]{16}$/.test(id) ? id : null;
  const { data: f, error, loading } = useJson<Flag>(safe ? `flags/${safe}.json` : null);
  if (loading) return <Loading what="indicator" />;
  if (error || !f) return <ErrorNote message={error ?? "Indicator not found."} />;
  const rule = rules[f.rule_id];
  const ctx = f.context;
  const slice = (ctx.slice ?? {}) as Record<string, string>;
  const supplierId = (ctx.supplier_id ?? f.observed.supplier_id) as number | undefined;
  const buyerCode = slice.buyer || (typeof ctx.buyer_code === "string" ? ctx.buyer_code : "");

  return (
    <div className="space-y-5">
      <PageTitle eyebrow={`Warning sign · ${f.rule_plain_name ?? f.rule_name}`} title={f.headline}>
        {typeof ctx.title === "string" && <p className="text-base text-ink">{ctx.title}</p>}
        <p className="text-sm mt-1">
          A warning sign is a pattern worth a closer look. It is not evidence that anyone did anything wrong. Read the
          innocent explanations and the limits below before drawing any conclusion.
        </p>
      </PageTitle>

      <div className="flex flex-wrap gap-2 text-sm">
        {ctx.nit_id != null && (
          <Link href={`/tender/?id=${ctx.nit_id}`} className="rounded-md border border-line bg-surface px-3 py-1.5">
            Open the tender record →
          </Link>
        )}
        {supplierId != null && (
          <Link href={`/supplier/?id=${supplierId}`} className="rounded-md border border-line bg-surface px-3 py-1.5">
            Supplier&apos;s selections →
          </Link>
        )}
        {buyerCode && (
          <Link href={`/buyers/${buyerCode}/`} className="rounded-md border border-line bg-surface px-3 py-1.5">
            Buyer profile ({buyerCode}) →
          </Link>
        )}
      </div>

      <Section n={1} title="Which warning sign this is">
        <p className="text-base font-medium text-ink">{rule?.plain_name ?? f.rule_name}</p>
        {rule?.plain_question && <p className="text-sm text-ink-2 mt-1">The question it asks: {rule.plain_question}</p>}
        {rule?.plain_why && <p className="text-sm text-ink-2 mt-1">Why it matters: {rule.plain_why}</p>}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-2">Technical definition (rule {f.rule_number}, version {f.rule_version})</summary>
          <div className="mt-2 space-y-2">
            <p>
              <RuleBadge n={f.rule_number} name={f.rule_name} />
              {rule?.ocp_ref && <span className="text-xs text-muted"> · {rule.ocp_ref}</span>}
            </p>
            {rule && <p className="text-ink-2">{rule.method}</p>}
            <Link href={`/methodology/#${f.rule_id}`}>Full rule definition and thresholds</Link>
          </div>
        </details>
      </Section>

      <Section n={2} title="What we found">
        <p className="text-base text-ink mb-3">{f.headline}</p>
        <details className="text-sm" open>
          <summary className="cursor-pointer text-ink-2 mb-2">The exact values</summary>
          <KV data={f.observed} />
        </details>
      </Section>

      <Section n={3} title="Compared with what">
        {f.baseline.summary && <p className="text-base text-ink mb-3">{f.baseline.summary}</p>}
        <BaselineChart f={f} />
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-2">How the comparison was calculated</summary>
          <p className="text-ink-2 my-2">{f.baseline.method}</p>
          <KV data={f.baseline.values} />
        </details>
      </Section>

      <Section n={4} title="Which records and time period">
        <dl className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,16rem)_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-ink-2">Period</dt>
          <dd>
            {f.period.label}
            {f.period.start && ` (${date(f.period.start)} – ${date(f.period.end)})`}
            {f.period.partial && <span className="ml-2 rounded bg-notice-bg px-1.5 py-0.5 text-xs text-notice-ink">partial period</span>}
          </dd>
          <dt className="text-ink-2">Period defined by</dt>
          <dd>{f.period.basis}</dd>
          <dt className="text-ink-2">Dataset</dt>
          <dd>{f.coverage.dataset}</dd>
          <dt className="text-ink-2">Comparison group</dt>
          <dd>
            {Object.entries(f.coverage.slice)
              .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
              .join(" · ")}
          </dd>
          <dt className="text-ink-2">Records in group</dt>
          <dd className="tabular">{num(f.coverage.n)}</dd>
          <dt className="text-ink-2">Field completeness</dt>
          <dd className="tabular">
            {Object.entries(f.coverage.completeness)
              .map(([k, v]) => `${k.replace(/_/g, " ")}: ${pct(v, 0)}`)
              .join(" · ")}
          </dd>
        </dl>
        {f.coverage.notes.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm text-ink-2">
            {f.coverage.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <p className="text-sm mt-2">
          <Link href="/coverage/">How complete is the data?</Link>
        </p>
      </Section>

      <Section n={5} title="Where the data comes from">
        <ul className="space-y-1.5 text-sm">
          {f.source_links.map((s, i) => (
            <li key={i}>
              <a href={s.url} rel="noopener noreferrer" target="_blank">
                {s.label}
              </a>
              {s.fetched_at && <span className="text-muted"> · retrieved {date(s.fetched_at)}</span>}
              {s.sha256 && <span className="text-muted break-all"> · sha256 {s.sha256.slice(0, 16)}…</span>}
            </li>
          ))}
        </ul>
        {Array.isArray(ctx.nit_ids) && ctx.nit_ids.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-ink-2">
              {ctx.nit_ids.length} tender record{ctx.nit_ids.length === 1 ? "" : "s"} included
            </summary>
            <ul className="mt-2 columns-2 sm:columns-4 gap-4">
              {ctx.nit_ids.map((n) => (
                <li key={n}>
                  <Link href={`/tender/?id=${n}`} className="tabular">
                    {n}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="text-xs text-muted mt-3">
          Each link points to the portal&apos;s own record for this tender. The sha256 hash identifies the exact response
          CivicTrace archived, so the data can be checked even if the portal later changes or removes it.
        </p>
      </Section>

      <Section n={6} title="Innocent explanations">
        <p className="text-sm text-ink-2 mb-2">Ordinary reasons this pattern can happen without any wrongdoing:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {f.non_fraud_explanations.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </Section>

      <Section n={7} title="What this can't tell you">
        <ul className="list-disc pl-5 space-y-1 text-sm">
          {f.limitations.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function BaselineChart({ f }: { f: Flag }) {
  const d = f.baseline.distribution as Record<string, unknown> | null;
  if (!d) return null;
  if (Array.isArray(d.counts) && Array.isArray(d.edges)) {
    const isRatio = f.rule_id === "award_ratio";
    const marker = isRatio ? (f.observed.bid_to_estimate_ratio as number) : (f.observed.window_days as number | undefined);
    const v = f.baseline.values as Record<string, number>;
    const refs = isRatio
      ? [
          { value: v.lower_fence_ratio, label: "lower fence" },
          { value: v.upper_fence_ratio, label: "upper fence" },
        ]
      : [{ value: v.lower_fence_days, label: "lower fence" }];
    return (
      <Histogram
        title={isRatio ? "Winning price ÷ official estimate for similar contracts (orange line: this one)" : "Days given to bid in similar tenders (orange line: this one)"}
        counts={d.counts as number[]}
        edges={d.edges as number[]}
        log={Boolean(d.log)}
        marker={marker ?? null}
        markerLabel="This tender"
        refs={refs.filter((r) => typeof r.value === "number" && r.value > 0)}
        xLabel={isRatio ? "winning price ÷ official estimate (1.00× = exactly the estimate)" : "days from publication to the original deadline"}
        format={isRatio ? "ratio" : "days"}
      />
    );
  }
  const freq = (d.bidder_count_frequencies ?? d.corrigenda_count_frequencies) as Record<string, number> | undefined;
  if (freq) {
    const total = Object.values(freq).reduce((a, b) => a + b, 0);
    const label = d.bidder_count_frequencies ? "price-stage bidders" : "corrigenda";
    return (
      <table className="data max-w-md">
        <thead>
          <tr>
            <th>Number of {label}</th>
            <th className="num">Calls</th>
            <th className="num">Share</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(freq).map(([k, n]) => (
            <tr key={k}>
              <td className="tabular">{k}</td>
              <td className="num">{n.toLocaleString("en-IN")}</td>
              <td className="num">{pct(n / total, 1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const q = (d.hhi_quantiles ?? d.supplier_share_quantiles) as Record<string, number> | undefined;
  if (q) {
    const isShare = Boolean(d.supplier_share_quantiles);
    const fmt = (x: number) => (isShare ? pct(x, 1) : num(x, 0));
    return (
      <table className="data max-w-md">
        <caption className="text-left text-sm text-ink-2 mb-1">
          {isShare ? "Distribution of supplier shares in this group" : "Distribution of HHI across comparable groups"}
        </caption>
        <tbody>
          {(["min", "q1", "median", "q3", "p95", "max"] as const).map((k) => (
            <tr key={k}>
              <td>{k === "q1" ? "25th percentile" : k === "q3" ? "75th percentile" : k === "p95" ? "95th percentile" : k}</td>
              <td className="num">{fmt(q[k])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return null;
}

