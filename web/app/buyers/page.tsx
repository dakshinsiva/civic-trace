import Link from "next/link";

import { Icon } from "@/components/Icon";
import { PageTitle, Section } from "@/components/ui";
import { getFacts, getFindings, getMeta, getOverview } from "@/lib/data";
import { byDepartment, deptStats, type DeptStats, type Rate } from "@/lib/deptStats";
import { decodeFacts } from "@/lib/facts";
import { inr, num } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Bengaluru departments that issue public works tenders",
  description:
    "BBMP, the Greater Bengaluru Authority, the five city corporations, B-SMILE and BSWML: their public works tenders, winning bids, contractors and warning signs.",
  path: "/buyers/",
});

export default function BuyersPage() {
  const meta = getMeta();
  const o = getOverview();
  const byCode = Object.fromEntries(meta.buyers.map((b) => [b.code, b]));
  const facts = getFacts();
  const rows = facts ? decodeFacts(facts) : [];
  const depts = byDepartment(rows);
  const city = deptStats(rows);
  const screens = getFindings()?.bid_screens;
  const pairs = (code?: string) => {
    const s = code ? screens?.by_buyer?.[code] : screens;
    return s ? { k: s.met_min.k, n: s.met_min.n } : undefined;
  };
  return (
    <div className="space-y-6">
      <PageTitle title="Departments">
        <p>
          Procuring entities covered in this release. BBMP was replaced from 15 May 2025 by the Greater Bengaluru Authority
          and five city corporations; older tenders keep the BBMP name on the portal.
        </p>
      </PageTitle>
      {depts.length > 1 && (
        <Section title="How the departments compare">
          <p className="max-w-3xl text-body-m text-ink-2">
            The same measures for every department, with the counts behind each rate. Rates based on fewer than {MIN_N} contracts
            are left out, because a handful of tenders can swing them a long way.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="data min-w-[56rem]">
              <thead>
                <tr>
                  <th className="min-w-[13rem] align-bottom">Department</th>
                  <th className="num whitespace-normal align-bottom leading-tight">Tenders</th>
                  <th className="num whitespace-normal align-bottom leading-tight">Winning bids</th>
                  <th className="num whitespace-normal align-bottom leading-tight">Only one company</th>
                  <th className="num whitespace-normal align-bottom leading-tight">Two or fewer</th>
                  <th className="num whitespace-normal align-bottom leading-tight">Typical price</th>
                  <th className="num whitespace-normal align-bottom leading-tight">Withdrawn or re-run</th>
                  <th className="num whitespace-normal align-bottom leading-tight">No award recorded</th>
                  {screens && <th className="num whitespace-normal align-bottom leading-tight">Same two firms, {screens.min_meetings}+ times</th>}
                </tr>
              </thead>
              <tbody>
                {depts.map(({ code, stats }) => (
                  <CompareRow key={code} label={<Link href={`/buyers/${code}/`}>{code}</Link>} sub={byCode[code]?.name} s={stats} pairs={screens ? pairs(code) ?? { k: 0, n: 0 } : undefined} />
                ))}
                <CompareRow label={<strong className="font-medium">All departments</strong>} s={city} pairs={pairs()} total />
              </tbody>
            </table>
          </div>
          <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 text-body-s text-muted">
            <li>
              <strong className="font-medium text-ink-2">Only one company</strong> and <strong className="font-medium text-ink-2">two or fewer</strong>: of
              open contracts with a winner and a published bidder count. <strong className="font-medium text-ink-2">Typical price</strong>: the median
              winning price against the official estimate.
            </li>
            <li>
              <strong className="font-medium text-ink-2">Withdrawn or re-run</strong>: of all tender calls. <strong className="font-medium text-ink-2">No award
              recorded</strong>: of tenders where a winner was chosen, the share where the portal never recorded the award.
            </li>
            {screens && (
              <li>
                <strong className="font-medium text-ink-2">Same two firms, {screens.min_meetings}+ times</strong>: of open contracts where exactly
                two companies bid, the share where those two had faced each other in at least {screens.min_meetings} of that department&apos;s
                tenders. Firms taking turns to win look like this; so does an area where only two firms do the work. Departments that
                started in 2025 have had fewer tenders, so fewer chances for a pair to meet that often.{" "}
                <Link href="/findings/#bid-rigging">How this is checked</Link>.
              </li>
            )}
            <li>
              BBMP&apos;s tenders run to May 2025 and the city corporations&apos; start then, so a difference between them can reflect
              the period as well as the department.
            </li>
          </ul>
        </Section>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {o.by_buyer.map((b) => (
          <Link key={b.code} href={`/buyers/${b.code}/`} className="card state flex gap-4 p-4 text-ink no-underline hover:no-underline">
            <span className="avatar">
              <Icon name="landmark" size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-title-m text-ink">
                {b.code} <span className="text-ink-2">· {b.name}</span>
              </div>
              <div className="text-body-m text-muted mt-1 tabular">
                {num(b.calls)} tenders · {num(b.selections)} winners chosen · {num(b.suppliers)} {b.suppliers === 1 ? "contractor" : "contractors"}
              </div>
              {byCode[b.code]?.note && <div className="text-body-s text-muted mt-1">{byCode[b.code].note}</div>}
            </div>
            <Icon name="chevron-right" size={24} className="self-center text-ink-2" />
          </Link>
        ))}
      </div>
    </div>
  );
}

const MIN_N = 30;

function rate(r: Rate, min = MIN_N) {
  if (r.n < min) return <span className="text-muted">too few</span>;
  const p = (r.k / r.n) * 100;
  return (
    <>
      <span className="text-ink">{p > 0 && p < 1 ? "<1" : Math.round(p)}%</span>
      <span className="block text-xs text-muted">
        {num(r.k)} of {num(r.n)}
      </span>
    </>
  );
}

function price(s: DeptStats) {
  if (s.priced < MIN_N || s.medPrice == null) return <span className="text-muted">too few</span>;
  const r = Math.round(Math.abs(s.medPrice));
  return (
    <>
      <span className="whitespace-nowrap text-ink">{r === 0 ? "at the estimate" : `${r}% ${s.medPrice < 0 ? "below" : "above"}`}</span>
      <span className="block text-xs text-muted">{num(s.priced)} contracts</span>
    </>
  );
}

function CompareRow({ label, sub, s, pairs, total }: { label: React.ReactNode; sub?: string; s: DeptStats; pairs?: Rate; total?: boolean }) {
  return (
    <tr className={total ? "border-t-2 border-line" : undefined}>
      <td>
        {label}
        {sub && <span className="block text-xs text-muted">{sub}</span>}
      </td>
      <td className="num">{num(s.tenders)}</td>
      <td className="num">{inr(s.value)}</td>
      <td className="num">{rate(s.one)}</td>
      <td className="num">{rate(s.low)}</td>
      <td className="num">{price(s)}</td>
      <td className="num">{rate(s.rerun)}</td>
      <td className="num">{rate(s.noAward)}</td>
      {pairs && <td className="num">{rate(pairs)}</td>}
    </tr>
  );
}
