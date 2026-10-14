"""Tender-call level rules: single bidder (2), short window (3), amendments (4), award ratio (5)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..models import Baseline, Coverage, Flag, Period
from .base import (
    DATASET_NAME,
    RuleContext,
    RuleResult,
    flag_id,
    fy_bounds,
    histogram,
    iqr_fences,
    is_partial_fy,
    jsonable,
    quantile_summary,
)


def _usable(df: pd.DataFrame) -> pd.DataFrame:
    """Calls whose details were attempted (not still queued) and not quarantined.

    Queued calls are not yet observed, so they must not count as missing data.
    Calls whose details the portal failed to return ('unavailable') do count.
    """
    return df[(~df["quarantined"]) & (df["detail_state"] != "pending")]


def _call_context(row) -> dict:
    return jsonable(
        {
            "nit_id": int(row["nit_id"]),
            "tender_number": row["tender_number"],
            "title": row["title"],
            "buyer_code": row["buyer_code"],
            "dept_id": int(row["dept_id"]),
            "division": row["division"],
            "work_category": row["work_category"],
            "tender_type": row["tender_type"],
            "call_no": int(row["call_no"]),
            "status": row["status"],
            "supplier_id": None if pd.isna(row.get("supplier_id")) else int(row["supplier_id"]),
            "supplier_name": None if pd.isna(row.get("supplier_name")) else row["supplier_name"],
            "selection_label": None if pd.isna(row.get("selection_label")) else row["selection_label"],
        }
    )


def _fy_period(fy: str | None, basis: str, cfg: dict) -> Period:
    if not fy:
        return Period(label="Unknown period", basis=basis)
    s, e = fy_bounds(fy)
    return Period(label=f"FY {fy}", start=s, end=e, basis=basis, partial=is_partial_fy(fy, cfg))


def _range_period(df: pd.DataFrame, col: str, basis: str) -> Period:
    vals = df[col].dropna()
    if vals.empty:
        return Period(label="Unknown period", basis=basis)
    s, e = str(vals.min())[:10], str(vals.max())[:10]
    return Period(label=f"{s} to {e}", start=s, end=e, basis=basis, partial=True)


def _vs_estimate(ratio: float) -> str:
    d = ratio - 1
    if abs(d) < 0.005:
        return "almost exactly the official estimate"
    return f"{abs(d):.0%} {'above' if d > 0 else 'below'} the official estimate"


def _ratio_headline(ratio: float, typical: float) -> str:
    d = ratio - 1
    where = f"{abs(d):.0%} {'above' if d > 0 else 'below'}"
    tail = "" if d > 0 else " That is unusually low."
    return f"The winning price was {where} the official estimate (similar works: {_vs_estimate(typical)}).{tail}"


# ---------------------------------------------------------------- Rule 2

def single_bidder(ctx: RuleContext) -> RuleResult:
    cfg, res = ctx.cfg, RuleResult()
    df = _usable(ctx.calls)
    df = df[df["has_selection"] & (df["tender_type"] == "OPEN")]
    for (buyer, fy), g in df.groupby(["buyer_code", "fy_decision"], dropna=True):
        key = f"{buyer}|{fy}"
        comp = ctx.completeness(g, ["n_price_stage_bidders"])
        if not ctx.coverage_ok(comp):
            ctx.notice(res, key, "coverage_insufficient", f"bidder counts known for {comp['n_price_stage_bidders']:.0%} of {len(g)} selections")
            continue
        known = g[g["n_price_stage_bidders"].notna()]
        singles = known[known["n_price_stage_bidders"] == 1]
        rate = len(singles) / len(known)
        res.slices += 1
        res.evaluated += len(known)
        dist = known["n_price_stage_bidders"].astype(int).value_counts().sort_index()
        for _, row in singles.iterrows():
            sid = str(int(row["nit_id"]))
            res.flags.append(
                Flag(
                    flag_id=flag_id(ctx.rule_id, sid),
                    rule_id=ctx.rule_id,
                    rule_number=cfg["number"],
                    rule_name=cfg["name"],
                    rule_plain_name=cfg.get("plain_name"),
                    rule_version=cfg["version"],
                    subject_type="tender_call",
                    subject_id=sid,
                    headline="Only one company competed on price for this tender, and it was selected.",
                    observed=jsonable(
                        {
                            "price_stage_bidders": 1,
                            "selected_bid_value": row["bid_value"],
                            "estimated_contract_value": row["ecv"],
                            "call_no": int(row["call_no"]),
                        }
                    ),
                    baseline=Baseline(
                        summary=f"In FY {fy}, {len(singles)} of {len(known)} {buyer} contracts ({rate:.0%}) had only one company competing on price.",
                        method=f"Share of {buyer}'s open-tender selections in FY {fy} with exactly one price-stage bidder.",
                        values=jsonable(
                            {
                                "buyer_single_bidder_rate": round(rate, 4),
                                "single_bidder_selections": len(singles),
                                "selections_with_known_bidder_count": len(known),
                                "context_eu_scoreboard_bands": "≤10% good, 10–20% average, >20% poor (national-level benchmark, context only)",
                            }
                        ),
                        distribution={"bidder_count_frequencies": {str(k): int(v) for k, v in dist.items()}},
                    ),
                    period=_fy_period(fy, "award date, or bid close date when no award is recorded", ctx.full_cfg),
                    coverage=Coverage(
                        dataset=DATASET_NAME,
                        slice={"buyer": buyer, "fiscal_year": fy, "tender_type": "OPEN"},
                        n=len(g),
                        completeness=comp,
                    ),
                    source_links=ctx.call_sources(row),
                    non_fraud_explanations=cfg["non_fraud_explanations"],
                    limitations=cfg["limitations"],
                    context=_call_context(row),
                )
            )
    return res


# ---------------------------------------------------------------- Rule 3

def short_window(ctx: RuleContext) -> RuleResult:
    cfg, res = ctx.cfg, RuleResult()
    df = _usable(ctx.calls)
    df = df[df["inviting_strategy"].fillna("OPEN") == "OPEN"].copy()
    pub = pd.to_datetime(df["published_at"], errors="coerce", utc=True)
    close = pd.to_datetime(df["close_at_original"], errors="coerce", utc=True)
    df["window_days"] = (close - pub).dt.total_seconds() / 86400.0
    min_slice = cfg["min_slice"]
    for (buyer, cat, kind), g in df.groupby(["buyer_code", "work_category", "call_kind"]):
        key = f"{buyer}|{cat}|{kind}"
        comp = ctx.completeness(g, ["published_at", "close_at_original"])
        if not ctx.coverage_ok(comp):
            ctx.notice(res, key, "coverage_insufficient", f"original deadline known for {comp['close_at_original']:.0%} of {len(g)} calls")
            continue
        w = g["window_days"].dropna()
        w = w[w > 0]
        if len(w) < min_slice:
            ctx.notice(res, key, "too_small", f"{len(w)} calls < {min_slice}")
            continue
        q1, med, q3, lo, _hi = iqr_fences(w)
        if q3 - q1 <= 0:
            ctx.notice(res, key, "zero_spread", f"IQR is 0 (most windows = {med:.1f} days)")
            continue
        res.slices += 1
        res.evaluated += len(w)
        floor = med - cfg.get("min_days_below_median", 0)
        hits = g[(g["window_days"] > 0) & (g["window_days"] < lo) & (g["window_days"] <= floor)]
        for _, row in hits.iterrows():
            sid = str(int(row["nit_id"]))
            res.flags.append(
                Flag(
                    flag_id=flag_id(ctx.rule_id, sid),
                    rule_id=ctx.rule_id,
                    rule_number=cfg["number"],
                    rule_name=cfg["name"],
                    rule_plain_name=cfg.get("plain_name"),
                    rule_version=cfg["version"],
                    subject_type="tender_call",
                    subject_id=sid,
                    headline=f"Companies had {row['window_days']:.0f} day{'s' if round(row['window_days']) != 1 else ''} to bid; similar {buyer} tenders usually allow {med:.0f}.",
                    direction="low",
                    observed=jsonable(
                        {
                            "window_days": round(row["window_days"], 2),
                            "published_at": row["published_at"],
                            "original_bid_deadline": row["close_at_original"],
                            "final_bid_deadline": row["close_at_final"],
                            "estimated_contract_value": row["ecv"],
                        }
                    ),
                    baseline=Baseline(
                        summary=f"Half of {len(w)} similar {buyer} {cat.lower()} tenders ({kind}s) gave {med:.0f} days or more; this one gave {row['window_days']:.0f}.",
                        method=(
                            f"Windows of {buyer} {cat} tenders ({kind}s). Flagged below Q1 − 1.5×IQR. "
                            "Statutory-minimum comparison disabled pending verified rule text."
                        ),
                        values={
                            "median_days": round(med, 2),
                            "q1_days": round(q1, 2),
                            "q3_days": round(q3, 2),
                            "lower_fence_days": round(lo, 2),
                            "materiality_floor_days": round(floor, 2),
                            "comparison_calls": int(len(w)),
                        },
                        distribution=histogram(w, bins=min(30, max(10, int(w.max() - w.min()) + 1))),
                    ),
                    period=_range_period(g, "published_at", "publication date of comparable calls"),
                    coverage=Coverage(
                        dataset=DATASET_NAME,
                        slice={"buyer": buyer, "work_category": cat, "call_kind": kind},
                        n=len(g),
                        completeness=comp,
                    ),
                    source_links=ctx.call_sources(row),
                    non_fraud_explanations=cfg["non_fraud_explanations"],
                    limitations=cfg["limitations"],
                    context=_call_context(row),
                )
            )
    return res


# ---------------------------------------------------------------- Rule 4

def amendments(ctx: RuleContext) -> RuleResult:
    cfg, res = ctx.cfg, RuleResult()
    df = _usable(ctx.calls)
    df = df[df["corrigenda_doc_id"].notna() & (df["status"] != "NO_BIDS_RECIEVED")]
    min_c, min_e = cfg["min_corrigenda"], cfg["min_deadline_extensions"]
    for (buyer, cat), g in df.groupby(["buyer_code", "work_category"]):
        res.slices += 1
        res.evaluated += len(g)
        hit_mask = (g["n_corrigenda"] >= min_c) | (g["n_deadline_extensions"] >= min_e)
        share = float(hit_mask.mean())
        dist = g["n_corrigenda"].astype(int).value_counts().sort_index()
        for _, row in g[hit_mask].iterrows():
            sid = str(int(row["nit_id"]))
            res.flags.append(
                Flag(
                    flag_id=flag_id(ctx.rule_id, sid),
                    rule_id=ctx.rule_id,
                    rule_number=cfg["number"],
                    rule_name=cfg["name"],
                    rule_plain_name=cfg.get("plain_name"),
                    rule_version=cfg["version"],
                    subject_type="tender_call",
                    subject_id=sid,
                    headline=(
                        f"This tender was changed {int(row['n_corrigenda'])} time{'s' if int(row['n_corrigenda']) != 1 else ''} after publication, "
                        f"including {int(row['n_deadline_extensions'])} deadline extension{'s' if int(row['n_deadline_extensions']) != 1 else ''}."
                    ),
                    observed=jsonable(
                        {
                            "corrigenda": int(row["n_corrigenda"]),
                            "deadline_extensions": int(row["n_deadline_extensions"]),
                            "original_bid_deadline": row["close_at_original"],
                            "final_bid_deadline": row["close_at_final"],
                            "outcome_status": row["status"],
                        }
                    ),
                    baseline=Baseline(
                        summary=f"Only {share:.0%} of {len(g)} similar {buyer} {cat.lower()} tenders were changed this often.",
                        method=f"Corrigenda counts for {buyer} {cat} calls (excluding calls that ended with no bids).",
                        values={
                            "share_of_comparable_calls_meeting_threshold": round(share, 4),
                            "comparable_calls": int(len(g)),
                            "median_corrigenda": float(g["n_corrigenda"].median()),
                            "threshold": f"≥{min_c} corrigenda or ≥{min_e} deadline extensions",
                        },
                        distribution={"corrigenda_count_frequencies": {str(k): int(v) for k, v in dist.items()}},
                    ),
                    period=_range_period(g, "published_at", "publication date of comparable calls"),
                    coverage=Coverage(
                        dataset=DATASET_NAME,
                        slice={"buyer": buyer, "work_category": cat},
                        n=len(g),
                        completeness={"corrigenda_fetched": 1.0},
                    ),
                    source_links=ctx.call_sources(row),
                    non_fraud_explanations=cfg["non_fraud_explanations"],
                    limitations=cfg["limitations"],
                    context=_call_context(row),
                )
            )
    return res


# ---------------------------------------------------------------- Rule 5

def award_ratio(ctx: RuleContext) -> RuleResult:
    cfg, res = ctx.cfg, RuleResult()
    df = _usable(ctx.calls)
    df = df[df["has_selection"]].copy()
    df["bid_value_type"] = df["bid_value_type"].fillna(df["commercial_bid_type"]).fillna("UNKNOWN")
    min_slice = cfg["min_slice"]
    for (cat, bvt), g in df.groupby(["work_category", "bid_value_type"]):
        key = f"{cat}|{bvt}"
        comp = ctx.completeness(g, ["ecv", "bid_value"])
        if not ctx.coverage_ok(comp):
            ctx.notice(res, key, "coverage_insufficient", f"estimate known for {comp['ecv']:.0%}, bid for {comp['bid_value']:.0%} of {len(g)}")
            continue
        v = g[(g["ecv"] > 0) & (g["bid_value"] > 0)].copy()
        v["ratio"] = v["bid_value"] / v["ecv"]
        if len(v) < min_slice:
            ctx.notice(res, key, "too_small", f"{len(v)} selections < {min_slice}")
            continue
        logr = np.log(v["ratio"])
        q1, med, q3, lo, hi = iqr_fences(logr)
        if q3 - q1 <= 0:
            ctx.notice(res, key, "zero_spread", "IQR of log ratio is 0")
            continue
        res.slices += 1
        res.evaluated += len(v)
        hi_floor, lo_floor = cfg.get("high_min_ratio", 0), cfg.get("low_max_ratio", float("inf"))
        hit = ((logr > hi) & (v["ratio"] >= hi_floor)) | ((logr < lo) & (v["ratio"] <= lo_floor))
        for _, row in v[hit].iterrows():
            sid = str(int(row["nit_id"]))
            high = np.log(row["ratio"]) > hi
            res.flags.append(
                Flag(
                    flag_id=flag_id(ctx.rule_id, sid),
                    rule_id=ctx.rule_id,
                    rule_number=cfg["number"],
                    rule_name=cfg["name"],
                    rule_plain_name=cfg.get("plain_name"),
                    rule_version=cfg["version"],
                    subject_type="tender_call",
                    subject_id=sid,
                    headline=_ratio_headline(row["ratio"], float(np.exp(med))),
                    direction="high" if high else "low",
                    observed=jsonable(
                        {
                            "bid_to_estimate_ratio": round(row["ratio"], 4),
                            "selected_bid_value": row["bid_value"],
                            "negotiated_value": row["negotiated_value"],
                            "estimated_contract_value": row["ecv"],
                            "bid_tax_type": row["bid_tax_type"],
                        }
                    ),
                    baseline=Baseline(
                        summary=f"Across {len(v)} similar {cat.lower()} contracts, the winning price was usually {_vs_estimate(float(np.exp(med)))}.",
                        method=f"Bid ÷ estimate ratios for {cat} ({bvt}) selections, log scale; fences at Q1 − 1.5×IQR and Q3 + 1.5×IQR.",
                        values={
                            "median_ratio": round(float(np.exp(med)), 4),
                            "lower_fence_ratio": round(float(np.exp(lo)), 4),
                            "upper_fence_ratio": round(float(np.exp(hi)), 4),
                            "materiality_floors": f"≥{hi_floor}× or ≤{lo_floor}×",
                            "comparison_selections": int(len(v)),
                        },
                        distribution={**histogram(v["ratio"], bins=30, log=True), "quantiles": quantile_summary(v["ratio"])},
                    ),
                    period=_range_period(v, "decision_date", "award date, or bid close date when no award is recorded"),
                    coverage=Coverage(
                        dataset=DATASET_NAME,
                        slice={"work_category": cat, "bid_value_type": bvt},
                        n=len(g),
                        completeness=comp,
                    ),
                    source_links=ctx.call_sources(row),
                    non_fraud_explanations=cfg["non_fraud_explanations"],
                    limitations=cfg["limitations"],
                    context=_call_context(row),
                )
            )
    return res
