"""Synthetic data helpers. All names are fictional ("Example Works N")."""

from __future__ import annotations

import itertools
from pathlib import Path

import pytest

from civictrace.store import connect

FIXTURES = Path(__file__).parent / "fixtures"
_seq = itertools.count(1000)

BUYERS = [
    (671, "BBMP", "Bruhat Bengaluru Mahanagara Palike"),
    (12603, "BCCC", "Bengaluru Central City Corporation"),
]


class Synth:
    def __init__(self, conn):
        self.conn = conn
        for dept_id, code, name in BUYERS:
            conn.execute(
                "INSERT INTO buyer(dept_id, code, name, family) VALUES (?,?,?,?)", (dept_id, code, name, "GBA")
            )
        self.doc = self._doc()

    def _doc(self) -> int:
        cur = self.conn.execute(
            "INSERT INTO source_document(url, method, status, sha256, path, fetched_at) VALUES (?,?,?,?,?,?)",
            ("https://example.test/doc", "GET", 200, "0" * 64, "/dev/null", "2026-01-01T00:00:00+00:00"),
        )
        return cur.lastrowid

    def call(
        self,
        *,
        dept_id: int = 671,
        work_category: str = "Roads",
        division: str = "Example Division East",
        tender_type: str = "OPEN",
        call_no: int = 1,
        published: str = "2024-07-01T10:00:00+05:30",
        close_original: str | None = "2024-07-11T16:00:00+05:30",
        close_final: str | None = None,
        status: str = "AWARDED",
        ecv: float | None = 1_000_000.0,
        supplier: int | None = None,
        bid: float | None = None,
        negotiated: float | None = None,
        award_date: str | None = "2024-09-01T12:00:00+05:30",
        bidders: int | None = 3,
        corrigenda: list[tuple[str, str]] | None = None,
        quarantine: str | None = None,
        bid_value_type: str = "ITEM_WISE",
        detail_state: str = "ok",
    ) -> int:
        nit = next(_seq)
        root = f"EX/2024-25/OW/WORK_INDENT{nit}"
        tn = root if call_no == 1 else f"{root}/CALL-{call_no}"
        c = self.conn
        c.execute(
            """INSERT INTO tender_call(nit_id, tender_number, process_key, call_no, dept_id, category, tender_type,
                 inviting_strategy, bid_value_type, title, work_category, location_name, ecv, published_at,
                 close_at_original, close_at_final, status, status_observed_at, award_date, detail_state,
                 detail_doc_id, corrigenda_doc_id, search_doc_id)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                nit, tn, root, call_no, dept_id, "WORKS", tender_type, "OPEN", bid_value_type,
                f"Example work {nit}", work_category, division, ecv, published, close_original,
                close_final or close_original, status, "2026-01-01T00:00:00+00:00",
                award_date if status == "AWARDED" else None, detail_state, self.doc, self.doc, self.doc,
            ),
        )
        if supplier is not None:
            bidv = bid if bid is not None else (ecv or 1_000_000.0) * 0.95
            c.execute(
                """INSERT INTO award(nit_id, supplier_id, supplier_name, bid_status, bid_value, negotiated_value,
                     contract_value, label, doc_id) VALUES (?,?,?,?,?,?,?,?,?)""",
                (
                    nit, supplier, f"Example Works {supplier}", "AWARDED", bidv, negotiated,
                    negotiated if negotiated is not None else bidv,
                    "awarded" if status == "AWARDED" else "selected_no_award", self.doc,
                ),
            )
            if bidders is not None:
                c.execute(
                    "INSERT INTO bid_summary(nit_id, n_price_stage_bidders, source, doc_id) VALUES (?,?,?,?)",
                    (nit, bidders, "comparative_statement_xlsx", self.doc),
                )
        for i, (orig, rev) in enumerate(corrigenda or [], 1):
            c.execute(
                "INSERT INTO amendment(nit_id, seq, reason, close_original, close_revised) VALUES (?,?,?,?,?)",
                (nit, i, "Administrative reason", orig, rev),
            )
        if quarantine:
            c.execute(
                "INSERT INTO quarantine(nit_id, reason, observed_at) VALUES (?,?,?)",
                (nit, quarantine, "2026-01-01T00:00:00+00:00"),
            )
        c.commit()
        return nit


@pytest.fixture
def conn(tmp_path):
    c = connect(tmp_path / "test.sqlite")
    yield c
    c.close()


@pytest.fixture
def synth(conn):
    return Synth(conn)
