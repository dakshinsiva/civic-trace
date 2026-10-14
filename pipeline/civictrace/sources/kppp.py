"""Karnataka Public Procurement Portal (kppp.karnataka.gov.in).

The portal's web UI is backed by an undocumented public JSON service (no login,
no CAPTCHA). Verified behaviour (see docs/SOURCES.md):

- Search needs category + status + tenderType; deptId is optional on top.
- Detail endpoints take `nitId`. The search row's `id` is a *different* key and
  silently returns another tender if used — never use it for detail calls.
- Each retender call is its own nitId; numbers look like ROOT, ROOT/CALL-2, ...
- `works-tender-full-view` returns 500 persistently for some tenders.
- The comparative-statement XLSX lists price-stage bidder names (no supplier ids).

Parsers here are pure functions so they can be tested on recorded fixtures.
Officials' personal contact data (mobile/office phone numbers) is never extracted.
"""

from __future__ import annotations

import io
import re
from datetime import datetime, timedelta, timezone

BASE = "https://kppp.karnataka.gov.in/supplier-registration-service/v1/api/portal-service"
PORTAL = "https://kppp.karnataka.gov.in"

IST = timezone(timedelta(hours=5, minutes=30))

# Status ids exactly as the API spells them ("RECIEVED" is the API's spelling).
STATUSES = [
    "PUBLISHED",
    "CLOSED",
    "UNDER_EVALUATION",
    "EVALUATION_SUSPENDED",
    "EVALUATION_COMPLETED",
    "AWARDED",
    "NO_BIDS_RECIEVED",
    "RECALLED",
    "RETENDERED",
    "FINALIZED",
]
TERMINAL_STATUSES = {"AWARDED", "NO_BIDS_RECIEVED", "RECALLED", "RETENDERED", "FINALIZED"}
STATUSES_WITH_SELECTION = {"AWARDED", "EVALUATION_COMPLETED", "FINALIZED"}
TENDER_TYPES = ["OPEN", "RESERVED", "RESTRICTED"]

CALL_RE = re.compile(r"/CALL-(\d+)$")


# ---------------------------------------------------------------- URLs

def search_url(category: str = "WORKS") -> str:
    return f"{BASE}/{category.lower()}/search-eproc-tenders"


def full_view_url(nit_id: int) -> str:
    return f"{BASE}/{nit_id}/works-tender-full-view"


def corrigenda_url(nit_id: int) -> str:
    return f"{BASE}/{nit_id}/works-tender-corrigendums"


def award_url(nit_id: int, category: str = "WORKS") -> str:
    return f"{BASE}/bids/{nit_id}/tender-category/{category}/get-selected-bid-for-lumpsum"


def comparative_url(nit_id: int, category: str = "WORKS") -> str:
    return (
        f"{BASE}/tender-eval/{nit_id}/commercial-evaluation/tender-category/"
        f"{category}/commercial-comparison/download-detailed"
    )


# ---------------------------------------------------------------- helpers

def parse_dt(value) -> str | None:
    """KPPP dates are 'dd-mm-YYYY HH:MM:SS' (IST) or epoch milliseconds."""
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value / 1000, tz=IST).isoformat(timespec="seconds")
    for fmt in ("%d-%m-%Y %H:%M:%S", "%d-%m-%Y %H:%M", "%d-%m-%Y"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=IST).isoformat(timespec="seconds")
        except ValueError:
            continue
    return None


def to_float(value) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(",", ""))
    except ValueError:
        return None


def split_tender_number(tender_number: str) -> tuple[str, int]:
    """'BBMP/2024-25/BD/WORK_INDENT5011/CALL-4' -> ('BBMP/2024-25/BD/WORK_INDENT5011', 4).

    The first call carries no suffix and is call 1.
    """
    tn = (tender_number or "").strip()
    m = CALL_RE.search(tn)
    if m:
        return tn[: m.start()], int(m.group(1))
    return tn, 1


def public_tender_url(nit_id: int) -> str:
    # The portal is a single-page app; this is the API resource that backs the
    # tender's public detail view, which is the stable citation we can give.
    return full_view_url(nit_id)


# ---------------------------------------------------------------- parsers

def parse_search_row(row: dict) -> dict:
    root, call_no = split_tender_number(row.get("tenderNumber", ""))
    return {
        "nit_id": int(row["nitId"]),
        "kppp_id": row.get("id"),
        "tender_number": row.get("tenderNumber"),
        "process_key": root,
        "call_no": call_no,
        "dept_id": row.get("deptId"),
        "category": row.get("category"),
        "notice_type": row.get("tenderType"),  # e.g. RFQ
        "inviting_strategy": row.get("invitingStrategy"),
        "title": (row.get("title") or "").strip(),
        "work_category": row.get("workCategoryName"),
        "location_id": row.get("locationId"),
        "location_name": row.get("locationName"),
        "ecv": to_float(row.get("ecv")),
        "ecv_public": 1 if row.get("ecvtenderYn") else 0,
        "published_at": parse_dt(row.get("publishedDate")),
        "close_at_final": parse_dt(row.get("tenderClosureDate")),
        "status": row.get("status"),
        "itemwise": 1 if row.get("itemwise") else 0,
    }


def parse_full_view(doc: dict) -> dict:
    """Extract tender-level facts. Officials' phone numbers are never extracted."""
    n = doc.get("noticeInvitingTenderDTO") or {}
    t = doc.get("tenderSchedule") or {}
    subs = doc.get("tenderSubEstimateList") or []
    work_categories = sorted({s.get("workCategoryName") for s in subs if s.get("workCategoryName")})
    award_dates = doc.get("tenderAwardDatesDTO") or {}
    recall = doc.get("tenderRecallDTO")
    return {
        "tender_number": t.get("tenderNumber"),
        "title": (t.get("title") or "").strip() or None,
        "ecv": to_float(t.get("ecv")),
        "ecv_public": 1 if t.get("ecvtenderYn") else 0,
        "sub_estimate_total": sum(to_float(s.get("estimateTotal")) or 0 for s in subs) or None,
        "work_category": work_categories[0] if len(work_categories) == 1 else (", ".join(work_categories) or None),
        "location_id": t.get("location"),
        "location_name": t.get("locationName"),
        "status": t.get("status"),
        "notice_type": n.get("tenderType"),
        "evaluation_type": n.get("evaluationType"),
        "inviting_strategy": n.get("invitingStrategy"),
        "bid_value_type": n.get("bidValueType"),
        "tax_type": n.get("taxType"),
        "published_by_post": n.get("publishedByPost"),  # office designation code, e.g. BBMP_EE_DIV_MAH
        "published_at": parse_dt(n.get("publishedDate")),
        "close_at_final": parse_dt(n.get("tenderReceiptClose")),
        "query_close_at": parse_dt(n.get("tenderQueryClose")),
        "tech_open_at": parse_dt(n.get("technicalBidOpen")),
        "no_of_calls": n.get("noOfCalls"),
        "retendered": 1 if n.get("retenderedYn") else 0,
        "recalled": 1 if recall else 0,
        "pre_bid_meeting": 1 if n.get("preBidMeetingYn") else 0,
        "award_date": parse_dt(award_dates.get("awardedDates")),
        "n_eligibility_criteria": len(doc.get("generalCriterionList") or []),
        "n_technical_criteria": len(doc.get("technicalCriterionList") or []),
    }


def parse_corrigenda(items: list) -> list[dict]:
    out = []
    for c in items or []:
        out.append(
            {
                "seq": c.get("historyOrder") or len(out) + 1,
                "reason": (c.get("reason") or "").strip() or None,
                "status": c.get("status"),
                "created_at": parse_dt(c.get("createdTs")),
                "close_original": parse_dt(c.get("tenderReceiptCloseDateOriginal")),
                "close_revised": parse_dt(c.get("tenderReceiptCloseDateRevised")),
                "tech_open_original": parse_dt(c.get("technicalBidOpenDateOriginal")),
                "tech_open_revised": parse_dt(c.get("technicalBidOpenDateRevised")),
            }
        )
    out.sort(key=lambda r: r["seq"])
    return out


def parse_award(doc: dict | None, tender_status: str | None) -> dict | None:
    """Selected/awarded bid. Returns None when the portal has no selected bid."""
    if not isinstance(doc, dict) or not doc.get("supplierId"):
        return None
    bid_value = to_float(doc.get("bidValue"))
    negotiated = to_float(doc.get("negotiatedValue"))
    # 'awarded' only when the tender itself is recorded as AWARDED; otherwise the
    # portal has a selected bidder but no award on record.
    label = "awarded" if tender_status in ("AWARDED", "FINALIZED") else "selected_no_award"
    return {
        "tender_number": doc.get("tenderNumber"),
        "supplier_id": int(doc["supplierId"]),
        "supplier_name": (doc.get("supplierName") or "").strip(),
        "bid_status": doc.get("bidStatus"),
        "bid_value": bid_value,
        "negotiated_value": negotiated,
        "contract_value": negotiated if negotiated is not None else bid_value,
        "percentage_value": to_float(doc.get("percentageValue")),
        "commercial_bid_type": doc.get("commercialBidType"),
        "tax_type": doc.get("taxType"),
        "bid_submitted_at": parse_dt(doc.get("bidSubmissionTs")),
        "label": label,
    }


RANK_RE = re.compile(r"^\s*([\d.,]+)\s*\((L\d+)\)\s*$")


def parse_comparative_xlsx(data: bytes) -> dict | None:
    """Price-stage bidders from the comparative statement.

    Layout (verified): a 'Tender Number:' row, then a row of bidder names in the
    quoted-rate columns, then a 'SNo.' header, item rows, and a 'Total Bid
    Amount' row with values like '2000000.00 (L1)'. The 'Total Summary Amount'
    row double-counts items in some files, so it is ignored.
    """
    import warnings

    import openpyxl  # local import keeps module import light

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            wb = openpyxl.load_workbook(io.BytesIO(data), data_only=True)
    except Exception:
        return None
    ws = wb.worksheets[0]
    rows = [tuple(c for c in r) for r in ws.iter_rows(values_only=True)]
    tender_number = None
    header_idx = None
    for i, r in enumerate(rows):
        cells = [c for c in r if c is not None]
        if cells and str(cells[0]).strip() == "Tender Number:" and len(cells) > 1:
            tender_number = str(cells[1]).strip()
        if cells and str(cells[0]).strip() == "SNo.":
            header_idx = i
            break
    if header_idx is None:
        return None
    names: list[str] = []
    for r in reversed(rows[:header_idx]):
        cells = [str(c).strip() for c in r if c not in (None, "")]
        if cells and not any(c.endswith(":") for c in cells) and cells[0] != "Comparative Statement":
            names = cells
            break
    totals: list[tuple[float | None, str | None]] = []
    for r in rows[header_idx:]:
        cells = [c for c in r if c not in (None, "")]
        if cells and str(cells[0]).strip() == "Total Bid Amount":
            for v in cells[1:]:
                m = RANK_RE.match(str(v))
                totals.append((to_float(m.group(1)), m.group(2)) if m else (to_float(v), None))
            break
    bidders = []
    for i, name in enumerate(names):
        total, rank = totals[i] if i < len(totals) else (None, None)
        bidders.append({"position": i + 1, "raw_name": name, "total_bid": total, "rank": rank})
    return {"tender_number": tender_number, "n_bidders": len(names), "bidders": bidders}
