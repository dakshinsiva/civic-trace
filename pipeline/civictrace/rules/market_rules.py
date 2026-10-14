"""Market-level rules: supplier share (1) and concentration (6)."""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.stats import binom

from ..models import Baseline, Coverage, Flag, Period, SourceLink
from ..sources import kppp
from .base import DATASET_NAME, RuleContext, RuleResult, flag_id, fy_bounds, is_partial_fy, jsonable, quantile_summary

LEVEL_KEYS = {
    "department": ["buyer_code", "work_category", "fy_decision"],
    "division": ["buyer_code", "division", "work_category", "fy_decision"],
}


def _selections(ctx: RuleContext) -> pd.DataFrame:
    df = ctx.calls
    return df[(~df["quarantined"]) & (df["detail_state"] != "pending") & df["has_selection"] & df["fy_decision"].notna()].copy()


def _slice_dict(level: str, keys: tuple) -> dict:
    names = LEVEL_KEYS[level]
    d = {"level": level, **{k: v for k, v in zip(names, keys)}}
    return {("fiscal_year" if k == "fy_decision" else "buyer" if k == "buyer_code" else k): v for k, v in d.items()}


def _slice_label(s: dict) -> str:
    parts = [s["buyer"]]
    if s.get("division"):
        parts.append(s["division"])
    parts += [s["work_category"], f"FY {s['fiscal_year']}"]
    return " · ".join(parts)


def _where(sd: dict) -> str:
    return f"{sd['division']} ({sd['buyer']})" if sd.get("division") else sd["buyer"]


def _period(fy: str, ctx: RuleContext) -> Period:
    s, e = fy_bounds(fy)
    return Period(
        label=f"FY {fy}",
        start=s,
        end=e,
        basis="award date, or bid close date when no award is recorded",
        partial=is_partial_fy(fy, ctx.full_cfg),
    )


def _slice_sources(g: pd.DataFrame) -> list[SourceLink]:
    return [
        SourceLink(
            label=f"KPPP portal — the {len(g)} tender records in this group are listed on this page, each with its own source links",
            url=kppp.PORTAL,
        )
    ]


def _shares(g: pd.DataFrame) -> pd.DataFrame:
    s = (
        g.groupby("supplier_id")
        .agg(wins=("nit_id", "count"), value=("bid_value", "sum"), name=("supplier_name", "last"))
        .sort_values("wins", ascending=False)
    )
    s["share"] = s["wins"] / s["wins"].sum()
    tv = s["value"].sum()
    s["value_share"] = s["value"] / tv if tv > 0 else np.nan
    return s


def _bh(pvals: list[float]) -> list[float]:
    """Benjamini–Hochberg adjusted q-values."""
    p = np.asarray(pvals, dtype=float)
    n = len(p)
    if n == 0:
        return []
    order = np.argsort(p)
    ranked = p[order] * n / (np.arange(n) + 1)
    q = np.minimum.accumulate(ranked[::-1])[::-1]
    out = np.empty(n)
    out[order] = np.minimum(q, 1.0)
    return out.tolist()


# ---------------------------------------------------------------- Rule 6

def concentration(ctx: RuleContext) -> RuleResult:
    cfg, res = ctx.cfg, RuleResult()
    sel = _selections(ctx)
    for level in cfg["levels"]:
        keys = LEVEL_KEYS[level]
        stats = []
        for k, g in sel.groupby(keys):
            sd = _slice_dict(level, k)
            key = f"{level}|" + "|".join(map(str, k))
            if len(g) < cfg["min_selections"]:
                ctx.notice(res, key, "too_small", f"{len(g)} selections < {cfg['min_selections']}")
                continue
            sh = _shares(g)
            hhi = float(((sh["share"] * 100) ** 2).sum())
            top3 = float(sh["share"].head(3).sum())
            stats.append((k, sd, g, sh, hhi, top3))
        if not stats:
            continue
        all_hhi = pd.Series([s[4] for s in stats])
        for k, sd, g, sh, hhi, top3 in stats:
            res.slices += 1
            res.evaluated += 1
            if not (hhi > cfg["hhi_threshold"] or top3 >= cfg["top3_threshold"]):
                continue
            sid = f"{level}:" + ":".join(map(str, k))
            top = sh.head(3).reset_index()
            res.flags.append(
                Flag(
                    flag_id=flag_id(ctx.rule_id, sid),
                    rule_id=ctx.rule_id,
                    rule_number=cfg["number"],
                    rule_name=cfg["name"],
                    rule_plain_name=cfg.get("plain_name"),
                    rule_version=cfg["version"],
                    subject_type="buyer_slice",
                    subject_id=sid,
                    headline=f"Just 3 contractors won {top3:.0%} of {len(g)} {sd['work_category'].lower()} contracts in {_where(sd)}, FY {sd['fiscal_year']}.",
                    observed=jsonable(
                        {
                            "hhi": round(hhi, 1),
                            "top3_share": round(top3, 4),
                            "effective_number_of_suppliers": round(10000 / hhi, 2),
                            "selections": int(len(g)),
                            "distinct_suppliers": int(len(sh)),
                            "top3_value_share": None if sh["value_share"].isna().all() else round(float(sh["value_share"].head(3).sum()), 4),
                            "top_suppliers": [
                                {"supplier_id": int(r["supplier_id"]), "name": r["name"], "selections": int(r["wins"]), "share": round(float(r["share"]), 4)}
                                for _, r in top.iterrows()
                            ],
                        }
                    ),
                    baseline=Baseline(
                        summary=(
                            f"The work behaved as if shared among about {10000 / hhi:.1f} equal-sized contractors "
                            f"(a typical comparable area: about {10000 / float(all_hhi.median()):.1f})."
                        ),
                        method=f"HHI across all {level}-level groups with ≥{cfg['min_selections']} selections; DOJ/OCP threshold HHI > {cfg['hhi_threshold']}; top-3 share ≥ {cfg['top3_threshold']:.0%}.",
                        values={
                            "hhi_threshold": cfg["hhi_threshold"],
                            "top3_threshold": cfg["top3_threshold"],
                            "median_hhi_comparable_groups": round(float(all_hhi.median()), 1),
                            "comparable_groups": int(len(all_hhi)),
                        },
                        distribution={"hhi_quantiles": quantile_summary(all_hhi)},
                    ),
                    period=_period(sd["fiscal_year"], ctx),
                    coverage=Coverage(
                        dataset=DATASET_NAME,
                        slice=sd,
                        n=int(len(g)),
                        completeness=ctx.completeness(g, ["supplier_id", "bid_value"]),
                        notes=[f"{int((g['selection_label'] == 'selected_no_award').sum())} of {len(g)} are selections with no award recorded on the portal."],
                    ),
                    source_links=_slice_sources(g),
                    non_fraud_explanations=cfg["non_fraud_explanations"],
                    limitations=cfg["limitations"],
                    context=jsonable({"slice": sd, "nit_ids": [int(x) for x in g["nit_id"]], "dept_id": int(g["dept_id"].iloc[0])}),
                )
            )
    return res


# ---------------------------------------------------------------- Rule 1

def supplier_share(ctx: RuleContext) -> RuleResult:
    cfg, res = ctx.cfg, RuleResult()
    sel = _selections(ctx)
    tests = []
    for level in cfg["levels"]:
        for k, g in sel.groupby(LEVEL_KEYS[level]):
            sd = _slice_dict(level, k)
            key = f"{level}|" + "|".join(map(str, k))
            n = len(g)
            if n < cfg["min_selections"]:
                ctx.notice(res, key, "too_small", f"{n} selections < {cfg['min_selections']}")
                continue
            sh = _shares(g)
            n_active = len(sh)
            if n_active < 2:
                ctx.notice(res, key, "single_supplier", "only one supplier selected; see concentration rule")
                continue
            res.slices += 1
            p0 = 1.0 / n_active
            for supplier_id, r in sh.iterrows():
                if r["wins"] < cfg["min_supplier_wins"]:
                    continue
                res.evaluated += 1
                p = float(binom.sf(int(r["wins"]) - 1, n, p0))
                tests.append((level, k, sd, g, sh, int(supplier_id), r, p, p0))
    qs = _bh([t[7] for t in tests])
    for (level, k, sd, g, sh, supplier_id, r, p, p0), q in zip(tests, qs):
        if q >= cfg["fdr_q"]:
            continue
        sid = f"{level}:" + ":".join(map(str, k)) + f":supplier:{supplier_id}"
        res.flags.append(
            Flag(
                flag_id=flag_id(ctx.rule_id, sid),
                rule_id=ctx.rule_id,
                rule_number=cfg["number"],
                rule_name=cfg["name"],
                rule_plain_name=cfg.get("plain_name"),
                rule_version=cfg["version"],
                subject_type="supplier_slice",
                subject_id=sid,
                headline=(
                    f"{r['name']} won {int(r['wins'])} of {len(g)} {sd['work_category'].lower()} contracts ({r['share']:.0%}) in "
                    f"{_where(sd)}, FY {sd['fiscal_year']}: about {r['share'] / p0:.1f}× an even share."
                ),
                observed=jsonable(
                    {
                        "supplier_id": supplier_id,
                        "supplier_name": r["name"],
                        "selections_won": int(r["wins"]),
                        "selections_in_group": int(len(g)),
                        "count_share": round(float(r["share"]), 4),
                        "value_share": None if pd.isna(r["value_share"]) else round(float(r["value_share"]), 4),
                        "p_value": float(f"{p:.3g}"),
                        "q_value_bh": float(f"{q:.3g}"),
                    }
                ),
                baseline=Baseline(
                    summary=f"{len(sh)} contractors won work here. If it were shared evenly, each would have about {p0:.0%}.",
                    method=f"Even split among the {len(sh)} suppliers selected in this group (one-sided binomial test, Benjamini–Hochberg q < {cfg['fdr_q']}).",
                    values={
                        "expected_share_even_split": round(p0, 4),
                        "active_suppliers": int(len(sh)),
                        "median_supplier_share": round(float(sh["share"].median()), 4),
                    },
                    distribution={"supplier_share_quantiles": quantile_summary(sh["share"])},
                ),
                period=_period(sd["fiscal_year"], ctx),
                coverage=Coverage(
                    dataset=DATASET_NAME,
                    slice=sd,
                    n=int(len(g)),
                    completeness=ctx.completeness(g, ["supplier_id"]),
                    notes=[f"{int((g['selection_label'] == 'selected_no_award').sum())} of {len(g)} are selections with no award recorded on the portal."],
                ),
                source_links=_slice_sources(g),
                non_fraud_explanations=cfg["non_fraud_explanations"],
                limitations=cfg["limitations"],
                context=jsonable(
                    {
                        "slice": sd,
                        "supplier_id": supplier_id,
                        "nit_ids": [int(x) for x in g.loc[g["supplier_id"] == supplier_id, "nit_id"]],
                        "dept_id": int(g["dept_id"].iloc[0]),
                    }
                ),
            )
        )
    return res
