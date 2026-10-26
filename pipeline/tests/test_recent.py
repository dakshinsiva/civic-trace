"""The newest tenders for the RSS feeds: latest citywide plus the latest in each area."""

from __future__ import annotations

import pandas as pd

from civictrace import export
from civictrace.export import _recent


def _calls(n: int, ac: int | None, start_day: int) -> pd.DataFrame:
    return pd.DataFrame(
        {
            "nit_id": range(start_day * 1000, start_day * 1000 + n),
            "tender_number": [f"T/{start_day}/{i}" for i in range(n)],
            "title": ["Road repair"] * n,
            "buyer_code": ["BCCC"] * n,
            "division": ["Div"] * n,
            "work_category": ["Roads"] * n,
            "tender_type": ["OPEN"] * n,
            "ecv": [1e6] * n,
            "status": ["PUBLISHED"] * n,
            "published_at": [f"2026-10-{start_day + i % 3:02d}T10:00:00+05:30" for i in range(n)],
            "close_at_final": [None] * n,
            "ac_no": [ac] * n,
            "ward_key": [None] * n,
        }
    )


def test_latest_citywide_and_per_area(monkeypatch):
    monkeypatch.setattr(export, "RECENT_CITY", 5)
    monkeypatch.setattr(export, "RECENT_PER_AREA", 3)
    calls = pd.concat([_calls(20, 160, 20), _calls(4, 174, 1)], ignore_index=True)  # area 174 is old and quiet
    r = _recent(calls)
    ids = [t["nit_id"] for t in r["tenders"]]
    dates = [t["published_at"] for t in r["tenders"]]
    assert dates == sorted(dates, reverse=True)
    assert sum(t["ac"] == 174 for t in r["tenders"]) == 3  # the quiet area still gets its latest three
    assert len(set(ids)) == len(ids) == 5 + 3  # top five overall (all area 160) plus area 174's three
