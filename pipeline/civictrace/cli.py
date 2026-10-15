"""Command-line entry point: `uv run civictrace --help`."""

from __future__ import annotations

import json
from pathlib import Path

import typer

from . import DB_PATH, REPO_DIR
from .store import connect

app = typer.Typer(no_args_is_help=True, add_completion=False)
ingest_app = typer.Typer(no_args_is_help=True, help="Fetch data from sources.")
claims_app = typer.Typer(no_args_is_help=True, help="Evidence-gated relationship claims.")
app.add_typer(ingest_app, name="ingest")
app.add_typer(claims_app, name="claims")


@ingest_app.command("kppp")
def ingest_kppp(
    buyers: str = typer.Option("", help="Comma-separated buyer codes (default: all enabled in buyers.yaml)."),
    enumerate_: bool = typer.Option(True, "--enumerate/--no-enumerate", help="Re-list calls via search."),
    details: bool = typer.Option(True, "--details/--no-details", help="Fetch per-call details."),
    limit: int = typer.Option(0, help="Max calls to fetch details for (0 = all)."),
    priority_fy: str = typer.Option("", help="Fetch this fiscal year's details first (default: interleave all months)."),
    min_interval: float = typer.Option(1.0, help="Seconds between request starts, across all workers (be polite: >= 1)."),
    workers: int = typer.Option(2, help="Concurrent workers sharing the global rate limit (max 3)."),
    retry_failed: bool = typer.Option(False, "--retry-failed", help="Only re-try calls whose details failed earlier."),
    max_attempts: int = typer.Option(3, help="With --retry-failed: skip calls already tried this many times."),
    db: Path = typer.Option(DB_PATH),
) -> None:
    """Ingest Bengaluru works tenders from KPPP (resumable)."""
    from . import ingest

    if min_interval < 1.0:
        raise typer.BadParameter("min-interval below 1s is not allowed")
    if not 1 <= workers <= 3:
        raise typer.BadParameter("workers must be 1–3")
    conn = connect(db)
    ingest.run(
        conn,
        buyer_codes=[b.strip() for b in buyers.split(",") if b.strip()] or None,
        do_enumerate=enumerate_,
        do_details=details,
        limit=limit or None,
        priority_fy=priority_fy or None,
        min_interval=min_interval,
        workers=workers,
        db_path=db,
        retry_failed=retry_failed,
        max_attempts=max_attempts,
    )


@app.command()
def status(db: Path = typer.Option(DB_PATH)) -> None:
    """Show ingest progress."""
    conn = connect(db)
    q = lambda sql: conn.execute(sql).fetchall()  # noqa: E731
    typer.echo("calls by buyer/status:")
    for r in q(
        """SELECT b.code, t.status, COUNT(*) n FROM tender_call t JOIN buyer b USING(dept_id)
           GROUP BY 1,2 ORDER BY 1,3 DESC"""
    ):
        typer.echo(f"  {r['code']:7} {r['status']:22} {r['n']}")
    typer.echo("detail state:")
    for r in q("SELECT detail_state, COUNT(*) n FROM tender_call GROUP BY 1"):
        typer.echo(f"  {r['detail_state']:12} {r['n']}")
    for t in ("award", "bid_summary", "amendment", "supplier", "quarantine", "flag"):
        typer.echo(f"{t}: {q(f'SELECT COUNT(*) n FROM {t}')[0]['n']}")


@app.command()
def reparse(db: Path = typer.Option(DB_PATH)) -> None:
    """Re-extract tender fields from archived full-view responses (no network)."""
    import json as _json

    from .http import read_archived
    from .sources import kppp

    conn = connect(db)
    rows = conn.execute(
        """SELECT t.nit_id, t.tender_number, d.path FROM tender_call t
           JOIN source_document d ON d.id = t.detail_doc_id WHERE t.detail_state = 'ok'"""
    ).fetchall()
    n = 0
    for r in rows:
        try:
            doc = _json.loads(read_archived(r["path"]) or b"null")
        except (OSError, ValueError):
            continue
        d = kppp.parse_full_view(doc) if isinstance(doc, dict) else None
        if not d or d["tender_number"] != r["tender_number"]:
            continue
        conn.execute("UPDATE tender_call SET published_by_post=? WHERE nit_id=?", (d["published_by_post"], r["nit_id"]))
        n += 1
    conn.commit()
    typer.echo(f"reparsed {n} of {len(rows)} calls")


@app.command()
def rules(db: Path = typer.Option(DB_PATH)) -> None:
    """Run all enabled rules and store flags + coverage."""
    from .rules import run_all

    conn = connect(db)
    summary = run_all(conn)
    for rule_id, s in summary.items():
        typer.echo(f"{rule_id:16} {s}")


@app.command()
def export(
    out: Path = typer.Option(REPO_DIR / "web" / "data"),
    include_relationships: bool = typer.Option(False, help="Include published claims/graph (non-public builds only)."),
    db: Path = typer.Option(DB_PATH),
) -> None:
    """Write the static JSON data release consumed by the web app."""
    from .export import export_all

    conn = connect(db)
    info = export_all(conn, out, include_relationships=include_relationships)
    typer.echo(info)


@claims_app.command("validate")
def claims_validate() -> None:
    """Validate every claim file; non-zero exit on any error."""
    from .claims import load_claims

    claims, errors = load_claims()
    for e in errors:
        typer.echo(f"ERROR {e}", err=True)
    typer.echo(f"{len(claims)} valid claims, {len(errors)} errors")
    raise typer.Exit(1 if errors else 0)


@claims_app.command("new")
def claims_new(
    predicate: str = typer.Argument(..., help="One of the allowed predicates."),
    claim_id: str = typer.Argument(..., help="Short slug for the file name."),
) -> None:
    """Scaffold a draft claim file to fill in by hand."""
    from .claims import scaffold

    path = scaffold(predicate, claim_id)
    typer.echo(f"wrote {path}")


@ingest_app.command("geo")
def ingest_geo() -> None:
    """Download official Bengaluru ward/corporation boundaries (OpenCity, public domain)."""
    from .geo import GEO_RAW, SOURCES
    from .http import PoliteClient

    GEO_RAW.mkdir(parents=True, exist_ok=True)
    with PoliteClient(raw_dir=GEO_RAW.parent / "archive", min_interval=1.0) as client:
        for name, url in SOURCES.items():
            f = client.fetch(url, archive_as=name)
            if f.status == 200:
                (GEO_RAW / name).write_bytes(f.body)
            typer.echo(f"{name}: HTTP {f.status}, {len(f.body):,} bytes")


@ingest_app.command("osm")
def ingest_osm() -> None:
    """Download named places in Bengaluru from OpenStreetMap (one Overpass request), for placing contracts."""
    from .http import PoliteClient
    from .sites import OSM_RAW, OVERPASS_URLS, QUERY

    OSM_RAW.parent.mkdir(parents=True, exist_ok=True)
    with PoliteClient(raw_dir=OSM_RAW.parent.parent / "archive", min_interval=1.0, timeout=300, retries=0) as client:
        for url in OVERPASS_URLS:
            try:
                f = client.fetch(url, archive_as="osm-places", method="POST", form={"data": QUERY})
            except Exception as exc:  # timeouts and connection errors: try the next server
                typer.echo(f"{url}: {exc.__class__.__name__}")
                continue
            ok = f.status == 200 and f.body.lstrip().startswith(b"{")
            typer.echo(f"{url}: HTTP {f.status}, {len(f.body):,} bytes")
            if ok:
                OSM_RAW.write_bytes(f.body)
                typer.echo(f"osm-places: {len(json.loads(f.body).get('elements', [])):,} features")
                return
    raise typer.Exit(1)


@ingest_app.command("kla")
def ingest_kla(db: Path = typer.Option(DB_PATH)) -> None:
    """Snapshot Karnataka Legislative Assembly member/minister lists (draft office claims)."""
    from .sources import kla

    conn = connect(db)
    typer.echo(kla.run(conn))


if __name__ == "__main__":
    app()
