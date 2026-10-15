"""Polite HTTP client.

- One request at a time, at most one per `min_interval` seconds.
- Retries transient failures (timeouts, 5xx, empty bodies) with backoff.
- Every response body is archived under data/raw with its sha256, so each
  record can be traced back to the exact bytes the portal returned.
- No CAPTCHA handling, no login, no header spoofing: if a source puts up a
  CAPTCHA, we stop using it.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import httpx

from . import RAW_DIR, __version__

USER_AGENT = (
    f"CivicTrace/{__version__} (open-source procurement research; "
    "https://github.com/civictrace; polite crawler, 1 req/s)"
)


@dataclass
class Fetched:
    url: str
    method: str
    request_body: str | None
    status: int
    body: bytes
    sha256: str
    path: Path
    fetched_at: str
    headers: dict[str, str]

    def json(self):
        return json.loads(self.body or b"null")


def read_archived(path: str | Path) -> bytes:
    """Bytes of an archived response, whether stored plain or gzip-compressed."""
    p = Path(path)
    data = p.read_bytes()
    return gzip.decompress(data) if p.suffix == ".gz" else data


class TransientError(Exception):
    pass


class PoliteClient:
    def __init__(
        self,
        raw_dir: Path = RAW_DIR,
        min_interval: float = 1.0,
        retries: int = 3,
        timeout: float = 90.0,
    ) -> None:
        self.raw_dir = raw_dir
        self.min_interval = min_interval
        self.retries = retries
        self._last = 0.0
        self._lock = threading.Lock()  # one global request-start rate, shared by all worker threads
        self._client = httpx.Client(
            headers={"User-Agent": USER_AGENT, "Accept": "application/json, */*"},
            timeout=timeout,
            follow_redirects=True,
        )
        self.requests_made = 0

    def close(self) -> None:
        self._client.close()

    def __enter__(self) -> "PoliteClient":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def _wait(self) -> None:
        with self._lock:
            elapsed = time.monotonic() - self._last
            if elapsed < self.min_interval:
                time.sleep(self.min_interval - elapsed)
            self._last = time.monotonic()
            self.requests_made += 1

    def fetch(
        self,
        url: str,
        archive_as: str,
        *,
        method: str = "GET",
        json_body: dict | None = None,
        params: dict | None = None,
        retry_statuses: tuple[int, ...] = (500, 502, 503, 504),
        allow_empty: bool = False,
    ) -> Fetched:
        """Fetch a URL and archive the body at raw_dir/archive_as.<sha8>.<ext>.

        Non-retryable HTTP errors (e.g. 400 recordNotFound) are returned, not raised:
        callers decide what an error response means for their record.
        """
        body_text = json.dumps(json_body, sort_keys=True) if json_body is not None else None
        last_exc: Exception | None = None
        for attempt in range(self.retries + 1):
            self._wait()
            try:
                resp = self._client.request(method, url, json=json_body, params=params)
                body = resp.content
                if resp.status_code in retry_statuses or (not body and not allow_empty):
                    raise TransientError(f"{resp.status_code} len={len(body)}")
                return self._archive(url, method, body_text, resp, body, archive_as)
            except (httpx.TransportError, TransientError) as exc:
                last_exc = exc
                if attempt < self.retries:
                    time.sleep(min(30.0, 2.0 * (2**attempt)))
        # Out of retries: archive the final (failed) response if we have one.
        if isinstance(last_exc, TransientError):
            return self._archive(url, method, body_text, resp, body, archive_as)  # type: ignore[possibly-undefined]
        raise last_exc  # type: ignore[misc]

    def _archive(self, url, method, body_text, resp, body: bytes, archive_as: str) -> Fetched:
        sha = hashlib.sha256(body).hexdigest()
        ctype = resp.headers.get("content-type", "")
        ext = "xlsx" if body[:2] == b"PK" else ("json" if "json" in ctype or body[:1] in (b"{", b"[") else "bin")
        # gzip-compressed on disk; the sha256 is of the original (uncompressed) bytes
        path = self.raw_dir / f"{archive_as}.{sha[:12]}.{ext}.gz"
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_bytes(gzip.compress(body, compresslevel=6))
        full_url = str(resp.request.url) if resp is not None else url
        return Fetched(
            url=full_url,
            method=method,
            request_body=body_text,
            status=resp.status_code,
            body=body,
            sha256=sha,
            path=path,
            fetched_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
            headers={k.lower(): v for k, v in resp.headers.items()},
        )
