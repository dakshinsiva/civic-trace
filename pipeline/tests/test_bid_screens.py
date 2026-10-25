"""Bid-rigging screens: repeat pairings and the always-same-loser pattern, on fictional firms."""

from __future__ import annotations

import pandas as pd

from civictrace.export import _bid_screens


def _setup():
    calls, bidders = [], {}
    nit = 0

    def tender(bids, tender_type="OPEN", state="ok"):
        nonlocal nit
        nit += 1
        calls.append({"nit_id": nit, "detail_state": state, "quarantined": False, "tender_type": tender_type})
        bidders[nit] = [{"raw_name": name, "total_bid": amount, "rank": f"L{i + 1}"} for i, (name, amount) in enumerate(bids)]

    for _ in range(6):  # Beta Works loses to Alpha Infra every time, always 0.5% higher
        tender([("Alpha Infra", 100.0), ("Beta  works", 100.5)])
    for i in range(5):  # Gamma and Delta take turns
        tender([("Gamma Roads", 100.0), ("Delta Civil", 104.0)] if i % 2 else [("Delta Civil", 100.0), ("Gamma Roads", 104.0)])
    tender([("Epsilon", 100.0), ("Zeta", 110.0)])  # met once
    tender([("Eta", 100.0), ("Theta", 103.0), ("Iota", 108.0)])  # three bids
    tender([("Alpha Infra", 100.0), ("Beta Works", 101.0)], tender_type="LIMITED")  # not open: ignored
    tender([("Alpha Infra", 100.0), ("Beta Works", 101.0)], state="pending")  # not read: ignored
    tender([("Kappa", 100.0), ("KAPPA", 100.0)])  # same firm twice: no duel
    tender([("Lambda", 0.0), ("Mu", 100.0)])  # a zero bid is not a bid
    return pd.DataFrame(calls), bidders


def test_repeat_pairs_and_same_loser():
    calls, bidders = _setup()
    s = _bid_screens(bidders, calls)
    assert s["two_bidder_tenders"] == 12  # 6 + 5 + 1; Kappa's duplicate is not a duel
    assert s["regular_pairs"] == 2
    assert s["met_min"]["k"] == 11
    assert s["same_loser_pairs"] == 1  # Alpha/Beta (names normalised); Gamma/Delta alternate
    assert s["same_loser_tenders"]["k"] == 6
    assert s["same_loser_expected"] == 0.1  # 2 * 0.5**6 + 2 * 0.5**5
    assert s["met_10_plus"]["k"] == 0


def test_runner_up_gap():
    calls, bidders = _setup()
    g = _bid_screens(bidders, calls)["runner_up_gap"]
    assert g["two"]["n"] == 13  # every open two-bid tender, including Kappa's
    assert g["two"]["within_1pct"]["k"] == 7  # six 0.5% gaps and Kappa's 0%
    assert g["three_plus"]["n"] == 1 and g["three_plus"]["median_pct"] == 3.0


def test_screens_run_within_each_department():
    from civictrace.export import _bid_screens_by_buyer

    calls, bidders = _setup()
    calls["buyer_code"] = "AAA"
    calls.loc[calls.index[:3], "buyer_code"] = "BBB"  # three of Alpha/Beta's six meetings happen elsewhere
    s = _bid_screens_by_buyer(bidders, calls)
    assert set(s) == {"AAA", "BBB"}
    # Split across departments, Alpha/Beta meet only 3 times in each: not a repeat pair in either.
    assert s["BBB"]["regular_pairs"] == 0 and s["BBB"]["two_bidder_tenders"] == 3
    assert s["AAA"]["regular_pairs"] == 1  # Gamma/Delta still meet 5 times
    assert s["AAA"]["same_loser_pairs"] == 0
