"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { Histogram } from "@/components/charts/Histogram";
import { Icon } from "@/components/Icon";
import { Term } from "@/components/Term";
import { applyFilters, BIDDER_COLORS, BIDDER_LABELS, bidderGroup, decodeFacts, EMPTY_FILTERS, type Fact, type FactsFile, type Filters } from "@/lib/facts";
import { inr } from "@/lib/format";
import { useJson } from "@/lib/useJson";

import { Loading } from "@/components/ui";

import { MapExplorer } from "@/components/map/MapExplorer";
import { METRICS, type MetricKey } from "@/lib/areaStats";

import { PriceScatter } from "./PriceScatter";
import { MonthlyVolume, SingleBidTrend } from "./Trends";
import { WhoWinsWhere } from "./WhoWinsWhere";

const FILTER_KEYS: (keyof Filters)[] = ["buyer", "fy", "category", "division", "tenderType", "area"];

export function Explorer({ buyerNames }: { buyerNames: Record<string, string> }) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data, loading, error } = useJson<FactsFile>("facts.json");
  const all = useMemo(() => (data ? decodeFacts(data) : []), [data]);
  const filters: Filters = { ...EMPTY_FILTERS };
  for (const k of FILTER_KEYS) filters[k] = sp.get(k) ?? "";
  const rows = useMemo(() => applyFilters(all, filters), [all, filters.buyer, filters.fy, filters.category, filters.division, filters.tenderType, filters.area]); // eslint-disable-line react-hooks/exhaustive-deps
  // The map shows every area, so it ignores the area filter itself.
  const mapRows = useMemo(() => applyFilters(all, { ...filters, area: "" }), [all, filters.buyer, filters.fy, filters.category, filters.division, filters.tenderType]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(
    (k: keyof Filters, v: string) => {
      const next = new URLSearchParams(window.location.search);
      if (v) next.set(k, v);
      else next.delete(k);
      if (k === "buyer") next.delete("division");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  // Selected ward on the map (shareable through the URL)
  const setWard = useCallback(
    (v: string) => {
      const next = new URLSearchParams(window.location.search);
      if (v) next.set("ward", v);
      else next.delete("ward");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  // Map view (shareable through the URL)
  const measure = (METRICS.find((m) => m.key === sp.get("measure"))?.key ?? "per_capita") as MetricKey;
  const level = sp.get("level") === "wards" ? "wards" : "areas";
  const setView = useCallback(
    (v: { measure?: MetricKey; level?: "areas" | "wards" }) => {
      const next = new URLSearchParams(window.location.search);
      if (v.measure) next.set("measure", v.measure);
      if (v.level) next.set("level", v.level);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router],
  );

  const opts = useMemo(() => {
    const scoped = filters.buyer ? all.filter((r) => r.buyer === filters.buyer) : all;
    const uniq = (xs: string[]) => [...new Set(xs)].filter((x) => x && x !== "—").sort();
    return {
      buyer: uniq(all.map((r) => r.buyer)),
      fy: uniq(all.map((r) => r.fy)),
      category: uniq(all.map((r) => r.category)),
      division: uniq(scoped.map((r) => r.division)),
    };
  }, [all, filters.buyer]);

  if (loading) return <Loading what="the explorer" />;
  if (error || !data) return <p className="text-muted">The explorer data is not available in this release.</p>;

  const sel = rows.filter((r) => r.selection != null);
  const openSel = sel.filter((r) => r.tenderType === "OPEN" && r.bidders != null);
  const ones = openSel.filter((r) => (r.bidders ?? 0) <= 1).length;
  const value = sel.reduce((a, r) => a + (r.bid ?? 0), 0);
  const windows = rows.map((r) => r.window).filter((w): w is number => w != null);
  const medWindow = median(windows);
  const anyFilter = FILTER_KEYS.some((k) => filters[k]);

  return (
    <div className="space-y-6" id="explore">
      {/* Filters: sticky on wide screens; collapsible on phones */}
      <details className="card p-4 lg:sticky lg:top-[57px] z-10 group" open>
        <summary className="text-title-s text-ink lg:hidden mb-3">
          <Icon name="sliders-horizontal" size={20} />
          Filters{anyFilter ? ` (${FILTER_KEYS.filter((k) => filters[k]).length} active)` : ""}
        </summary>
        <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filters">
          <F label="Who issued the tender" value={filters.buyer} onChange={(v) => set("buyer", v)} options={opts.buyer.map((b) => [b, `${b} · ${buyerNames[b] ?? b}`])} />
          <F label="Local office (division)" value={filters.division} onChange={(v) => set("division", v)} options={opts.division.map((d) => [d, d])} />
          <F label={<><Term k="fiscal_year">Financial year</Term> published</>} value={filters.fy} onChange={(v) => set("fy", v)} options={opts.fy.map((f) => [f, f])} />
          <F label="Type of work" value={filters.category} onChange={(v) => set("category", v)} options={opts.category.map((c) => [c, c])} />
          <F label={<>Open or <Term k="reserved">reserved</Term></>} value={filters.tenderType} onChange={(v) => set("tenderType", v)} options={[["OPEN", "Open to all"], ["RESERVED", "Reserved"]]} />
          {anyFilter && (
            <button type="button" className="btn-secondary" onClick={() => router.replace(`${pathname}`, { scroll: false })}>
              <Icon name="x" size={18} />
              Clear filters
            </button>
          )}
        </div>
        <p className="mt-3 text-body-s text-muted">
          Showing {rows.length.toLocaleString("en-IN")} tenders. The link in your address bar captures these filters, so you
          can share exactly this view.
        </p>
      </details>

      {/* The map */}
      <MapExplorer
        rows={mapRows}
        names={data.suppliers}
        fys={opts.fy}
        fy={filters.fy}
        setFy={(v) => set("fy", v)}
        area={filters.area}
        setArea={(v) => set("area", v)}
        ward={sp.get("ward") ?? ""}
        setWard={setWard}
        measure={measure}
        level={level}
        setView={setView}
        focusKey={`${filters.buyer}|${filters.division}`}
      />
      {filters.area && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-accent-soft px-4 py-2 text-body-m text-ink">
          <Icon name="map" size={20} />
          <span className="flex-1">Showing one area from the map. Every chart below is limited to it.</span>
          <button type="button" className="btn-ghost -my-1 text-ink" onClick={() => set("area", "")}>
            Show the whole city
          </button>
        </div>
      )}

      {/* KPIs in plain words */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Kpi label="Tenders in this view" value={rows.length.toLocaleString("en-IN")} sub={`${sel.length.toLocaleString("en-IN")} had a winner chosen`} />
        <Kpi label="Value of winning bids" value={inr(value)} sub="sum of the prices offered by the winners" />
        <Kpi
          label="Only one company competed"
          value={openSel.length ? oneIn(ones, openSel.length) : "—"}
          sub={openSel.length ? `${ones} of ${openSel.length} open contracts` : "no published bidder counts yet"}
          tone={openSel.length && ones / openSel.length > 0.2 ? "warn" : undefined}
        />
        <Kpi label={<>Typical <Term k="window">time to bid</Term></>} value={medWindow != null ? `${Math.round(medWindow)} days` : "—"} sub="half of tenders gave less than this" />
      </div>

      <Card
        q="Was there real competition?"
        what={<>How many companies got as far as the <Term k="price_round">price round</Term> for each open contract that had a winner. <Term k="reserved">Reserved</Term> tenders are left out because fewer bidders are expected there.</>}
        why="Competition keeps prices honest. When only one company is in the running, nobody is competing with it on price."
        takeaway={openSel.length ? `${oneIn(ones, openSel.length)} open contracts in this view had only one company competing on price.` : undefined}
      >
        <BidderBars rows={sel.filter((r) => r.tenderType === "OPEN")} />
      </Card>

      <Card
        q="Did the government pay more or less than its own estimate?"
        what={<>Each dot is one contract. Left to right: how big the job was. Up and down: how far the winning price was from the <Term k="estimate">official estimate</Term>.</>}
        how="Dots on the middle line were won at exactly the estimate. Orange dots are contracts where only one company competed. Hover over a dot for the details."
        why="Prices far above the estimate can mean overpaying. Prices far below can mean the work will not be done properly. A tight cluster right at the estimate is common in Bengaluru: bidders often quote the government's own rates."
        takeaway={scatterTakeaway(sel)}
      >
        <PriceScatter rows={sel} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          q="How much time did companies get to bid?"
          what={<>Days between a tender being published and the bid deadline (before any extensions).</>}
          how="Each bar counts tenders with that many days. Bars at the far left are the most rushed."
          why="A very short deadline can shut out companies that did not hear about the tender in advance."
          takeaway={windows.length ? `${pctOf(windows.filter((w) => w < 7).length, windows.length)} of tenders gave less than a week.` : undefined}
        >
          <WindowChart windows={windows} />
        </Card>
        <Card
          q="Were tenders changed after publication?"
          what={<>How many <Term k="corrigendum">change notices</Term> each tender received.</>}
          how="Most tenders are never changed. Bars to the right were changed several times."
          why="Changes are usually routine, but repeated changes can also be used to steer a tender toward one bidder."
          takeaway={rows.length ? `${pctOf(rows.filter((r) => r.corr >= 3).length, rows.length)} of tenders were changed 3 or more times.` : undefined}
        >
          <CorrBars rows={rows} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card
          q="When are tenders published?"
          what="The number of tenders published each month."
          how="Orange bars are March, the last month of the financial year."
          why="Departments often rush to spend their budgets before 31 March, which can mean less scrutiny and shorter deadlines."
        >
          <MonthlyVolume rows={rows} />
        </Card>
        <Card
          q="Is single-company competition getting better or worse?"
          what="Of the open contracts that had a winner, the share where only one company competed, by quarter."
          how="Hover over a point to see the counts behind it. Quarters with fewer than 10 contracts are left out."
          why="A rising line means competition is weakening."
        >
          <SingleBidTrend rows={rows} />
        </Card>
      </div>

      <Card
        q="Who wins where?"
        what="For each local office (division): how much of the work went to its three most frequent winners. Click an area to see every contractor's share."
        how="A long orange bar means three contractors won most of the work there. The thin line on the right-hand chart marks an even share."
        why="When a few firms win most jobs in an area, they face less pressure on price and quality. It can also simply mean few contractors work there."
      >
        <WhoWinsWhere rows={rows} names={data.suppliers} />
      </Card>

      <p className="text-sm text-ink-2">
        Want the specific cases? See the <Link href="/flags/">list of warning signs</Link>, each with its evidence, or browse{" "}
        <Link href="/tenders/">every tender</Link>.
      </p>
    </div>
  );
}

function Card({ q, what, how, why, takeaway, children }: { q: string; what: React.ReactNode; how?: string; why: string; takeaway?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <h3 className="text-title-l text-ink">{q}</h3>
      <p className="text-body-m text-ink-2 mt-1">{what}</p>
      {takeaway && <p className="callout mt-4 bg-accent-soft text-ink">{takeaway}</p>}
      <div className="mt-4">{children}</div>
      <details className="mt-4 text-body-m">
        <summary className="text-label-l text-accent">How to read this, and why it matters</summary>
        <div className="mt-2 space-y-1 pl-6 text-ink-2">
          {how && <p><strong className="text-ink">How to read it:</strong> {how}</p>}
          <p><strong className="text-ink">Why it matters:</strong> {why}</p>
          <p className="text-muted">A pattern here is a reason to look closer, not proof of wrongdoing.</p>
        </div>
      </details>
    </section>
  );
}

function Kpi({ label, value, sub, tone }: { label: React.ReactNode; value: React.ReactNode; sub?: string; tone?: "warn" }) {
  return (
    <div className={`rounded-lg px-4 py-4 ${tone === "warn" ? "border border-notice-border bg-notice-bg text-notice-ink" : "card"}`}>
      <div className={`label-mono ${tone === "warn" ? "" : "text-muted"}`}>{label}</div>
      <div className={`mt-2 font-mono text-headline-s font-medium tracking-tight tabular ${tone === "warn" ? "" : "text-ink"}`}>{value}</div>
      {sub && <div className={`text-body-s mt-1 ${tone === "warn" ? "" : "text-muted"}`}>{sub}</div>}
    </div>
  );
}

function F({ label, value, onChange, options }: { label: React.ReactNode; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="flex w-full flex-col gap-1 sm:w-auto">
      <span className="field-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="field w-full sm:w-auto sm:max-w-[15rem]">
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

function BidderBars({ rows }: { rows: Fact[] }) {
  const groups = ["1", "2", "3+", "unknown"] as const;
  const counts = Object.fromEntries(groups.map((g) => [g, rows.filter((r) => bidderGroup(r.bidders) === g).length]));
  const total = rows.length || 1;
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g} className="grid grid-cols-[8rem_1fr_7rem] items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 text-ink-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: BIDDER_COLORS[g] }} />
            {BIDDER_LABELS[g]}
          </span>
          <span className="h-5">
            <span className="block h-5 rounded-r-[4px]" style={{ width: `${Math.max(0.5, (counts[g] / total) * 100)}%`, background: BIDDER_COLORS[g] }} />
          </span>
          <span className="tabular text-ink">
            {counts[g].toLocaleString("en-IN")} <span className="text-muted">({Math.round((counts[g] / total) * 100)}%)</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function CorrBars({ rows }: { rows: Fact[] }) {
  const buckets = [
    { label: "Never changed", test: (n: number) => n === 0 },
    { label: "Once", test: (n: number) => n === 1 },
    { label: "Twice", test: (n: number) => n === 2 },
    { label: "3 or more times", test: (n: number) => n >= 3 },
  ];
  const total = rows.length || 1;
  return (
    <div className="space-y-2">
      {buckets.map((b, i) => {
        const n = rows.filter((r) => b.test(r.corr)).length;
        return (
          <div key={b.label} className="grid grid-cols-[8rem_1fr_7rem] items-center gap-3 text-sm">
            <span className="text-ink-2">{b.label}</span>
            <span className="h-5">
              <span className="block h-5 rounded-r-[4px]" style={{ width: `${Math.max(0.5, (n / total) * 100)}%`, background: i === 3 ? "var(--series-2)" : "var(--series-1)" }} />
            </span>
            <span className="tabular">
              {n.toLocaleString("en-IN")} <span className="text-muted">({Math.round((n / total) * 100)}%)</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function WindowChart({ windows }: { windows: number[] }) {
  if (windows.length < 5) return <p className="text-sm text-muted">Not enough tenders in this selection yet.</p>;
  const capped = windows.map((w) => Math.min(w, 45));
  const edges = Array.from({ length: 24 }, (_, i) => i * 2);
  const counts = edges.slice(0, -1).map((e, i) => capped.filter((w) => w >= e && (i === edges.length - 2 ? w <= edges[i + 1] : w < edges[i + 1])).length);
  return (
    <Histogram
      title=""
      counts={counts}
      edges={edges}
      xLabel="days given to bid (45+ grouped at the right)"
      format="days"
      refs={[{ value: 7, label: "1 week" }]}
      height={200}
    />
  );
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function oneIn(n: number, d: number): string {
  if (!d) return "—";
  if (!n) return "None";
  const k = Math.round(d / n);
  return k <= 1 ? `${Math.round((n / d) * 100)}%` : `1 in ${k}`;
}

function pctOf(n: number, d: number): string {
  if (!d) return "—";
  const p = (n / d) * 100;
  return p > 0 && p < 1 ? "Less than 1%" : `${Math.round(p)}%`;
}

function scatterTakeaway(sel: Fact[]): string | undefined {
  const v = sel.filter((r) => r.ecv && r.bid);
  if (!v.length) return undefined;
  const near = v.filter((r) => Math.abs(r.bid! / r.ecv! - 1) <= 0.01).length;
  const above = v.filter((r) => r.bid! / r.ecv! > 1.05).length;
  let out = `${pctOf(near, v.length)} of winning prices were within 1% of the official estimate; ${pctOf(above, v.length).toLowerCase()} were more than 5% above it.`;
  const diff = (rs: Fact[]) => median(rs.map((r) => (r.bid! / r.ecv! - 1) * 100));
  const one = v.filter((r) => r.bidders === 1);
  const many = v.filter((r) => (r.bidders ?? 0) >= 3);
  if (one.length >= 5 && many.length >= 5) {
    const d1 = diff(one)!, d3 = diff(many)!;
    const say = (d: number) => (Math.abs(d) < 0.5 ? "right at the estimate" : `${Math.abs(d).toFixed(0)}% ${d < 0 ? "below" : "above"} the estimate`);
    out += ` Typically, when only one company competed the price came in ${say(d1)}; when 3 or more competed it came in ${say(d3)}.`;
  }
  return out;
}
