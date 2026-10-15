"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { Term } from "@/components/Term";
import { ErrorNote, FlagList, Loading, PageTitle, Section } from "@/components/ui";
import { date, datetime, inr, selectionLabel, statusLabel } from "@/lib/format";
import type { TenderDoc } from "@/lib/types";
import { useRecord } from "@/lib/useJson";

export function TenderView() {
  const id = useSearchParams().get("id");
  const safe = id && /^\d{1,9}$/.test(id) ? id : null;
  const { data: t, error, loading } = useRecord<TenderDoc>("tenders", safe);
  // The page shell is static, so name the browser tab after the record once it loads.
  useEffect(() => {
    if (t) document.title = `${t.title || t.tender_number} · CivicTrace Bengaluru`;
  }, [t]);
  if (loading) return <Loading what="tender" />;
  if (error || !t) return <ErrorNote message={error ?? "Tender not found."} />;

  const callFlags = t.flags.filter((f) => f.subject_type === "tender_call");
  const marketFlags = t.flags.filter((f) => f.subject_type !== "tender_call");
  const ratio = t.selection?.bid_value && t.ecv ? t.selection.bid_value / t.ecv : null;
  const windowDays =
    t.published_at && t.close_at_original ? (new Date(t.close_at_original).getTime() - new Date(t.published_at).getTime()) / 86400000 : null;

  return (
    <div className="space-y-5">
      <PageTitle eyebrow={`${t.buyer_name} · ${t.division}`} title={t.title || t.tender_number}>
        <p className="text-sm tabular">
          {t.tender_number} · {t.work_category} · {t.tender_type === "RESERVED" ? "Reserved tender" : "Open tender"} ·{" "}
          {statusLabel(t.status)}
        </p>
      </PageTitle>

      {t.quarantine.length > 0 && (
        <div role="note" className="rounded-md border border-notice-border bg-notice-bg px-4 py-3 text-sm text-notice-ink">
          <strong>Data-quality hold.</strong> This record failed an automatic consistency check (
          {t.quarantine.map((q) => q.reason.replace(/_/g, " ")).join("; ")}). It is excluded from all indicators
          {t.quarantine.some((q) => q.reason.endsWith("mismatch")) && ", and the selected bidder is not shown"} until it is reviewed.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Fact label={<Term k="estimate">Official estimate</Term>} value={inr(t.ecv)} sub="what the government expected it to cost" />
        <Fact label={<Term k="winning_bid">Winning price</Term>} value={inr(t.selection?.bid_value)} sub={ratio ? vsEstimate(ratio) : "no winner chosen yet"} />
        <Fact label={<>Companies competing on <Term k="price_round">price</Term></>} value={t.n_price_stage_bidders ?? "—"} sub={t.n_price_stage_bidders == null ? "not published" : t.n_price_stage_bidders === 1 ? "no price competition" : "listed below"} />
        <Fact label={<Term k="window">Time given to bid</Term>} value={windowDays != null ? `${Math.round(windowDays)} days` : "—"} sub="from publication to the deadline" />
      </div>

      <Section title="Warning signs">
        <FlagList flags={callFlags} empty="None of our checks flagged this tender. That is not a clean bill of health; it only means these particular patterns did not appear." />
        {marketFlags.length > 0 && (
          <>
            <h3 className="text-sm font-medium text-ink mt-4 mb-2">Area-wide warning signs that include this tender</h3>
            <FlagList flags={marketFlags} />
          </>
        )}
      </Section>

      <Section title="What happened, step by step">
        <ol className="relative border-l border-grid ml-2 space-y-3 text-sm">
          <TL when={t.published_at} what="Tender published on the government portal" />
          {t.amendments.map((a) => (
            <TL
              key={a.seq}
              when={a.created_at}
              what={`Change notice ${a.seq}${a.reason ? `, reason given: “${a.reason}”` : ""}`}
              detail={a.close_original && a.close_revised ? `Deadline ${datetime(a.close_original)} → ${datetime(a.close_revised)}` : undefined}
            />
          ))}
          <TL when={t.close_at_final} what="Deadline for bids" detail={t.close_at_original !== t.close_at_final ? `originally ${datetime(t.close_at_original)}` : undefined} />
          {t.tech_open_at && <TL when={t.tech_open_at} what="Bids opened (documents and qualifications checked first)" />}
          {t.selection && (
            <TL when={t.award_date} what={selectionLabel(t.selection.label)} detail={`${t.selection.supplier_name} · ${inr(t.selection.bid_value)}`} />
          )}
        </ol>
      </Section>

      {t.selection && (
        <Section title="Who won">
          <dl className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,16rem)_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-ink-2">Supplier (as named on KPPP)</dt>
            <dd>
              {t.selection.supplier_id ? <Link href={`/supplier/?id=${t.selection.supplier_id}`}>{t.selection.supplier_name}</Link> : t.selection.supplier_name}
              {t.selection.supplier_id && <span className="text-muted tabular"> · KPPP supplier ID {t.selection.supplier_id}</span>}
            </dd>
            <dt className="text-ink-2">Status</dt>
            <dd>{selectionLabel(t.selection.label)}</dd>
            <dt className="text-ink-2">Price offered</dt>
            <dd className="tabular">{inr(t.selection.bid_value, { compact: false })}</dd>
            <dt className="text-ink-2">Price after negotiation</dt>
            <dd className="tabular">
              {inr(t.selection.negotiated_value, { compact: false })}
              {t.selection.negotiated_value != null && t.ecv != null && Math.abs(t.selection.negotiated_value - t.ecv) < 1 && (
                <span className="text-muted"> (equal to the estimate)</span>
              )}
            </dd>
            <dt className="text-ink-2">Tax basis of bid</dt>
            <dd>{t.selection.bid_tax_type?.replace(/_/g, " ").toLowerCase() ?? "—"}</dd>
          </dl>
        </Section>
      )}

      <Section title="Who competed on price">
        {t.bidders.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="data">
                <thead>
                  <tr>
                    <th>Company (as named by the portal)</th>
                    <th className="num">Price offered</th>
                    <th className="num">Compared with the estimate</th>
                    <th>Rank (L1 = lowest)</th>
                  </tr>
                </thead>
                <tbody>
                  {t.bidders.map((b) => (
                    <tr key={b.position}>
                      <td>{b.raw_name}</td>
                      <td className="num">{inr(b.total_bid, { compact: false })}</td>
                      <td className="num">{b.total_bid && t.ecv ? `${((b.total_bid / t.ecv - 1) * 100).toFixed(2)}%` : "—"}</td>
                      <td className="tabular">{b.rank ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted mt-2">
              From the government&apos;s published comparison of prices. Companies rejected earlier, at the document and
              qualification check, are not listed. Names are shown exactly as published.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">No price comparison has been published for this tender (it may not have reached that stage).</p>
        )}
      </Section>

      {t.calls_in_process.length > 1 && (
        <Section title="Every time this work was advertised">
          <p className="text-sm text-ink-2 mb-2">
            When a tender gets no acceptable bids, the same work is advertised again as a new &ldquo;call&rdquo; (a{" "}
            <Term k="retender">re-tender</Term>). All calls for {t.process_key}:
          </p>
          <div className="overflow-x-auto">
            <table className="data">
              <thead>
                <tr>
                  <th>Call</th>
                  <th>Published</th>
                  <th>Deadline</th>
                  <th>Outcome</th>
                  <th className="num">Companies competing</th>
                </tr>
              </thead>
              <tbody>
                {t.calls_in_process.map((c) => (
                  <tr key={c.nit_id}>
                    <td className="tabular">
                      {c.nit_id === t.nit_id ? <strong>Call {c.call_no} (this)</strong> : <Link href={`/tender/?id=${c.nit_id}`}>Call {c.call_no}</Link>}
                    </td>
                    <td>{date(c.published_at)}</td>
                    <td>{date(c.close_at_final)}</td>
                    <td>{statusLabel(c.status)}</td>
                    <td className="num">{c.n_price_stage_bidders ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title="Tender details">
        <dl className="grid grid-cols-1 sm:grid-cols-[minmax(10rem,16rem)_1fr] gap-x-4 gap-y-1.5 text-sm">
          <D k="Buyer" v={<Link href={`/buyers/${t.buyer_code}/`}>{t.buyer_name}</Link>} />
          <D k="Division / location" v={t.division} />
          <D k="Publishing office (designation code)" v={t.published_by_post ?? "—"} />
          <D k="Work category" v={t.work_category} />
          <D k="Notice type" v={t.notice_type ?? "—"} />
          <D k="Evaluation" v={t.evaluation_type?.replace(/_/g, " ").toLowerCase() ?? "—"} />
          <D k="Bid type" v={t.bid_value_type?.replace(/_/g, " ").toLowerCase() ?? "—"} />
          <D k="Published" v={datetime(t.published_at)} />
          <D k="Original deadline" v={datetime(t.close_at_original)} />
          <D k="Final deadline" v={datetime(t.close_at_final)} />
          <D k="Number of calls (per portal)" v={t.no_of_calls ?? "—"} />
          <D k="Fiscal year (published)" v={t.fy_published ?? "—"} />
          <D k="Status history (as observed)" v={t.status_history.map((s) => `${statusLabel(s.status)} (${date(s.first_observed_at)})`).join(" → ")} />
        </dl>
      </Section>

      <Section title="Sources">
        <ul className="space-y-1.5 text-sm">
          {t.sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
              <span className="text-muted"> · retrieved {date(s.fetched_at)} · sha256 {s.sha256?.slice(0, 16)}…</span>
            </li>
          ))}
          <li>
            <a href={t.portal_url} target="_blank" rel="noopener noreferrer">
              Search this tender on KPPP
            </a>
            <span className="text-muted"> (tender number {t.tender_number})</span>
          </li>
        </ul>
      </Section>
    </div>
  );
}

function vsEstimate(ratio: number): string {
  const d = ratio - 1;
  if (Math.abs(d) < 0.005) return "the same as the estimate";
  return `${Math.abs(d * 100).toFixed(0)}% ${d > 0 ? "above" : "below"} the estimate`;
}

function Fact({ label, value, sub }: { label: React.ReactNode; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-title-l tabular">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
    </div>
  );
}

function TL({ when, what, detail }: { when: string | null; what: string; detail?: string }) {
  return (
    <li className="ml-4">
      <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-[var(--series-1)]" />
      <div className="text-xs text-muted tabular">{datetime(when)}</div>
      <div className="text-ink">{what}</div>
      {detail && <div className="text-ink-2 text-xs">{detail}</div>}
    </li>
  );
}

function D({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <dt className="text-ink-2">{k}</dt>
      <dd className="break-words">{v}</dd>
    </>
  );
}
