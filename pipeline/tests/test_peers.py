"""Typical figures for similar tenders, used by "how does this tender compare?" on tender pages."""

from __future__ import annotations

import numpy as np
import pandas as pd

from civictrace.export import PEER_MIN, _peer_band, _peers


def _calls(n: int, category: str, ecv: float, ratio: float, bidders: int, days: int, tender_type: str = "OPEN") -> pd.DataFrame:
    return pd.DataFrame(
        {
            "detail_state": ["ok"] * n,
            "quarantined": [False] * n,
            "ecv": [ecv] * n,
            "bid_value": [ecv * ratio] * n,
            "has_selection": [True] * n,
            "n_price_stage_bidders": [bidders] * n,
            "published_at": ["2025-01-01T10:00:00+05:30"] * n,
            "close_at_original": [str(pd.Timestamp("2025-01-01T10:00:00+05:30") + pd.Timedelta(days=days))] * n,
            "work_category": [category] * n,
            "tender_type": [tender_type] * n,
        }
    )


def test_bands():
    assert _peer_band(5e5) == "lt10l" and _peer_band(1e6) == "10l-50l" and _peer_band(2e7) == "1-5cr" and _peer_band(9e8) == "5cr+"


def test_groups_from_specific_to_broad():
    calls = pd.concat(
        [
            _calls(PEER_MIN, "Roads", 2e6, 0.95, 3, 10),  # enough for its own group
            _calls(5, "Bridges", 2e6, 1.05, 1, 5),  # too few on its own, but counts in the broad groups
        ],
        ignore_index=True,
    )
    p = _peers(calls)["groups"]
    assert "Roads|10l-50l|OPEN" in p and "Bridges|10l-50l|OPEN" not in p
    broad = p["*|10l-50l|*"]
    assert broad["n"] == PEER_MIN + 5
    assert broad["one"] == round(5 / (PEER_MIN + 5), 4)
    roads = p["Roads|10l-50l|OPEN"]
    assert np.allclose(roads["price"], [-5.0] * 19) and np.allclose(roads["window"], [10.0] * 19)
    assert roads["low"] == 0.0


def test_pending_and_quarantined_left_out():
    calls = _calls(PEER_MIN, "Roads", 2e6, 1.0, 2, 10)
    calls.loc[0, "quarantined"] = True
    assert "Roads|10l-50l|OPEN" not in _peers(calls)["groups"]
