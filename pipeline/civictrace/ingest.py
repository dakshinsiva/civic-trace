"""KPPP ingest: enumerate tender calls via search, then fetch per-call details.

Resumable: every step is idempotent and committed per tender, so the process
can be killed and restarted. Re-running re-enumerates every status (tenders
move between statuses) and refreshes non-terminal calls.
"""

from __future__ import annotations

import sqlite3
import sys
import threading
import uuid
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

import yaml

from . import CONFIG_DIR
from .http import PoliteClient
from .sources import kppp
from .store import connect, now_iso, record_document, upsert

# Award ÷ ECV outside this band is almost certainly a units/attribution problem
# (e.g. a percentage stored as an amount), not a real price. Quarantined, not flagged.
PLAUSIBLE_RATIO = (0.2, 5.0)


def log(msg: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def load_buyers(enabled_only: bool = True, codes: list[str] | None = None) -> list[dict]:
    data = yaml.safe_load((CONFIG_DIR / "buyers.yaml").read_text())["buyers"]
    out = []
    for b in data:
        if codes and b["code"] not in codes:
            continue
        if enabled_only and not codes and not b.get("enabled"):
            continue
        out.append(b)
    return out


def sync_buyers(conn: sqlite3.Connection) -> None:
    for b in load_buyers(enabled_only=False):
        upsert(
            conn,
            "buyer",
            {
                "dept_id": b["dept_id"],
                "code": b["code"],
                "name": b["name"],
                "family": b.get("family"),
                "parent_code": b.get("parent_code"),
                "effective_from": b.get("effective_from"),
                "effective_to": b.get("effective_to"),
                "note": b.get("note"),
            },
            ("dept_id",),
        )
    conn.commit()


def _upsert_search_row(conn: sqlite3.Connection, row: dict, tender_type: str, doc_id: int) -> bool:
    r = kppp.parse_search_row(row)
    ts = now_iso()
    existing = conn.execute("SELECT status FROM tender_call WHERE nit_id=?", (r["nit_id"],)).fetchone()
    if existing is None:
        conn.execute(
            """INSERT INTO tender_call (nit_id, kppp_id, tender_number, process_key, call_no, dept_id, category,
                 tender_type, notice_type, inviting_strategy, title, work_category, location_id, location_name,
                 ecv, ecv_public, published_at, close_at_final, itemwise, status, status_observed_at, search_doc_id)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                r["nit_id"], r["kppp_id"], r["tender_number"], r["process_key"], r["call_no"], r["dept_id"],
                r["category"], tender_type, r["notice_type"], r["inviting_strategy"], r["title"],
                r["work_category"], r["location_id"], r["location_name"], r["ecv"], r["ecv_public"],
                r["published_at"], r["close_at_final"], r["itemwise"], r["status"], ts, doc_id,
            ),
        )
        changed = True
    else:
        changed = existing["status"] != r["status"]
        conn.execute(
            """UPDATE tender_call SET status=?, status_observed_at=CASE WHEN status=? THEN status_observed_at ELSE ? END,
                 close_at_final=COALESCE(?, close_at_final), ecv=COALESCE(ecv, ?), search_doc_id=?
               WHERE nit_id=?""",
            (r["status"], r["status"], ts, r["close_at_final"], r["ecv"], doc_id, r["nit_id"]),
        )
    conn.execute(
        "INSERT OR IGNORE INTO status_history(nit_id, status, first_observed_at) VALUES (?,?,?)",
        (r["nit_id"], r["status"], ts),
    )
    return changed


def enumerate_calls(
    client: PoliteClient,
    conn: sqlite3.Connection,
    buyers: list[dict],
    statuses: list[str] = kppp.STATUSES,
    tender_types: list[str] = kppp.TENDER_TYPES,
    page_size: int = 500,
    category: str = "WORKS",
) -> dict:
    stats = {"rows": 0, "new_or_changed": 0}
    for b in buyers:
        for tt in tender_types:
            for st in statuses:
                page = 0
                while True:
                    body = {"category": category, "status": st, "tenderType": tt, "deptId": b["dept_id"]}
                    f = client.fetch(
                        kppp.search_url(category),
                        archive_as=f"kppp/search/{b['code']}/{category}/{tt}/{st}/p{page}",
                        method="POST",
                        json_body=body,
                        params={"page": page, "size": page_size, "order-by-tender-publish": "true"},
                    )
                    if f.status != 200:
                        log(f"search {b['code']} {tt} {st} p{page}: HTTP {f.status}")
                        break
                    rows = f.json() or []
                    doc_id = record_document(conn, f)
                    for row in rows:
                        stats["rows"] += 1
                        stats["new_or_changed"] += _upsert_search_row(conn, row, tt, doc_id)
                    conn.commit()
                    total = int(f.headers.get("x-total-count", "0") or 0)
                    if rows:
                        log(f"search {b['code']:6} {tt:10} {st:22} page {page}: {len(rows)} rows (total {total})")
                    if not rows or (page + 1) * page_size >= total:
                        break
                    page += 1
    return stats


def _quarantine(conn, nit_id: int, reason: str, detail: str) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO quarantine(nit_id, reason, detail, observed_at) VALUES (?,?,?,?)",
        (nit_id, reason, detail, now_iso()),
    )


def detail_queue(
    conn: sqlite3.Connection, refresh_days: int = 7, priority_fy: str | None = None, dept_ids: list[int] | None = None
) -> list[sqlite3.Row]:
    cutoff = (datetime.now(timezone.utc) - timedelta(days=refresh_days)).isoformat(timespec="seconds")
    terminal = ",".join(f"'{s}'" for s in kppp.TERMINAL_STATUSES)
    fy_start = fy_end = None
    if priority_fy:
        y = int(priority_fy[:4])
        fy_start, fy_end = f"{y}-04-01", f"{y + 1}-04-01"
    dept_clause = ""
    if dept_ids:
        dept_clause = f" AND dept_id IN ({','.join(str(int(d)) for d in dept_ids)})"
    sql = f"""
      SELECT * FROM tender_call
      WHERE (detail_state = 'pending'
         OR detail_status IS NOT status
         OR (status NOT IN ({terminal}) AND detail_fetched_at < ?))
         {dept_clause}
      ORDER BY
        CASE WHEN ? IS NOT NULL AND published_at >= ? AND published_at < ? THEN 0 ELSE 1 END,
        published_at DESC
    """
    rows = conn.execute(sql, (cutoff, fy_start, fy_start, fy_end)).fetchall()
    return _interleave_by_month(rows)


def _interleave_by_month(rows: list) -> list:
    """Round-robin across publication months (newest month first in each round), and a
    deterministic pseudo-random order within each month (hash of nitId). Any prefix of
    the queue is then close to a month-stratified random sample, so prevalence
    estimates are unbiased while the backfill is still running."""
    import hashlib

    buckets: dict[str, list] = defaultdict(list)
    for r in rows:
        buckets[(r["published_at"] or "")[:7]].append(r)
    for m in buckets:
        buckets[m].sort(key=lambda r: hashlib.sha1(str(r["nit_id"]).encode()).hexdigest())
    months = sorted(buckets, reverse=True)
    out, i = [], 0
    while len(out) < len(rows):
        for m in months:
            if i < len(buckets[m]):
                out.append(buckets[m][i])
        i += 1
    return out


def fetch_details(client: PoliteClient, conn: sqlite3.Connection, call: sqlite3.Row) -> str:
    """Fetch full view, corrigenda and (when a bid was selected) award + bidders for one call."""
    nit = int(call["nit_id"])
    tn = call["tender_number"]
    state = "ok"
    updates: dict = {}

    f = client.fetch(kppp.full_view_url(nit), archive_as=f"kppp/full/{nit}")
    doc = None
    if f.status == 200:
        try:
            doc = f.json()
        except ValueError:
            doc = None
    if isinstance(doc, dict) and doc.get("tenderSchedule"):
        updates["detail_doc_id"] = record_document(conn, f)
        d = kppp.parse_full_view(doc)
        if d["tender_number"] and d["tender_number"] != tn:
            _quarantine(conn, nit, "detail_tender_number_mismatch", f"search={tn} detail={d['tender_number']}")
            state = "quarantined"
        else:
            for k in (
                "title", "ecv", "ecv_public", "sub_estimate_total", "work_category", "location_id", "location_name",
                "notice_type", "evaluation_type", "inviting_strategy", "bid_value_type", "tax_type", "published_by_post", "published_at",
                "close_at_final", "query_close_at", "tech_open_at", "no_of_calls", "retendered", "recalled",
                "pre_bid_meeting", "award_date", "n_eligibility_criteria", "n_technical_criteria",
            ):
                if d.get(k) is not None:
                    updates[k] = d[k]
    else:
        state = "unavailable"

    # Corrigenda
    if state != "quarantined":
        c = client.fetch(kppp.corrigenda_url(nit), archive_as=f"kppp/corr/{nit}")
        items = None
        if c.status == 200:
            try:
                items = c.json()
            except ValueError:
                items = None
        if isinstance(items, list):
            cdoc = record_document(conn, c)
            updates["corrigenda_doc_id"] = cdoc
            amendments = kppp.parse_corrigenda(items)
            conn.execute("DELETE FROM amendment WHERE nit_id=?", (nit,))
            for a in amendments:
                upsert(conn, "amendment", {"nit_id": nit, **a, "doc_id": cdoc}, ("nit_id", "seq"))
            first_close = next((a["close_original"] for a in amendments if a["close_original"]), None)
            updates["close_at_original"] = first_close or updates.get("close_at_final") or call["close_at_final"]
        elif state == "ok":
            state = "unavailable"

    # Award / selected bid + price-stage bidders
    if state != "quarantined" and call["status"] in kppp.STATUSES_WITH_SELECTION:
        a = client.fetch(kppp.award_url(nit), archive_as=f"kppp/award/{nit}", retry_statuses=(500, 502, 503, 504))
        adoc = None
        if a.status == 200:
            try:
                adoc = a.json()
            except ValueError:
                adoc = None
        award = kppp.parse_award(adoc, call["status"])
        if award:
            if award["tender_number"] and award["tender_number"] != tn:
                _quarantine(conn, nit, "award_tender_number_mismatch", f"search={tn} award={award['tender_number']}")
                state = "quarantined"
            else:
                award_doc = record_document(conn, a)
                award.pop("tender_number")
                upsert(conn, "award", {"nit_id": nit, **award, "doc_id": award_doc}, ("nit_id",))
                ts = now_iso()
                conn.execute(
                    """INSERT INTO supplier(supplier_id, name, first_seen, last_seen) VALUES (?,?,?,?)
                       ON CONFLICT(supplier_id) DO UPDATE SET name=excluded.name, last_seen=excluded.last_seen""",
                    (award["supplier_id"], award["supplier_name"], ts, ts),
                )
                conn.execute(
                    "INSERT OR IGNORE INTO supplier_name(supplier_id, name) VALUES (?,?)",
                    (award["supplier_id"], award["supplier_name"]),
                )
                ecv = updates.get("ecv") or call["ecv"]
                if ecv and award["bid_value"]:
                    ratio = award["bid_value"] / ecv
                    if not (PLAUSIBLE_RATIO[0] <= ratio <= PLAUSIBLE_RATIO[1]):
                        _quarantine(conn, nit, "award_ratio_implausible", f"bid/ecv={ratio:.3f}")

        if state != "quarantined":
            x = client.fetch(kppp.comparative_url(nit), archive_as=f"kppp/bidders/{nit}", allow_empty=True)
            parsed = kppp.parse_comparative_xlsx(x.body) if x.status == 200 and x.body[:2] == b"PK" else None
            if parsed and parsed["n_bidders"] > 0:
                if parsed["tender_number"] and parsed["tender_number"] != tn:
                    _quarantine(conn, nit, "bidders_tender_number_mismatch", f"search={tn} xlsx={parsed['tender_number']}")
                else:
                    xdoc = record_document(conn, x)
                    upsert(
                        conn,
                        "bid_summary",
                        {"nit_id": nit, "n_price_stage_bidders": parsed["n_bidders"], "source": "comparative_statement_xlsx", "doc_id": xdoc},
                        ("nit_id",),
                    )
                    conn.execute("DELETE FROM bidder WHERE nit_id=?", (nit,))
                    for b in parsed["bidders"]:
                        upsert(conn, "bidder", {"nit_id": nit, **b}, ("nit_id", "position"))

    updates.update({"detail_state": state, "detail_fetched_at": now_iso(), "detail_status": call["status"]})
    sets = ",".join(f"{k}=?" for k in updates)
    conn.execute(f"UPDATE tender_call SET {sets} WHERE nit_id=?", [*updates.values(), nit])
    conn.commit()
    return state


def run(
    conn: sqlite3.Connection,
    *,
    buyer_codes: list[str] | None = None,
    do_enumerate: bool = True,
    do_details: bool = True,
    limit: int | None = None,
    priority_fy: str | None = None,
    min_interval: float = 1.0,
    workers: int = 1,
    db_path: Path | None = None,
) -> None:
    run_id = uuid.uuid4().hex[:12]
    conn.execute("INSERT INTO ingest_run(run_id, started_at) VALUES (?,?)", (run_id, now_iso()))
    conn.commit()
    sync_buyers(conn)
    buyers = load_buyers(codes=buyer_codes)
    log(f"run {run_id}: buyers={[b['code'] for b in buyers]}")
    with PoliteClient(min_interval=min_interval) as client:
        try:
            if do_enumerate:
                stats = enumerate_calls(client, conn, buyers)
                log(f"enumerated {stats['rows']} rows ({stats['new_or_changed']} new/changed)")
            if do_details:
                queue = detail_queue(conn, priority_fy=priority_fy, dept_ids=[b["dept_id"] for b in buyers])
                if limit:
                    queue = queue[:limit]
                log(f"detail queue: {len(queue)} calls, {workers} worker(s), ≤1 request/{min_interval}s overall")
                counts: dict[str, int] = {}
                done = [0]
                lock = threading.Lock()
                local = threading.local()

                def work(call) -> None:
                    wconn = conn if workers == 1 else getattr(local, "conn", None)
                    if wconn is None:
                        wconn = local.conn = connect(db_path) if db_path else connect()
                    try:
                        state = fetch_details(client, wconn, call)
                    except Exception as exc:  # keep going; record and move on
                        wconn.rollback()
                        log(f"error nit={call['nit_id']}: {exc!r}")
                        state = "error"
                    with lock:
                        counts[state] = counts.get(state, 0) + 1
                        done[0] += 1
                        if done[0] % 25 == 0 or done[0] == len(queue):
                            log(f"details {done[0]}/{len(queue)} {counts} requests={client.requests_made}")

                if workers == 1:
                    for call in queue:
                        work(call)
                else:
                    with ThreadPoolExecutor(max_workers=workers) as pool:
                        list(pool.map(work, queue))
        finally:
            conn.execute(
                "UPDATE ingest_run SET finished_at=?, requests=? WHERE run_id=?",
                (now_iso(), client.requests_made, run_id),
            )
            conn.commit()
    sys.stdout.flush()
