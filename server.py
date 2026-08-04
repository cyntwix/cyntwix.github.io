#!/usr/bin/env python3
"""Cyntwix static site and shared writing-entry API.

Uses only the Python standard library so a fresh Raspberry Pi OS install can
run it without pip. In production, Nginx serves the static files and proxies
/api/ requests to this process on 127.0.0.1:8000.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
import threading
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from functools import partial
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


SITE_ROOT = Path(__file__).resolve().parent
DATABASE_PATH = Path(
    os.environ.get("CYNTWIX_DB", SITE_ROOT / "var" / "entries.db")
).resolve()
HOST = os.environ.get("CYNTWIX_HOST", "127.0.0.1")
PORT = int(os.environ.get("CYNTWIX_PORT", "8000"))

MAX_BODY_BYTES = 16_384
MAX_NAME_LENGTH = 80
MAX_TEXT_LENGTH = 10_000
MAX_ENTRIES_RETURNED = 250
RATE_WINDOW_SECONDS = 10 * 60
RATE_MAX_SUBMISSIONS = 8
WORD_RE = re.compile(r"[a-z]+(?:'[a-z]+)?")

rate_lock = threading.Lock()
submission_times: dict[str, deque[float]] = defaultdict(deque)


def connect_db() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH, timeout=5)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 5000")
    return connection


def initialize_db() -> None:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)

    with connect_db() as connection:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS entries (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at TEXT NOT NULL,
                words_json TEXT NOT NULL,
                body TEXT NOT NULL,
                word_count INTEGER NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_entries_created_at
            ON entries(created_at DESC)
            """
        )
        connection.execute("PRAGMA optimize")


def tokenize(value: str) -> list[str]:
    return WORD_RE.findall(value.lower())


def is_rate_limited(address: str) -> bool:
    now = time.monotonic()
    cutoff = now - RATE_WINDOW_SECONDS

    with rate_lock:
        timestamps = submission_times[address]
        while timestamps and timestamps[0] < cutoff:
            timestamps.popleft()
        if len(timestamps) >= RATE_MAX_SUBMISSIONS:
            return True
        timestamps.append(now)
        return False


def validate_entry(payload: object) -> tuple[dict[str, object] | None, str | None]:
    if not isinstance(payload, dict):
        return None, "The submission must be a JSON object."

    # Quietly reject simple bot form-fillers without storing their content.
    if payload.get("website"):
        return None, "Invalid submission."

    name = str(payload.get("name", "")).strip()
    body = str(payload.get("text", "")).strip()
    raw_words = payload.get("words")

    if not name or len(name) > MAX_NAME_LENGTH:
        return None, f"Name must contain 1 to {MAX_NAME_LENGTH} characters."
    if not body or len(body) > MAX_TEXT_LENGTH:
        return None, f"Writing must contain 1 to {MAX_TEXT_LENGTH} characters."
    if not isinstance(raw_words, list) or not 3 <= len(raw_words) <= 10:
        return None, "Choose between 3 and 10 prompt words."

    words: list[str] = []
    for raw_word in raw_words:
        word = str(raw_word).strip().lower()
        if not WORD_RE.fullmatch(word) or word in words:
            return None, "Prompt words are invalid."
        words.append(word)

    body_words = tokenize(body)
    body_word_set = set(body_words)
    if any(word not in body_word_set for word in words):
        return None, "The writing must use every prompt word."

    return {
        "id": uuid.uuid4().hex,
        "name": name,
        "timestamp": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "words": words,
        "text": body,
        "wordCount": len(body_words),
    }, None


class CyntwixHandler(SimpleHTTPRequestHandler):
    server_version = "Cyntwix/1.0"

    def log_message(self, format_string: str, *args: object) -> None:
        print(
            f"{self.log_date_time_string()} "
            f"{self.client_address[0]} {format_string % args}",
            flush=True,
        )

    def send_json(self, status: HTTPStatus, payload: object) -> None:
        data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode(
            "utf-8"
        )
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        parsed = urlparse(self.path)

        if parsed.path == "/api/health":
            self.send_json(HTTPStatus.OK, {"ok": True})
            return

        if parsed.path == "/api/entries":
            query = parse_qs(parsed.query)
            try:
                requested_limit = int(query.get("limit", ["100"])[0])
            except ValueError:
                requested_limit = 100
            limit = max(1, min(requested_limit, MAX_ENTRIES_RETURNED))

            with connect_db() as connection:
                rows = connection.execute(
                    """
                    SELECT id, name, created_at, words_json, body, word_count
                    FROM entries
                    ORDER BY created_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                ).fetchall()

            entries = [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "timestamp": row["created_at"],
                    "words": json.loads(row["words_json"]),
                    "text": row["body"],
                    "wordCount": row["word_count"],
                }
                for row in rows
            ]
            self.send_json(HTTPStatus.OK, {"entries": entries})
            return

        if parsed.path.startswith("/api/"):
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
            return

        super().do_GET()

    def do_POST(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        if parsed.path != "/api/entries":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "Not found."})
            return

        content_type = self.headers.get("Content-Type", "")
        if "application/json" not in content_type:
            self.send_json(
                HTTPStatus.UNSUPPORTED_MEDIA_TYPE,
                {"error": "Expected application/json."},
            )
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0

        if content_length <= 0 or content_length > MAX_BODY_BYTES:
            self.send_json(
                HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                {"error": "Submission is too large."},
            )
            return

        try:
            payload = json.loads(self.rfile.read(content_length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid JSON."})
            return

        address = self.headers.get("X-Real-IP") or self.client_address[0]
        if is_rate_limited(address):
            self.send_json(
                HTTPStatus.TOO_MANY_REQUESTS,
                {"error": "Too many submissions. Please wait and try again."},
            )
            return

        entry, error = validate_entry(payload)
        if error or entry is None:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": error})
            return

        with connect_db() as connection:
            connection.execute(
                """
                INSERT INTO entries
                    (id, name, created_at, words_json, body, word_count)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    entry["id"],
                    entry["name"],
                    entry["timestamp"],
                    json.dumps(entry["words"], separators=(",", ":")),
                    entry["text"],
                    entry["wordCount"],
                ),
            )

        self.send_json(HTTPStatus.CREATED, {"entry": entry})


def main() -> None:
    initialize_db()
    handler = partial(CyntwixHandler, directory=str(SITE_ROOT))
    server = ThreadingHTTPServer((HOST, PORT), handler)
    print(f"Cyntwix listening at http://{HOST}:{PORT}", flush=True)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
