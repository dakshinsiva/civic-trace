"""Rule registry and runner."""

from __future__ import annotations

import sqlite3
import uuid

from ..store import now_iso
from .base import RuleContext, RuleResult, load_calls, load_config
from .call_rules import amendments, award_ratio, short_window, single_bidder
from .market_rules import concentration, supplier_share

REGISTRY = {
    "supplier_share": supplier_share,
    "single_bidder": single_bidder,
    "short_window": short_window,
    "amendments": amendments,
    "award_ratio": award_ratio,
    "concentration": concentration,
}


def _doc_lookup(conn: sqlite3.Connection) -> dict[int, dict]:
    return {
        int(r["id"]): {"url": r["url"], "sha256": r["sha256"], "fetched_at": r["fetched_at"]}
        for r in conn.execute("SELECT id, url, sha256, fetched_at FROM source_document")
    }


def evaluate(calls, cfg: dict, doc_lookup: dict[int, dict]) -> dict[str, RuleResult]:
    """Pure evaluation (no DB writes) — used by tests and by run_all."""
    out = {}
    for rule_id, fn in REGISTRY.items():
        rcfg = cfg["rules"][rule_id]
        if not rcfg.get("enabled", True):
            continue
        ctx = RuleContext(rule_id=rule_id, cfg=rcfg, defaults=cfg["defaults"], full_cfg=cfg, calls=calls, doc_lookup=doc_lookup)
        out[rule_id] = fn(ctx)
    return out


def run_all(conn: sqlite3.Connection) -> dict[str, str]:
    cfg = load_config()
    calls = load_calls(conn)
    if calls.empty:
        return {"(none)": "no tender calls in database"}
    results = evaluate(calls, cfg, _doc_lookup(conn))
    run_id = uuid.uuid4().hex[:12]
    conn.execute("DELETE FROM flag")
    conn.execute("DELETE FROM rule_notice")
    conn.execute("DELETE FROM rule_summary")
    summary = {}
    for rule_id, res in results.items():
        for f in res.flags:
            ctxd = f.context
            fy = (ctxd.get("slice") or {}).get("fiscal_year")
            if not fy and f.period.label.startswith("FY "):
                fy = f.period.label[3:]
            conn.execute(
                """INSERT OR REPLACE INTO flag(flag_id, rule_id, rule_version, subject_type, subject_id, nit_id, dept_id,
                     supplier_id, fiscal_year, work_category, payload, run_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    f.flag_id, f.rule_id, f.rule_version, f.subject_type, f.subject_id,
                    ctxd.get("nit_id"), ctxd.get("dept_id"),
                    ctxd.get("supplier_id") or f.observed.get("supplier_id"),
                    fy,
                    ctxd.get("work_category") or (ctxd.get("slice") or {}).get("work_category"),
                    f.model_dump_json(), run_id,
                ),
            )
        for n in res.notices:
            conn.execute(
                "INSERT OR REPLACE INTO rule_notice(rule_id, slice_key, kind, detail, run_id) VALUES (?,?,?,?,?)",
                (n["rule_id"], n["slice_key"], n["kind"], n["detail"], run_id),
            )
        conn.execute(
            "INSERT INTO rule_summary(rule_id, flags, slices, evaluated, notices, run_id, ran_at) VALUES (?,?,?,?,?,?,?)",
            (rule_id, len(res.flags), res.slices, res.evaluated, len(res.notices), run_id, now_iso()),
        )
        summary[rule_id] = f"flags={len(res.flags)} slices={res.slices} evaluated={res.evaluated} notices={len(res.notices)}"
    conn.commit()
    return summary


__all__ = ["evaluate", "run_all", "REGISTRY", "load_calls", "load_config"]
