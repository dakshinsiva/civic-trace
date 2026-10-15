import Link from "next/link";

import { Histogram } from "@/components/charts/Histogram";
import { RateBars } from "@/components/charts/RateBars";
import { PageTitle, Section, Stat } from "@/components/ui";
import { getBuyer, getMeta, getOverview } from "@/lib/data";
import { inr, num, statusLabel } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return getOverview().by_buyer.map((b) => ({ code: b.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const name = getMeta().buyers.find((x) => x.code === code)?.name ?? code;
  return pageMetadata({
    title: `${name} (${code}): public works tenders`,
    description: `Public works tenders issued by ${name} (${code}), Bengaluru: winning bids, contractors, how many companies competed, and warning signs. From public KPPP records.`,
    path: `/buyers/${code}/`,
  });
}

export default async function BuyerPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const b = getBuyer(code);
  const meta = getMeta();
  const rules = meta.rules;
  const info = meta.buyers.find((x) => x.code === code);
  const sb = b.by_fy.filter((r) => r.bidder_count_known > 0).map((r) => ({ key: r.fy, label: `FY ${r.fy}`, n: r.single_bidder, d: r.bidder_count_known }));
  const statuses = Array.from(new Set(b.by_fy.flatMap((r) => Object.keys(r.statuses))));

  return (
    <div className="space-y-6">
      <PageTitle eyebrow="Department" title={`${b.name} (${b.code})`}>
        {info?.note && <p className="text-sm">{info.note}</p>}
      </PageTitle>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Stat label="Tenders" value={num(b.totals.calls)} sub={`${num(b.totals.processes)} distinct works`} />
        <Stat label="Winners chosen" value={num(b.totals.selections)} />
        <Stat label="Contractors" value={num(b.totals.suppliers)} />
        <Stat
          label="Warning signs"
          value={num(Object.values(b.flags_by_rule).reduce((a, c) => a + c, 0))}
          sub={<Link href={`/flags/?buyer=${b.code}`}>view all</Link>}
        />
      </div>

      <Section title="Warning signs found">
        <ul className="text-sm space-y-1">
          {Object.entries(rules)
            .filter(([, r]) => r.enabled)
            .sort(([, a], [, z]) => a.number - z.number)
            .map(([id, r]) => (
              <li key={id}>
                <span className="tabular text-muted mr-1">R{r.number}</span>
                <Link href={`/flags/?rule=${id}&buyer=${b.code}`}>{r.name}</Link>: <span className="tabular">{num(b.flags_by_rule[id] ?? 0)}</span>
              </li>
            ))}
        </ul>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Only one company competed, by year">
          {sb.length ? (
            <RateBars rows={sb} title="Share of open contracts where only one company reached the price round" valueLabel="Financial year of the award (or of the bid deadline if no award is recorded)." />
          ) : (
            <p className="text-sm text-muted">No contracts with a published bidder count yet.</p>
          )}
        </Section>
        <Section title="Time given to bid">
          {b.window_distribution ? (
            <Histogram
              title="Days from publication to the original deadline"
              counts={b.window_distribution.counts}
              edges={b.window_distribution.edges}
              xLabel="days"
              format="days"
              refs={b.window_quantiles ? [{ value: b.window_quantiles.median, label: `median ${b.window_quantiles.median.toFixed(1)}d` }] : []}
            />
          ) : (
            <p className="text-sm text-muted">No data yet.</p>
          )}
        </Section>
      </div>

      {b.ratio_distribution && (
        <Section title="Winning price vs the official estimate">
          <Histogram
            title="Winning price ÷ official estimate"
            counts={b.ratio_distribution.counts}
            edges={b.ratio_distribution.edges}
            log
            xLabel="bid ÷ estimate"
            format="ratio"
            refs={[{ value: 1, label: "= estimate" }]}
          />
        </Section>
      )}

      <Section title="By financial year (published)">
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>FY</th>
                <th className="num">Tenders</th>
                {statuses.map((s) => (
                  <th key={s} className="num">
                    {statusLabel(s)}
                  </th>
                ))}
                <th className="num">Typical no. of bidders</th>
                <th className="num">Value of winning bids</th>
              </tr>
            </thead>
            <tbody>
              {b.by_fy.map((r) => (
                <tr key={r.fy}>
                  <td className="tabular">{r.fy}</td>
                  <td className="num">{num(r.calls)}</td>
                  {statuses.map((s) => (
                    <td key={s} className="num">
                      {num(r.statuses[s] ?? 0)}
                    </td>
                  ))}
                  <td className="num">{r.median_bidders ?? "—"}</td>
                  <td className="num">{inr(r.selected_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Local offices (divisions)">
        <div className="overflow-x-auto">
          <table className="data">
            <thead>
              <tr>
                <th>Local office</th>
                <th className="num">Tenders</th>
                <th className="num">Winners chosen</th>
                <th className="num">Contractors</th>
              </tr>
            </thead>
            <tbody>
              {b.divisions.map((d) => (
                <tr key={d.division}>
                  <td>
                    <Link href={`/tenders/?buyer=${b.code}&q=${encodeURIComponent(d.division)}`}>{d.division}</Link>
                  </td>
                  <td className="num">{num(d.calls)}</td>
                  <td className="num">{num(d.selections)}</td>
                  <td className="num">{num(d.suppliers)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
