"""
DVM-900 demo backend — smoke tests (stdlib unittest, no pytest needed).
Spawns the server on an ephemeral port, exercises endpoints, verifies duplicate rejection.
"""

import json
import os
import subprocess
import sys
import time
import unittest
import urllib.request
import urllib.error
import socket
from pathlib import Path

HERE = Path(__file__).resolve().parent
DB = HERE / "votes.db"
PORT = 5899

def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port

def req(method, path, body=None):
    url = f"http://127.0.0.1:{PORT}{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
                              headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(r, timeout=5) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {"error": "unreadable"}

class DvmBackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if DB.exists():
            DB.unlink()
        cls.proc = subprocess.Popen(
            [sys.executable, str(HERE / "dvm_server.py")],
            env={**os.environ, "DVM_PORT": str(PORT)},
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        for _ in range(50):
            try:
                s, _ = req("GET", "/api/health")
                if s == 200:
                    break
            except Exception:
                time.sleep(0.1)
        else:
            raise RuntimeError("server did not start")

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(timeout=5)

    def test_01_health(self):
        s, d = req("GET", "/api/health")
        self.assertEqual(s, 200)
        self.assertTrue(d["ok"])
        self.assertFalse(d["tampered"])

    def test_02_tally_empty(self):
        s, d = req("GET", "/api/tally")
        self.assertEqual(s, 200)
        self.assertEqual(d["total"], 0)
        self.assertEqual(len(d["candidates"]), 5)

    def test_03_invalid_epic_rejected(self):
        s, d = req("POST", "/api/vote", {"epic": "!!", "candidate_id": 2})
        self.assertEqual(s, 400)

    def test_04_unknown_candidate_rejected(self):
        s, d = req("POST", "/api/vote", {"epic": "EPIC-900001", "candidate_id": 9})
        self.assertEqual(s, 400)

    def test_05_first_vote_accepted(self):
        s, d = req("POST", "/api/vote", {"epic": "EPIC-900001", "candidate_id": 2})
        self.assertEqual(s, 201)
        self.assertTrue(d["ok"])

    def test_06_duplicate_rejected_server_side(self):
        s, d = req("POST", "/api/vote", {"epic": "EPIC-900001", "candidate_id": 3})
        self.assertEqual(s, 409)
        self.assertEqual(d["code"], "DUPLICATE_EPIC")

    def test_07_tally_counts(self):
        req("POST", "/api/vote", {"epic": "EPIC-900002", "candidate_id": 2})
        s, d = req("GET", "/api/tally")
        self.assertEqual(s, 200)
        self.assertEqual(d["total"], 2)
        win = next(c for c in d["candidates"] if c["id"] == 2)
        self.assertEqual(win["votes"], 2)

    def test_08_audit_chain_intact(self):
        s, d = req("GET", "/api/audit")
        self.assertEqual(s, 200)
        self.assertFalse(d["tampered"])
        self.assertGreaterEqual(len(d["entries"]), 1)

if __name__ == "__main__":
    unittest.main(verbosity=2)
