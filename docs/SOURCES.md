# Sources — what was verified (14 Oct 2026)

## KPPP (kppp.karnataka.gov.in) — primary source

Public JSON service behind the portal's web UI. No login and no CAPTCHA. Base URL:
`https://kppp.karnataka.gov.in/supplier-registration-service/v1/api/portal-service`

| Endpoint | Notes (verified) |
|---|---|
| `POST works/search-eproc-tenders?page=&size=` | The body needs `category`, `status` and `tenderType` (OPEN / RESERVED / RESTRICTED); `deptId` works on top of those. Page size up to 500. Total count in the `x-total-count` header. The `tenderNumber` filter returns nothing. |
| `GET {nitId}/works-tender-full-view` | Tender facts: ECV, dates, work category, `noOfCalls`, `retenderedYn`. **Use `nitId`, not the search row's `id`**: `id` silently returns a different tender. Some tenders return HTTP 500 on every attempt (recorded as `unavailable`). Includes officers' names and mobile numbers, which are never extracted. |
| `GET {nitId}/works-tender-corrigendums` | Sequence number, free-text reason, original and revised dates. No structured record of changes to eligibility criteria. |
| `GET bids/{nitId}/tender-category/WORKS/get-selected-bid-for-lumpsum` | Works for both ITEM_WISE and LUMPSUM tenders. `bidValue` is an amount in ₹. `negotiatedValue` often equals the ECV exactly. `bidStatus` is AWARDED or BID_SELECTED. "Evaluation completed" tenders also return a selected bidder. No GSTIN, PAN or CIN. |
| `GET tender-eval/{nitId}/commercial-evaluation/tender-category/WORKS/commercial-comparison/download-detailed` | XLSX comparative statement. Bidder names sit in the row above the `SNo.` header. The `Total Bid Amount` row carries L1/L2… ranks. The "Total Summary Amount" row double-counts items in some files, so its percentages are ignored. Lists price-stage bidders only, with no supplier IDs. |

## Phase 0 questions — answers

1. **Retenders.** Each call is a separate nitId. The first call has no suffix; later calls end `/CALL-n`. Calls are
   grouped by tender-number root.
2. **Award endpoint.** Works for item-wise and lump-sum tenders. Values are amounts, not percentages. Bid ÷ ECV
   outside 0.2–5 is quarantined.
3. **Tax basis.** Bids report `taxType` (typically `INCLUSIVE_TAX`). The ECV's tax basis is not stated.
4. **"Evaluation completed".** Returns a `BID_SELECTED` bidder, labelled "selected, no award recorded".
5. **Comparative-statement XLSX.** Names only, used for counts and display. Never used to create supplier records.
6. **Search paging.** Size ≤ 500 works. Results are ordered by publication date, newest first, and statuses are
   re-enumerated on every run.
7. **Identifiers.** None exposed (no GSTIN, PAN or CIN). Supplier identity is the KPPP `supplierId`.
   `SAME_ENTITY_AS` claims therefore need an external official identifier.

## Volumes at first enumeration

13,528 works tender calls (11,678 distinct works) for BBMP, GBA, the five city corporations, B-SMILE, BSWML and GBDA.
For BBMP works (open tenders): 2,267 Awarded, 3,392 Evaluation completed, 1,083 Retendered, 758 Recalled (cancelled),
218 Under evaluation, 65 No bids, plus 645 Awarded reserved tenders.

## Officeholders (reference only)

Karnataka Legislative Assembly lists (`kla.kar.nic.in`): 16th Assembly members (constituencies 150–177 are Bengaluru
Urban) and the council of ministers, which includes the Greater Bengaluru Development portfolio. The ministers page is
undated, so the snapshot date is the only evidence of when a portfolio was held. These are stored for reference and are
never published on their own.

## OpenStreetMap — named places

Fetched once with `civictrace ingest osm` from the Overpass API (with public mirrors when the main server is busy),
at most one request per second: named water bodies, parks, roads, schools, hospitals, places of worship, burial
grounds, stations, junctions, markets and libraries inside Greater Bengaluru, as points (`out center tags`). Saved to
`data/geo/raw/osm-places.json` (about 33,000 features). Licence: ODbL; attribution "© OpenStreetMap contributors" is
shown on the map and in the README. The Overpass server refuses requests whose User-Agent looks like an anonymous
crawler, so CivicTrace's User-Agent names the project and its repository.

## Ruled out or deferred

| Source | Status |
|---|---|
| CPPP (eprocure.gov.in) | CAPTCHA, not used |
| MCA21 | CAPTCHA and restrictive copyright, not automated |
| eCourts | CAPTCHA; manual claims only |
| MyNeta / ADR | Terms prohibit scraping; link out only |
| Old eproc.karnataka.gov.in (about 2007–2023) | Deferred |
| OpenCity BBMP payments | Deferred |
| CAG Karnataka | Open reuse, but most reports cover periods before 2023; rule 7 is planned |

## Pending verification

- The current gazetted text of KTPP Rules rule 17 (minimum tender periods). The legal-minimum comparison stays off until
  it is committed under `docs/legal/`.
- Constitution dates of the five Bengaluru city corporations.
