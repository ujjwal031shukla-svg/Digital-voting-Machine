#!/usr/bin/env python3
"""
DVM-900 DEMO backend — thin SQLite-backed voting tally service.

REALITY CHECK (Demo, not production):
  - No election authority voter roll — EPIC is format-checked + hashed, never verified.
  - Duplicate prevention is server-side and works only for this deployment.
  - The signing key sits next to the data (like dvm_key.key). This is demonstrative.
  - Still not a certified EVM. In-memory demo page is purely illustrative.

Run:
  D:/DE Digital voting Machine/.venv/Scripts/python.exe server/dvm_server.py

Endpoints:
  GET  /                       -> demo kiosk page (server/demo.html)
  GET  /api/tally              -> { total, candidates: [{ id, code, name, votes }] }
  GET  /api/audit              -> last 20 audit entries { ok, entries, tampered }
  POST /api/vote               -> { epic, candidate_id, doc_hash? }
                                 201 { ok: true }  | 400 { error }  | 409 { error: "ID already voted" }
  POST /api/reset              -> officer reset (clears tallies, audits it)
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sqlite3
import sys
import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "votes.db"
KEY_PATH = ROOT / ".backend_key"
PORT = int(os.environ.get("DVM_PORT", "5000"))
EPIC_RE = re.compile(r"^[A-Z0-9\-]{6,12}$")
SALT = "DVM-VOTER\x00"

def load_or_create_key() -> bytes:
    if KEY_PATH.exists():
        return KEY_PATH.read_bytes()
    key = secrets.token_bytes(32)
    KEY_PATH.write_bytes(key)
    os.chmod(KEY_PATH, 0o600) if hasattr(os, "chmod") else None
    return key

KEY = load_or_create_key()

def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()

def hash_epic(epic: str) -> str:
    return sha256((SALT + epic).encode("utf-8"))

CANDIDATES = [
    (1, "01", "ELENA ROSTOVA"),
    (2, "02", "MARCUS VANCE"),
    (3, "03", "AMINA AL-MANSOOR"),
    (4, "04", "DAVID K. CHEN"),
    (5, "05", "NOTA"),
]

def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = connect()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS votes (
            epic_hash TEXT PRIMARY KEY,
            doc_hash  TEXT NOT NULL,
            candidate_id INTEGER NOT NULL,
            ts TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS candidates (
            id INTEGER PRIMARY KEY,
            code TEXT NOT NULL,
            name TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS audit_log (
            seq INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT NOT NULL,
            event TEXT NOT NULL,
            detail TEXT NOT NULL DEFAULT '',
            prev TEXT NOT NULL,
            chain TEXT NOT NULL
        );
        """
    )
    if conn.execute("SELECT COUNT(*) FROM candidates").fetchone()[0] == 0:
        conn.executemany("INSERT INTO candidates (id, code, name) VALUES (?,?,?)", CANDIDATES)
    conn.commit()
    conn.close()

def chain_head(conn) -> str:
    row = conn.execute("SELECT chain FROM audit_log ORDER BY seq DESC LIMIT 1").fetchone()
    return row["chain"] if row else "GENESIS"

def log_event(conn, event: str, detail: str = ""):
    prev = chain_head(conn)
    ts = datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    payload = json.dumps({"ts": ts, "event": event, "detail": detail, "prev": prev}, sort_keys=True, separators=(",", ":")).encode()
    chain = sha256(payload)
    conn.execute(
        "INSERT INTO audit_log (ts, event, detail, prev, chain) VALUES (?,?,?,?,?)",
        (ts, event, detail, prev, chain),
    )

def verify_chain() -> bool:
    conn = connect()
    rows = conn.execute("SELECT seq, ts, event, detail, prev, chain FROM audit_log ORDER BY seq").fetchall()
    conn.close()
    head = "GENESIS"
    for row in rows:
        payload = json.dumps({"ts": row["ts"], "event": row["event"], "detail": row["detail"], "prev": head}, sort_keys=True, separators=(",", ":")).encode()
        expected = sha256(payload)
        if row["chain"] != expected or row["prev"] != head:
            return False
        head = row["chain"]
    return True

class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # -- helpers -----------------------------------------------
    def _send(self, code: int, obj, cache: bool = False) -> None:
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if not cache:
            self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", "0") or 0)
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return {}

    def _serve_static(self, path: Path) -> None:
        if not path.exists():
            self.send_error(404); return
        body = path.read_bytes()
        ctype = "text/html; charset=utf-8" if path.suffix == ".html" else "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):  # silence default stderr spam
        pass

    # -- routes ---------------------------------------------
    def do_GET(self):
        path = urlparse(self.path).path
        if path in ("/", "/index.html", "/demo.html"):
            self._serve_static(ROOT / "demo.html"); return
        if path == "/api/tally":
            conn = connect()
            rows = conn.execute(
                "SELECT c.id, c.code, c.name, COUNT(v.epic_hash) AS votes "
                "FROM candidates c LEFT JOIN votes v ON v.candidate_id = c.id "
                "GROUP BY c.id ORDER BY c.id"
            ).fetchall()
            total = conn.execute("SELECT COUNT(*) FROM votes").fetchone()[0]
            conn.close()
            self._send(200, {
                "total": total,
                "candidates": [{"id": r["id"], "code": r["code"], "name": r["name"], "votes": r["votes"]} for r in rows],
            }); return
        if path == "/api/audit":
            conn = connect()
            rows = conn.execute(
                "SELECT seq, ts, event, detail, substr(chain,1,16) AS chain FROM audit_log ORDER BY seq DESC LIMIT 20"
            ).fetchall()
            conn.close()
            self._send(200, {
                "ok": True,
                "tampered": not verify_chain(),
                "entries": [dict(r) for r in rows],
            }); return
        if path == "/api/health":
            self._send(200, {"ok": True, "service": "DVM-900 demo backend", "tampered": not verify_chain()}); return
        self._send(404, {"error": "not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/vote":
            body = self._read_json()
            epic = str(body.get("epic", "")).upper().strip()
            doc_hash = str(body.get("doc_hash", "")).strip()
            try:
                cand_id = int(body.get("candidate_id"))
            except (TypeError, ValueError):
                cand_id = -1
            if not EPIC_RE.match(epic):
                self._send(400, {"error": "Invalid EPIC format (6-12 A-Z/0-9/-)"}); return
            if cand_id not in {c[0] for c in CANDIDATES}:
                self._send(400, {"error": "Unknown candidate"}); return
            conn = connect()
            h = hash_epic(epic)
            try:
                conn.execute(
                    "INSERT INTO votes (epic_hash, doc_hash, candidate_id, ts) VALUES (?,?,?,?)",
                    (h, doc_hash or sha256(secrets.token_bytes(16)), cand_id,
                     datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"),
                )
                log_event(conn, "VOTE_ACCEPTED", f"candidate={cand_id} hash={h[:12]}")
                conn.commit()
                conn.close()
                self._send(201, {"ok": True, "receipt": sha256(h.encode() + KEY)[:16]}); return
            except sqlite3.IntegrityError:
                log_event(conn, "VOTE_DUPLICATE", f"hash={h[:12]}")
                conn.commit()
                conn.close()
                self._send(409, {"error": "ID already voted", "code": "DUPLICATE_EPIC"}); return
        if path == "/api/reset":
            conn = connect()
            conn.execute("DELETE FROM votes")
            log_event(conn, "ELECTION_RESET", "Officer reset — tallies cleared (demo)")
            conn.commit()
            conn.close()
            self._send(200, {"ok": True}); return
        self._send(404, {"error": "not found"})


def main():
    init_db()
    print(f"DVM-900 demo backend -> http://127.0.0.1:{PORT}")
    print(f"DB: {DB_PATH}")
    print("Ctrl+C to stop. This is a DEMO, not a real election system.")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

if __name__ == "__main__":
    main()



