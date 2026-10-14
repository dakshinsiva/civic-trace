"""Karnataka Legislative Assembly (kla.kar.nic.in) officeholder snapshots.

Stores MLAs and the council of ministers as REFERENCE data in `officeholder`,
with the archived page hash and fetch date. The ministers page is undated, so
the snapshot date is the only evidence of when a portfolio was held.

Officeholders are never published on their own: an office only appears in the
documented-connections graph as context for a person who already has a
complete published path to a KPPP supplier (see graph.py). To use one, write a
HELD_OFFICE claim citing the snapshot (`civictrace claims new HELD_OFFICE ...`).
"""

from __future__ import annotations

import re
import sqlite3

from selectolax.lexbor import LexborHTMLParser

from ..http import PoliteClient
from ..store import now_iso, record_document

MEMBERS_URL = "https://kla.kar.nic.in/assembly/member/16assemblymemberslist.htm"
MINISTERS_URL = "https://kla.kar.nic.in/assembly/ministers.htm"

# Assembly constituency numbers in Bengaluru Urban district. Names are taken from
# the official page at parse time, so a wrong number would be visible in the data.
BENGALURU_AC_RANGE = range(150, 178)

SCHEMA = """
CREATE TABLE IF NOT EXISTS officeholder (
  source TEXT NOT NULL,
  office_kind TEXT NOT NULL,      -- MLA / MINISTER
  name_en TEXT NOT NULL,
  name_kn TEXT,
  constituency_no INTEGER,
  constituency TEXT,
  party TEXT,
  portfolio TEXT,
  remarks TEXT,
  bengaluru INTEGER NOT NULL,
  snapshot_at TEXT NOT NULL,
  doc_id INTEGER NOT NULL,
  PRIMARY KEY (source, office_kind, name_en, snapshot_at)
);
"""

LATIN = re.compile(r"[A-Za-z]")


def _split_en_kn(text: str) -> tuple[str, str | None]:
    parts = [p.strip() for p in text.split("|") if p.strip()]
    en = [p for p in parts if LATIN.search(p)]
    kn = [p for p in parts if not LATIN.search(p)]
    return (" ".join(en) if en else text.strip()), (" ".join(kn) if kn else None)


def parse_members(html: str) -> list[dict]:
    t = LexborHTMLParser(html)
    out = []
    for tr in t.css("tr"):
        cells = tr.css("td")
        if len(cells) < 4:
            continue
        no = cells[0].text(strip=True)
        if not no.isdigit():
            continue
        constituency, _ = _split_en_kn(cells[1].text(separator="|"))
        name_en, name_kn = _split_en_kn(cells[2].text(separator="|"))
        party, _ = _split_en_kn(cells[3].text(separator="|"))
        remarks = " ".join(c.text(strip=True) for c in cells[4:]) or None
        out.append(
            {
                "office_kind": "MLA",
                "constituency_no": int(no),
                "constituency": re.sub(r"\s*\(\d+\)\s*$", "", constituency),
                "name_en": name_en,
                "name_kn": name_kn,
                "party": party,
                "remarks": remarks,
                "bengaluru": int(no) in BENGALURU_AC_RANGE,
            }
        )
    return out


def parse_ministers(html: str) -> list[dict]:
    t = LexborHTMLParser(html)
    out = []
    for tr in t.css("tr"):
        cells = tr.css("td")
        if len(cells) != 3:
            continue
        sl = cells[0].text(strip=True)
        if not sl.isdigit():
            continue
        name = re.sub(r"\s+", " ", cells[1].text(separator=" ")).replace("||", ".").strip()
        portfolio = re.sub(r"\s+", " ", cells[2].text(separator=" ")).strip()
        out.append(
            {
                "office_kind": "MINISTER",
                "name_en": name,
                "portfolio": portfolio,
                "bengaluru": bool(re.search(r"Bengaluru|BDA|BMRDA|BWSSB|BMRCL", portfolio)),
            }
        )
    return out


def run(conn: sqlite3.Connection) -> str:
    conn.executescript(SCHEMA)
    snapshot = now_iso()
    counts = {}
    with PoliteClient(min_interval=1.0) as client:
        for url, kind, parser in ((MEMBERS_URL, "members", parse_members), (MINISTERS_URL, "ministers", parse_ministers)):
            f = client.fetch(url, archive_as=f"kla/{kind}")
            if f.status != 200:
                counts[kind] = f"HTTP {f.status}"
                continue
            doc_id = record_document(conn, f)
            rows = parser(f.body.decode("utf-8-sig", errors="replace"))
            for r in rows:
                conn.execute(
                    """INSERT OR REPLACE INTO officeholder(source, office_kind, name_en, name_kn, constituency_no,
                         constituency, party, portfolio, remarks, bengaluru, snapshot_at, doc_id)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (
                        url, r["office_kind"], r["name_en"], r.get("name_kn"), r.get("constituency_no"),
                        r.get("constituency"), r.get("party"), r.get("portfolio"), r.get("remarks"),
                        int(r["bengaluru"]), snapshot, doc_id,
                    ),
                )
            counts[kind] = f"{len(rows)} rows ({sum(r['bengaluru'] for r in rows)} Bengaluru-related)"
    conn.commit()
    return f"KLA snapshot {snapshot}: {counts}"
