"""Shared dataset + helpers for rules.

A rule is a function `(ctx: RuleContext) -> RuleResult`. It gets the joined
call-level DataFrame and its own config block, and returns Flag models plus
notices for slices it could not evaluate (too small, no spread, poor coverage).
"""

from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import dataclass, field
from datetime import date, datetime

import numpy as np
import pandas as pd
import yaml

from .. import CONFIG_DIR
from ..models import Flag, SourceLink
from ..sources import kppp

DATASET_NAME = "KPPP works tenders — Bengaluru municipal buyers (GBA family)"


def load_config() -> dict:
    return yaml.safe_load((CONFIG_DIR / "rules.yaml").read_text())


def fiscal_year(ts: str | None) -> str | None:
    """'2024-07-01T…' -> '2024-25' (April–March)."""
    if not ts or pd.isna(ts):
        return None
    d = datetime.fromisoformat(str(ts)).date() if "T" in str(ts) else date.fromisoformat(str(ts)[:10])
    y = d.year if d.month >= 4 else d.year - 1
    return f"{y}-{str(y + 1)[-2:]}"


def current_fy() -> str:
    return fiscal_year(date.today().isoformat())  # type: ignore[return-value]


def fy_bounds(fy: str) -> tuple[str, str]:
    y = int(fy[:4])
    return f"{y}-04-01", f"{y + 1}-03-31"


def is_partial_fy(fy: str, cfg: dict) -> bool:
    return fy in set(cfg["defaults"].get("partial_fys", [])) or fy == current_fy()


def load_calls(conn: sqlite3.Connection) -> pd.DataFrame:
    df = pd.read_sql_query(
        """
        SELECT t.*, b.code AS buyer_code, b.name AS buyer_name, b.family AS buyer_family,
               a.supplier_id, a.supplier_name, a.bid_value, a.negotiated_value, a.contract_value,
               a.label AS selection_label, a.bid_status, a.commercial_bid_type, a.tax_type AS bid_tax_type,
               a.doc_id AS award_doc_id,
               bs.n_price_stage_bidders, bs.doc_id AS bidders_doc_id,
               (SELECT COUNT(*) FROM amendment m WHERE m.nit_id = t.nit_id) AS n_corrigenda,
               (SELECT COUNT(*) FROM amendment m WHERE m.nit_id = t.nit_id
                  AND m.close_revised IS NOT NULL AND m.close_original IS NOT NULL
                  AND m.close_revised > m.close_original) AS n_deadline_extensions,
               (SELECT GROUP_CONCAT(reason, ' | ') FROM quarantine q WHERE q.nit_id = t.nit_id) AS quarantine_reasons
        FROM tender_call t
        JOIN buyer b ON b.dept_id = t.dept_id
        LEFT JOIN award a ON a.nit_id = t.nit_id
        LEFT JOIN bid_summary bs ON bs.nit_id = t.nit_id
        """,
        conn,
    )
    if df.empty:
        return df
    df["fy_published"] = df["published_at"].map(fiscal_year)
    # Decision date: recorded award date; for selections without a recorded award, the bid close date.
    df["decision_date"] = np.where(df["award_date"].notna(), df["award_date"], df["close_at_final"])
    df["fy_decision"] = df["decision_date"].map(fiscal_year)
    df["call_kind"] = np.where(df["call_no"] > 1, "re-tender", "first call")
    df["has_selection"] = df["supplier_id"].notna()
    df["quarantined"] = df["quarantine_reasons"].notna()
    df["work_category"] = df["work_category"].fillna("Unspecified")
    df["division"] = df["location_name"].fillna("Unspecified division")
    return df


@dataclass
class RuleResult:
    flags: list[Flag] = field(default_factory=list)
    notices: list[dict] = field(default_factory=list)
    evaluated: int = 0          # subjects evaluated
    slices: int = 0             # comparison groups evaluated


@dataclass
class RuleContext:
    rule_id: str
    cfg: dict                   # this rule's config block
    defaults: dict
    full_cfg: dict
    calls: pd.DataFrame
    doc_lookup: dict[int, dict]

    def notice(self, result: RuleResult, slice_key: str, kind: str, detail: str) -> None:
        result.notices.append({"rule_id": self.rule_id, "slice_key": slice_key, "kind": kind, "detail": detail})

    def completeness(self, df: pd.DataFrame, fields: list[str]) -> dict[str, float]:
        if len(df) == 0:
            return {f: 0.0 for f in fields}
        return {f: round(float(df[f].notna().mean()), 3) for f in fields}

    def coverage_ok(self, comp: dict[str, float]) -> bool:
        return all(v >= self.defaults["min_completeness"] for v in comp.values())

    def call_sources(self, row) -> list[SourceLink]:
        links = []
        for col, label in (
            ("detail_doc_id", "KPPP tender record (full view)"),
            ("corrigenda_doc_id", "KPPP corrigenda"),
            ("award_doc_id", "KPPP selected bid"),
            ("bidders_doc_id", "KPPP comparative statement (bidders)"),
            ("search_doc_id", "KPPP search listing"),
        ):
            doc_id = row.get(col) if hasattr(row, "get") else row[col]
            if doc_id is not None and not pd.isna(doc_id):
                d = self.doc_lookup.get(int(doc_id))
                if d:
                    url = d["url"]
                    if col == "search_doc_id":
                        url = kppp.PORTAL  # search is a POST; cite the portal
                    links.append(SourceLink(label=label, url=url, sha256=d["sha256"], fetched_at=d["fetched_at"]))
        return links


def flag_id(rule_id: str, subject_id: str) -> str:
    return hashlib.sha1(f"{rule_id}:{subject_id}".encode()).hexdigest()[:16]


def iqr_fences(values: pd.Series) -> tuple[float, float, float, float, float]:
    q1, med, q3 = (float(x) for x in np.quantile(values, [0.25, 0.5, 0.75]))
    iqr = q3 - q1
    return q1, med, q3, q1 - 1.5 * iqr, q3 + 1.5 * iqr


def quantile_summary(values: pd.Series) -> dict:
    qs = np.quantile(values, [0.0, 0.05, 0.25, 0.5, 0.75, 0.95, 1.0])
    return {
        "n": int(len(values)),
        "min": round(float(qs[0]), 4),
        "p05": round(float(qs[1]), 4),
        "q1": round(float(qs[2]), 4),
        "median": round(float(qs[3]), 4),
        "q3": round(float(qs[4]), 4),
        "p95": round(float(qs[5]), 4),
        "max": round(float(qs[6]), 4),
    }


def histogram(values: pd.Series, bins: int = 20, log: bool = False) -> dict:
    v = np.log(values) if log else values
    counts, edges = np.histogram(v, bins=bins)
    if log:
        edges = np.exp(edges)
    return {"counts": [int(c) for c in counts], "edges": [round(float(e), 4) for e in edges], "log": log}


def jsonable(obj):
    return json.loads(json.dumps(obj, default=lambda o: o.item() if hasattr(o, "item") else str(o)))
