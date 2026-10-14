import json

from civictrace.sources import kppp
from conftest import FIXTURES

K = FIXTURES / "kppp"


def load(name):
    return json.loads((K / name).read_text())


def test_split_tender_number_first_call_has_no_suffix():
    assert kppp.split_tender_number("BBMP/2024-25/BD/WORK_INDENT5011") == ("BBMP/2024-25/BD/WORK_INDENT5011", 1)
    assert kppp.split_tender_number("BBMP/2024-25/BD/WORK_INDENT5011/CALL-4") == ("BBMP/2024-25/BD/WORK_INDENT5011", 4)


def test_parse_dt_formats_are_ist():
    assert kppp.parse_dt("16-02-2026 17:00:00") == "2026-02-16T17:00:00+05:30"
    assert kppp.parse_dt(1772793627936).startswith("2026-03-06")
    assert kppp.parse_dt(None) is None


def test_search_row_uses_nit_id_not_id():
    row = load("search_awarded.json")[0]
    parsed = kppp.parse_search_row(row)
    # the search 'id' and 'nitId' differ; detail calls must use nitId
    assert row["id"] != row["nitId"]
    assert parsed["nit_id"] == row["nitId"]
    assert parsed["process_key"].endswith("WORK_INDENT5011")
    assert parsed["call_no"] == 4


def test_full_view_drops_officer_personal_data():
    doc = load("full_264212.json")
    d = kppp.parse_full_view(doc)
    assert d["tender_number"] == "BBMP/2024-25/BD/WORK_INDENT5011/CALL-4"
    assert d["ecv"] == 2116273.38
    assert d["no_of_calls"] == 4 and d["retendered"] == 1
    assert d["published_at"] == "2026-02-09T16:37:47+05:30"
    assert d["close_at_final"] == "2026-02-16T17:00:00+05:30"
    flat = json.dumps(d)
    for banned in ("mobile", "contactPerson", "publishedByUser"):
        assert banned not in flat


def test_award_labels_awarded_vs_selected():
    a = kppp.parse_award(load("award_264212.json"), "AWARDED")
    assert a["label"] == "awarded" and a["bid_value"] == 2000000.0 and a["supplier_id"]
    assert a["contract_value"] == 2000000.0
    s = kppp.parse_award(load("award_87679_selected.json"), "EVALUATION_COMPLETED")
    assert s["label"] == "selected_no_award"
    assert s["commercial_bid_type"] == "LUMPSUM"


def test_award_not_found_returns_none():
    assert kppp.parse_award(load("award_notfound.json"), "RECALLED") is None


def test_corrigenda_extensions():
    items = kppp.parse_corrigenda(load("corr_220506.json"))
    assert [c["seq"] for c in items] == [1, 2]
    assert items[0]["close_original"] < items[0]["close_revised"]
    assert items[1]["close_original"] == items[0]["close_revised"]


def test_comparative_xlsx_counts_bidders_and_ranks():
    parsed = kppp.parse_comparative_xlsx((K / "bidders_253262.xlsx").read_bytes())
    assert parsed["n_bidders"] == 2
    assert parsed["tender_number"] == "BBMP/2025-26/OW/WORK_INDENT9084/CALL-2"
    assert [b["rank"] for b in parsed["bidders"]] == ["L1", "L2"]
    assert parsed["bidders"][0]["total_bid"] == 1693156.23


def test_comparative_xlsx_garbage_is_none():
    assert kppp.parse_comparative_xlsx(b"not a zip") is None
