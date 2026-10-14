"""SQLite store. One file (data/civictrace.sqlite), stdlib only."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from . import DB_PATH

SCHEMA = """
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS source_document (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL,
  method TEXT NOT NULL,
  request_body TEXT,
  status INTEGER,
  sha256 TEXT NOT NULL,
  path TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  UNIQUE (url, request_body, sha256)
);

CREATE TABLE IF NOT EXISTS buyer (
  dept_id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  family TEXT,
  parent_code TEXT,
  effective_from TEXT,
  effective_to TEXT,
  note TEXT
);

-- One row per tender *call* (nitId). Retendered calls of the same work share process_key.
CREATE TABLE IF NOT EXISTS tender_call (
  nit_id INTEGER PRIMARY KEY,
  kppp_id INTEGER,
  tender_number TEXT NOT NULL,
  process_key TEXT NOT NULL,
  call_no INTEGER NOT NULL,
  dept_id INTEGER NOT NULL,
  category TEXT,
  tender_type TEXT,            -- OPEN / RESERVED / RESTRICTED (search filter it was found under)
  notice_type TEXT,            -- e.g. RFQ
  inviting_strategy TEXT,
  evaluation_type TEXT,
  bid_value_type TEXT,         -- ITEM_WISE / LUMPSUM / ...
  tax_type TEXT,
  published_by_post TEXT,      -- publishing office's designation code (not a personal name)
  title TEXT,
  work_category TEXT,
  location_id INTEGER,
  location_name TEXT,
  ecv REAL,
  ecv_public INTEGER,
  sub_estimate_total REAL,
  published_at TEXT,
  close_at_original TEXT,
  close_at_final TEXT,
  query_close_at TEXT,
  tech_open_at TEXT,
  no_of_calls INTEGER,
  retendered INTEGER,
  recalled INTEGER,
  pre_bid_meeting INTEGER,
  n_eligibility_criteria INTEGER,
  n_technical_criteria INTEGER,
  itemwise INTEGER,
  status TEXT NOT NULL,
  status_observed_at TEXT NOT NULL,
  award_date TEXT,
  detail_state TEXT NOT NULL DEFAULT 'pending',   -- pending / ok / unavailable / quarantined
  detail_fetched_at TEXT,
  detail_status TEXT,          -- tender status at the time details were fetched
  search_doc_id INTEGER,
  detail_doc_id INTEGER,
  corrigenda_doc_id INTEGER
);
CREATE INDEX IF NOT EXISTS ix_call_process ON tender_call(process_key);
CREATE INDEX IF NOT EXISTS ix_call_dept ON tender_call(dept_id);

CREATE TABLE IF NOT EXISTS status_history (
  nit_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  first_observed_at TEXT NOT NULL,
  PRIMARY KEY (nit_id, status)
);

CREATE TABLE IF NOT EXISTS amendment (
  nit_id INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  reason TEXT,
  status TEXT,
  created_at TEXT,
  close_original TEXT,
  close_revised TEXT,
  tech_open_original TEXT,
  tech_open_revised TEXT,
  doc_id INTEGER,
  PRIMARY KEY (nit_id, seq)
);

CREATE TABLE IF NOT EXISTS award (
  nit_id INTEGER PRIMARY KEY,
  supplier_id INTEGER NOT NULL,
  supplier_name TEXT NOT NULL,
  bid_status TEXT,
  bid_value REAL,
  negotiated_value REAL,
  contract_value REAL,
  percentage_value REAL,
  commercial_bid_type TEXT,
  tax_type TEXT,
  bid_submitted_at TEXT,
  label TEXT NOT NULL,          -- awarded / selected_no_award
  doc_id INTEGER
);
CREATE INDEX IF NOT EXISTS ix_award_supplier ON award(supplier_id);

CREATE TABLE IF NOT EXISTS bid_summary (
  nit_id INTEGER PRIMARY KEY,
  n_price_stage_bidders INTEGER NOT NULL,
  source TEXT NOT NULL,
  doc_id INTEGER
);

-- Losing bidders' names are kept for internal QA only and never exported.
CREATE TABLE IF NOT EXISTS bidder (
  nit_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  raw_name TEXT,
  total_bid REAL,
  rank TEXT,
  PRIMARY KEY (nit_id, position)
);

CREATE TABLE IF NOT EXISTS supplier (
  supplier_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  first_seen TEXT,
  last_seen TEXT
);
CREATE TABLE IF NOT EXISTS supplier_name (
  supplier_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  PRIMARY KEY (supplier_id, name)
);

CREATE TABLE IF NOT EXISTS quarantine (
  nit_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT,
  observed_at TEXT NOT NULL,
  PRIMARY KEY (nit_id, reason)
);

CREATE TABLE IF NOT EXISTS flag (
  flag_id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  subject_type TEXT NOT NULL,   -- tender_call / buyer_slice / supplier_slice
  subject_id TEXT NOT NULL,
  nit_id INTEGER,
  dept_id INTEGER,
  supplier_id INTEGER,
  fiscal_year TEXT,
  work_category TEXT,
  payload TEXT NOT NULL,        -- JSON of the full Flag model
  run_id TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_flag_rule ON flag(rule_id);

CREATE TABLE IF NOT EXISTS rule_notice (
  rule_id TEXT NOT NULL,
  slice_key TEXT NOT NULL,
  kind TEXT NOT NULL,           -- coverage_insufficient / too_small / zero_spread
  detail TEXT,
  run_id TEXT NOT NULL,
  PRIMARY KEY (rule_id, slice_key, kind)
);

CREATE TABLE IF NOT EXISTS rule_summary (
  rule_id TEXT PRIMARY KEY,
  flags INTEGER,
  slices INTEGER,
  evaluated INTEGER,
  notices INTEGER,
  run_id TEXT,
  ran_at TEXT
);

CREATE TABLE IF NOT EXISTS coverage (
  dept_id INTEGER,
  fiscal_year TEXT,
  field TEXT,
  n INTEGER,
  n_present INTEGER,
  PRIMARY KEY (dept_id, fiscal_year, field)
);

CREATE TABLE IF NOT EXISTS ingest_run (
  run_id TEXT PRIMARY KEY,
  started_at TEXT,
  finished_at TEXT,
  requests INTEGER,
  note TEXT
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# Columns added after the first schema version: (table, column, type).
MIGRATIONS = [
    ("tender_call", "published_by_post", "TEXT"),
]


def connect(path: Path = DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=60)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA busy_timeout = 60000")
    conn.executescript(SCHEMA)
    for table, col, typ in MIGRATIONS:
        cols = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
        if col not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} {typ}")
    conn.commit()
    return conn


def record_document(conn: sqlite3.Connection, fetched) -> int:
    conn.execute(
        """INSERT OR IGNORE INTO source_document(url, method, request_body, status, sha256, path, fetched_at)
           VALUES (?,?,?,?,?,?,?)""",
        (
            fetched.url,
            fetched.method,
            fetched.request_body,
            fetched.status,
            fetched.sha256,
            str(fetched.path),
            fetched.fetched_at,
        ),
    )
    row = conn.execute(
        "SELECT id FROM source_document WHERE url=? AND request_body IS ? AND sha256=?",
        (fetched.url, fetched.request_body, fetched.sha256),
    ).fetchone()
    return int(row["id"])


def upsert(conn: sqlite3.Connection, table: str, row: dict, key: tuple[str, ...]) -> None:
    cols = list(row)
    placeholders = ",".join("?" for _ in cols)
    updates = ",".join(f"{c}=excluded.{c}" for c in cols if c not in key)
    sql = f"INSERT INTO {table} ({','.join(cols)}) VALUES ({placeholders}) ON CONFLICT ({','.join(key)}) DO "
    sql += f"UPDATE SET {updates}" if updates else "NOTHING"
    conn.execute(sql, [row[c] for c in cols])
