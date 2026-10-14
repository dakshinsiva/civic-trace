"""Golden tests for rules 1–6 on synthetic data (fires / doesn't fire / skips)."""

from __future__ import annotations

import copy

import pytest

from civictrace.rules import evaluate, load_calls, load_config


def run(conn, rule_id, mutate=None):
    cfg = copy.deepcopy(load_config())
    for rid in cfg["rules"]:
        cfg["rules"][rid]["enabled"] = rid == rule_id
    if mutate:
        mutate(cfg["rules"][rule_id])
    docs = {r["id"]: {"url": r["url"], "sha256": r["sha256"], "fetched_at": r["fetched_at"]} for r in conn.execute("SELECT * FROM source_document")}
    return evaluate(load_calls(conn), cfg, docs)[rule_id]


def kinds(res):
    return {n["kind"] for n in res.notices}


# ---------------------------------------------------------------- Rule 2 single bidder

def test_single_bidder_fires_only_on_one_bidder(conn, synth):
    one = synth.call(supplier=1, bidders=1)
    for i in range(9):
        synth.call(supplier=10 + i, bidders=3)
    res = run(conn, "single_bidder")
    assert [f.subject_id for f in res.flags] == [str(one)]
    f = res.flags[0]
    assert f.baseline.values["buyer_single_bidder_rate"] == pytest.approx(0.1)
    assert f.baseline.values["selections_with_known_bidder_count"] == 10


def test_single_bidder_unknown_count_is_not_one(conn, synth):
    # 5 known (none single) + 5 unknown -> completeness 50% -> coverage notice, no flags
    for i in range(5):
        synth.call(supplier=i, bidders=2)
    for i in range(5):
        synth.call(supplier=20 + i, bidders=None)
    res = run(conn, "single_bidder")
    assert res.flags == []
    assert "coverage_insufficient" in kinds(res)


def test_single_bidder_ignores_reserved_tenders(conn, synth):
    synth.call(supplier=1, bidders=1, tender_type="RESERVED")
    assert run(conn, "single_bidder").flags == []


# ---------------------------------------------------------------- Rule 3 short window

def _windows(synth, days_list, **kw):
    out = []
    for i, d in enumerate(days_list):
        out.append(
            synth.call(
                published="2024-07-01T10:00:00+05:30",
                close_original=f"2024-07-{1 + d:02d}T10:00:00+05:30",
                supplier=None,
                status="PUBLISHED",
                **kw,
            )
        )
    return out


def test_short_window_flags_low_outlier(conn, synth):
    normal = [10, 11, 12, 13, 14, 15] * 6  # 36 calls, IQR > 0
    _windows(synth, normal)
    [short] = _windows(synth, [1])
    res = run(conn, "short_window")
    assert [f.subject_id for f in res.flags] == [str(short)]
    assert res.flags[0].observed["window_days"] == pytest.approx(1.0)
    assert res.flags[0].baseline.values["median_days"] >= 10


def test_queued_calls_do_not_count_as_missing_data(conn, synth):
    _windows(synth, [10, 11, 12, 13, 14, 15] * 6)
    [short] = _windows(synth, [1])
    # 100 calls still queued for detail fetch: no original deadline yet
    for _ in range(100):
        synth.call(close_original=None, supplier=None, status="PUBLISHED", detail_state="pending")
    res = run(conn, "short_window")
    assert [f.subject_id for f in res.flags] == [str(short)]


def test_short_window_materiality_floor(conn, synth):
    _windows(synth, [9, 10] * 20)  # tight cluster: fence ~8.5
    [eight] = _windows(synth, [8])  # 1.5 days below median: not material
    [four] = _windows(synth, [4])
    flagged = {f.subject_id for f in run(conn, "short_window").flags}
    assert str(eight) not in flagged and str(four) in flagged


def test_short_window_zero_spread_skipped(conn, synth):
    _windows(synth, [10] * 40 + [2])
    res = run(conn, "short_window")
    assert res.flags == []
    assert "zero_spread" in kinds(res)


def test_short_window_small_group_skipped(conn, synth):
    _windows(synth, [10, 11, 12, 1])
    res = run(conn, "short_window")
    assert res.flags == [] and "too_small" in kinds(res)


def test_short_window_retender_compared_separately(conn, synth):
    _windows(synth, [10, 11, 12, 13, 14, 15] * 6)
    # retender calls with short windows are in their own (too small) group
    _windows(synth, [3, 3, 4], call_no=2)
    res = run(conn, "short_window")
    assert res.flags == []


# ---------------------------------------------------------------- Rule 4 amendments

def test_amendments_thresholds_and_no_bid_exclusion(conn, synth):
    ext = [("2024-07-10T16:00:00+05:30", "2024-07-15T16:00:00+05:30"), ("2024-07-15T16:00:00+05:30", "2024-07-20T16:00:00+05:30")]
    two_ext = synth.call(supplier=1, corrigenda=ext)
    three = synth.call(supplier=2, corrigenda=[("2024-07-10T16:00:00+05:30", None)] * 3)
    synth.call(supplier=3, corrigenda=ext[:1])  # one extension: no flag
    synth.call(supplier=None, status="NO_BIDS_RECIEVED", corrigenda=ext)  # excluded
    res = run(conn, "amendments")
    assert sorted(f.subject_id for f in res.flags) == sorted([str(two_ext), str(three)])


# ---------------------------------------------------------------- Rule 5 award ratio

def test_award_ratio_two_sided_log_fences(conn, synth):
    import random

    rnd = random.Random(1)
    for i in range(40):
        synth.call(supplier=i, ecv=1_000_000, bid=1_000_000 * rnd.uniform(0.9, 1.0))
    high = synth.call(supplier=100, ecv=1_000_000, bid=1_600_000)
    low = synth.call(supplier=101, ecv=1_000_000, bid=500_000)
    res = run(conn, "award_ratio")
    by = {f.subject_id: f.direction for f in res.flags}
    assert by[str(high)] == "high" and by[str(low)] == "low"
    assert len(by) == 2
    # negotiated value is NOT used: a negotiated-down award still flags on its bid
    assert res.flags[0].observed["selected_bid_value"] in (1_600_000, 500_000)


def test_award_ratio_materiality_floor(conn, synth):
    # most bids exactly at the estimate -> tight fences; a 10% discount must NOT flag
    for i in range(30):
        synth.call(supplier=i, ecv=1_000_000, bid=1_000_000 * (1 - 0.001 * (i % 5)))
    modest = synth.call(supplier=50, ecv=1_000_000, bid=900_000)
    deep = synth.call(supplier=51, ecv=1_000_000, bid=700_000)
    flagged = {f.subject_id for f in run(conn, "award_ratio").flags}
    assert str(modest) not in flagged and str(deep) in flagged


def test_award_ratio_quarantined_excluded(conn, synth):
    for i in range(40):
        synth.call(supplier=i, ecv=1_000_000, bid=950_000 + i * 1000)
    synth.call(supplier=99, ecv=1_000_000, bid=9_000_000, quarantine="award_ratio_implausible")
    assert run(conn, "award_ratio").flags == []


# ---------------------------------------------------------------- Rules 1 & 6 market

def _market(synth, wins_by_supplier: dict[int, int], division="Example Division East"):
    for sup, n in wins_by_supplier.items():
        for _ in range(n):
            synth.call(supplier=sup, division=division)


def test_concentration_flags_concentrated_market(conn, synth):
    _market(synth, {1: 30, 2: 15, 3: 5, **{10 + i: 1 for i in range(5)}})  # 55 selections
    res = run(conn, "concentration")
    assert res.flags, "expected a concentration flag"
    f = res.flags[0]
    assert f.observed["hhi"] > 1800 and f.observed["selections"] == 55
    assert f.observed["effective_number_of_suppliers"] == pytest.approx(10000 / f.observed["hhi"], rel=1e-3)


def test_concentration_competitive_market_not_flagged(conn, synth):
    _market(synth, {i: 3 for i in range(20)})  # 60 selections, 20 equal suppliers: HHI 500
    assert run(conn, "concentration").flags == []


def test_concentration_small_market_skipped(conn, synth):
    _market(synth, {1: 20, 2: 5})  # 25 < 50
    res = run(conn, "concentration")
    assert res.flags == [] and "too_small" in kinds(res)


def test_supplier_share_significant_winner(conn, synth):
    _market(synth, {1: 20, **{10 + i: 2 for i in range(10)}})  # 40 selections, 11 suppliers
    res = run(conn, "supplier_share")
    flagged = {f.observed["supplier_id"] for f in res.flags}
    assert flagged == {1}
    f = res.flags[0]
    assert f.baseline.values["expected_share_even_split"] == pytest.approx(1 / 11, rel=1e-3)
    assert f.observed["q_value_bh"] < 0.05


def test_supplier_share_even_market_not_flagged(conn, synth):
    _market(synth, {i: 5 for i in range(8)})  # 40 selections, all equal
    assert run(conn, "supplier_share").flags == []


def test_supplier_share_needs_min_wins(conn, synth):
    # 31 selections; top supplier only 4 wins (below min 5) -> not tested
    _market(synth, {1: 4, **{10 + i: 1 for i in range(27)}})
    assert run(conn, "supplier_share").flags == []
