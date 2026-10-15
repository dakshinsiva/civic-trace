"""Failed detail fetches are counted, explained, and retried up to a limit."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from civictrace.http import Fetched
from civictrace.ingest import fetch_details, retry_queue
from conftest import FIXTURES

FULL = (FIXTURES / "kppp" / "full_264212.json").read_bytes()
TN = "BBMP/2024-25/BD/WORK_INDENT5011/CALL-4"


class FakeClient:
    """Returns canned responses by URL fragment; records what was asked."""

    def __init__(self, responses: dict[str, tuple[int, bytes]]):
        self.responses = responses
        self.calls: list[str] = []

    def fetch(self, url, archive_as, **kw):
        self.calls.append(url)
        status, body = next((v for k, v in self.responses.items() if k in url), (404, b'{"errorKey":"recordNotFound"}'))
        return Fetched(
            url=url, method="GET", request_body=None, status=status, body=body,
            sha256=hashlib.sha256(body).hexdigest(), path=Path("/dev/null"), fetched_at="2026-10-15T00:00:00+00:00", headers={},
        )


def _call(conn, nit, state, attempts, status="AWARDED", tn=None):
    conn.execute("INSERT OR IGNORE INTO buyer(dept_id, code, name) VALUES (671, 'BBMP', 'BBMP')")
    conn.execute(
        """INSERT INTO tender_call(nit_id, tender_number, process_key, call_no, dept_id, status, status_observed_at,
             detail_state, detail_attempts, published_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (nit, tn or f"EX/{nit}", f"EX/{nit}", 1, 671, status, "2026-01-01", state, attempts, "2025-01-01T00:00:00+05:30"),
    )
    conn.commit()


def test_retry_queue_picks_failures_under_the_limit(conn):
    _call(conn, 1, "unavailable", 1)
    _call(conn, 2, "unavailable", 3)  # tried enough
    _call(conn, 3, "ok", 1)
    _call(conn, 4, "pending", None)  # an exception left it unsaved
    assert sorted(r["nit_id"] for r in retry_queue(conn, max_attempts=3)) == [1, 4]


def test_failed_fetch_is_counted_and_explained(conn):
    _call(conn, 264212, "unavailable", 1, tn=TN)
    call = conn.execute("SELECT * FROM tender_call WHERE nit_id = 264212").fetchone()
    client = FakeClient({"works-tender-full-view": (500, b'{"status":500}'), "corrigendums": (200, b"[]")})
    assert fetch_details(client, conn, call) == "unavailable"
    row = conn.execute("SELECT detail_state, detail_attempts, detail_error FROM tender_call WHERE nit_id = 264212").fetchone()
    assert row["detail_attempts"] == 2
    assert "full record: HTTP 500" in row["detail_error"]


def test_successful_retry_clears_the_error(conn):
    _call(conn, 264212, "unavailable", 2, tn=TN)
    conn.execute("UPDATE tender_call SET detail_error = 'full record: HTTP 500' WHERE nit_id = 264212")
    call = conn.execute("SELECT * FROM tender_call WHERE nit_id = 264212").fetchone()
    client = FakeClient({"works-tender-full-view": (200, FULL), "corrigendums": (200, b"[]")})
    assert fetch_details(client, conn, call) == "ok"
    row = conn.execute("SELECT detail_state, detail_attempts, detail_error, ecv FROM tender_call WHERE nit_id = 264212").fetchone()
    assert row["detail_state"] == "ok" and row["detail_attempts"] == 3 and row["detail_error"] is None
    assert row["ecv"] == float(json.loads(FULL)["tenderSchedule"]["ecv"])
