"""
================================================================================
DIGITAL VOTING MACHINE (DVM) - Course Simulation (Tkinter)
================================================================================
Course: Digital Electronics / Software Engineering
Platform: Python 3.x (stdlib only; optional `cryptography` for AES-GCM at rest)
States: IDLE, READY, VOTED, LOCKED, RESULT
DISCLAIMER: Educational software simulation of an electronic voting machine.
            NOT for real elections. Not a certified EVM.

Features:
  - Officer PIN authentication with 3-attempt lockout + 30s cooldown (persisted)
  - Voter ID (EPIC) verification — one ID per ballot, hashed at rest
  - Officer 5-minute inactivity auto-lock
  - PIN change flow (re-authenticates with current PIN before changing)
  - Single-vote lockout per session (plus persisted per voter ID)
  - Button disabling after vote cast
  - AES-GCM encrypted at rest (dvm_key.key, machine-local) with integrity tag;
    plaintext fallback is loudly audited (integrity-only mode without `cryptography`)
  - Atomic file writes for crash safety
  - Tamper-evident hash-chained audit log (seq + prev-sha256)
  - Visual + auditory feedback (winsound on Windows, fallback elsewhere)
  - Role-based state transitions (Officer vs Voter)

Run (recommended — AES-GCM at rest):
    D:\\DE Digital voting Machine\\.venv\\Scripts\\python.exe digital_voting_machine.py
Fallback (integrity-only, no encryption at rest):
    python digital_voting_machine.py

Usage:
    python digital_voting_machine.py
================================================================================
"""

import tkinter as tk
from tkinter import messagebox, simpledialog
import json
import os
import datetime
import sys
import threading
import hashlib
import hmac
import base64
import re
import time
from typing import Callable

# ---------------------------------------------------------------------------
# AES-GCM encryption for votes at rest (Windows: use the D:-drive venv,
#   D:\DE Digital voting Machine\.venv  ->  .venv\Scripts\python digital_voting_machine.py)
# Without the `cryptography` package the app falls back to integrity-only mode
# (loudly logged as AUDIT limitation) rather than crashing.
# ---------------------------------------------------------------------------
try:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    _HAS_CRYPTO = True
except ImportError:
    _HAS_CRYPTO = False

# ------------------------------------------------------------------
# Optional MySQL mirror (non-fatal when the server is down)
# ------------------------------------------------------------------
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
try:
    from db import db_connect as _DB
    _HAS_DB = True
except Exception:
    _DB = None
    _HAS_DB = False

# ---------------------------------------------------------------------------
# Cross-platform sound feedback
# ---------------------------------------------------------------------------
try:
    import winsound  # Windows only
    _HAS_WINSOUND = True
except ImportError:  # pragma: no cover - non-Windows platforms
    _HAS_WINSOUND = False

try:
    import subprocess
    _HAS_SUBPROCESS = True
except ImportError:  # pragma: no cover
    _HAS_SUBPROCESS = False

try:
    import os
    _HAS_OS = True
except ImportError:  # pragma: no cover
    _HAS_OS = False


def _mac_sound(name: str) -> bool:
    """Play a built-in macOS system sound if available."""
    if not _HAS_SUBPROCESS or sys.platform != "darwin":
        return False
    try:
        subprocess.run(["afplay", f"/System/Library/Sounds/{name}.aiff"],
                       check=False, timeout=2, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


def _linux_sound() -> bool:
    """Play a generic bell on Linux via available sound stack (PulseAudio/ALSA)."""
    if not _HAS_SUBPROCESS or sys.platform.startswith("linux") is False:
        return False
    for cmd in (["paplay", "/usr/share/sounds/freedesktop/stereo/bell.oga"],
                ["aplay", "/usr/share/sounds/alsa/Front_Center.wav"]):
        try:
            result = subprocess.run(cmd, check=False, timeout=2,
                                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if result.returncode == 0:
                return True
        except Exception:
            pass
    return False


def play_sound(kind: str) -> None:
    """
    Play auditory feedback for a given event kind.
    Runs in a background thread so the GUI never blocks.
    """
    def _beep() -> None:
        if not _HAS_WINSOUND:
            # Layered cross-platform fallback: macOS → Linux → terminal bell
            mac_name = {"success": "Glass", "error": "Sosumi", "lock": "Basso", "transition": "Pop"}.get(kind, "Glass")
            if _mac_sound(mac_name):
                return
            if _linux_sound():
                return
            sys.stderr.write("\a")
            sys.stderr.flush()
            return
        try:
            if kind == "success":
                winsound.Beep(900, 180)      # high, pleasant
                winsound.Beep(1100, 120)
            elif kind == "error":
                winsound.Beep(300, 400)      # low, warning
            elif kind == "lock":
                winsound.Beep(600, 200)
                winsound.Beep(600, 200)
            elif kind == "transition":
                winsound.Beep(700, 100)
            else:  # info / default
                winsound.Beep(700, 100)
        except Exception:
            pass

    threading.Thread(target=_beep, daemon=True).start()


# ---------------------------------------------------------------------------
# Finite State Machine constants
# ---------------------------------------------------------------------------
IDLE = "IDLE"
READY = "READY"
VOTED = "VOTED"
LOCKED = "LOCKED"
RESULT = "RESULT"

ALL_STATES = [IDLE, READY, VOTED, LOCKED, RESULT]

# Valid transitions: source_state -> set of allowed destination states
VALID_TRANSITIONS = {
    IDLE:     {READY},
    READY:    {VOTED, LOCKED},
    VOTED:    {READY, LOCKED},
    LOCKED:   {RESULT, IDLE},
    RESULT:   {IDLE},
}

# Officer-only transitions (require PIN authentication)
OFFICER_TRANSITIONS = {
    IDLE:     {READY},      # start voting
    READY:    {LOCKED},     # lock machine
    VOTED:    {LOCKED},     # lock after vote
    LOCKED:   {RESULT, IDLE},  # show results or full reset
    RESULT:   {IDLE},       # return to idle
}

# Colour scheme per state for visual feedback
STATE_COLOURS = {
    IDLE:     "#6c757d",   # gray
    READY:    "#0d6efd",   # blue
    VOTED:    "#198754",   # green
    LOCKED:   "#fd7e14",   # amber/orange
    RESULT:   "#6f42c1",   # purple
}

STATE_LABELS = {
    IDLE:     "IDLE - Awaiting Officer",
    READY:    "READY - Voting Open",
    VOTED:    "VOTED - Vote Cast (Locked)",
    LOCKED:   "LOCKED - Session Closed",
    RESULT:   "RESULT - Tally Declared",
}


# ---------------------------------------------------------------------------
# Digital Voting Machine Controller
# ---------------------------------------------------------------------------
class DigitalVotingMachine:
    """
    Main controller for the DVM application.
    Manages state, authentication, vote tallying, persistence, and UI.
    """

    DATA_FILE = "votes_data.json"
    AUDIT_FILE = "audit_log.json"
    DEFAULT_PIN = "1234"
    VOTER_ID_RE = re.compile(r"^[A-Z0-9\-]{6,12}$")
    SESSION_TIMEOUT_MS = 5 * 60 * 1000
    LOCKOUT_SECONDS = 30

    # Default candidate roster (colour-coded for visual distinction)
    DEFAULT_CANDIDATES = {
        "1": {"name": "Candidate A - Progressive Alliance", "votes": 0, "color": "#B51D04"},
        "2": {"name": "Candidate B - Conservative Front", "votes": 0, "color": "#1E3FE0"},
        "3": {"name": "Candidate C - Liberty Party", "votes": 0, "color": "#2B676C"},
        "4": {"name": "NOTA - None of the Above", "votes": 0, "color": "#6C757D"},
    }

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("Digital Voting Machine - Secure Ballot Terminal")
        self.root.geometry("900x720")
        self.root.minsize(760, 560)
        self.root.resizable(True, True)
        self.root.configure(bg="#f8f9fa")
        self._set_app_icon()

        # --- Runtime state ---
        self.current_state = IDLE
        self.voter_has_voted = False          # single-vote lockout flag (session)
        self.authenticated_officer = False    # officer PIN validated
        self.failed_pin_attempts = 0
        self.max_pin_attempts = 3
        self.current_voter_id = None          # voter ID currently armed on the ballot
        self.used_voter_id_hashes = set()     # hashed IDs that already voted (persisted)
        self.pin_lockout_until = 0.0          # epoch seconds; 0 means not locked
        self.audit_tampered = False           # set if hash chain fails verification
        self.officer_timer = None             # officer inactivity auto-lock timer

        # --- Data ---
        self.candidates = {}
        self.total_voters = 0
        self.admin_pin = self.DEFAULT_PIN
        self.session_locked = False

        # Load persisted data (or initialize defaults)
        self.load_data()

        # Verify the audit hash chain — never trust it blindly.
        # One-time migration: legacy plain entries (no seq/hash) are re-chained.
        self._migrate_audit_chain()
        self.audit_tampered = not self.verify_audit_chain()
        if self.audit_tampered:
            self._persist_tamper("AUDIT_CHAIN_TAMPERED",
                                 "Audit log hash chain is broken — log entry altered or removed")

        # MySQL mirror — create schema once, then keep a liveness flag
        self.db_available = False
        if _HAS_DB:
            try:
                if _DB.ping():
                    self.db_available = _DB.ensure_schema()
                    if self.db_available:
                        self.append_audit(event="DB_CONNECTED", actor="SYSTEM",
                                          detail="MySQL mirror online — dvm_db schema verified")
                else:
                    self.append_audit(event="DB_UNAVAILABLE", actor="SYSTEM",
                                      detail="MySQL server did not respond — running offline kiosk mode")
            except Exception as db_error:
                print(f"[DVM-DB] startup check failed (non-fatal): {db_error}", file=sys.stderr)
                self.append_audit(event="DB_UNAVAILABLE", actor="SYSTEM", detail=str(db_error)[:200])

        # --- Build UI ---
        self.build_ui()

        # Restore a persisted lockout, if any survives an app restart
        if self.pin_lockout_until and self._lockout_remaining() > 0:
            self.pin_entry.config(state="disabled")
            self._schedule_lockout_end()

        # --- Initialize to IDLE ---
        self.set_state(IDLE, log=False)

        # Handle window close gracefully
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    # ------------------------------------------------------------------
    # Crypto helpers (AES-256-GCM with a machine-local key file)
    # Key lives next to the data (kiosk-local boundary), not in source
    # control. AES-GCM's tag gives integrity: any edit fails decryption.
    # ------------------------------------------------------------------
    KEY_FILE = "dvm_key.key"

    @staticmethod
    def _b64e(raw: bytes) -> str:
        return base64.b64encode(raw).decode("ascii")

    @staticmethod
    def _b64d(text: str) -> bytes:
        return base64.b64decode(text.encode("ascii"))

    def _machine_key(self) -> bytes:
        key_path = os.path.join(os.path.dirname(os.path.abspath(self.DATA_FILE)), self.KEY_FILE)
        if os.path.exists(key_path):
            try:
                with open(key_path, "rb") as f:
                    raw = f.read()
                if len(raw) >= 32:
                    return raw[:32]
            except OSError:
                pass
        key = os.urandom(32)
        try:
            with open(key_path, "wb") as f:
                f.write(key)
            try:
                os.chmod(key_path, 0o600)
            except OSError:
                pass  # Windows chmod is best-effort
        except OSError:
            pass
        return key

    # ------------------------------------------------------------------
    # Application icon (drawn in-memory — no external asset required)
    # ------------------------------------------------------------------
    def _set_app_icon(self) -> None:
        """Draw a minimal ballot-box glyph and set it as the window icon."""
        icon = tk.PhotoImage(width=64, height=64)
        # Putty-grey background
        icon.put("#CFCBC1", to=(0, 0, 64, 64))
        # Vermillion box body
        icon.put("#B51D04", to=(8, 22, 56, 54))
        # Dark lid stripe
        icon.put("#8F1100", to=(8, 22, 56, 28))
        # Slot
        icon.put("#1B1A17", to=(20, 32, 44, 36))
        # Chalk down-arrow: shaft then three widening bars
        icon.put("#F3F1EC", to=(29, 10, 35, 28))
        icon.put("#F3F1EC", to=(26, 28, 38, 32))
        icon.put("#F3F1EC", to=(23, 32, 41, 36))
        icon.put("#F3F1EC", to=(29, 36, 35, 42))
        # Keep a reference so the image is not garbage-collected
        self._icon_image = icon
        try:
            self.root.iconphoto(True, icon)
        except tk.TclError:
            pass

    def _votes_payload(self) -> dict:
        return {
            "candidates": self.candidates,
            "total_voters": self.total_voters,
            "admin_pin": self.admin_pin,
            "session_locked": self.session_locked,
            "voter_id_hashes": sorted(self.used_voter_id_hashes),
            "failed_pin_attempts": self.failed_pin_attempts,
            "pin_lockout_until": self.pin_lockout_until,
        }

    def _apply_votes_payload(self, data: dict) -> None:
        self.candidates = data.get("candidates", self.DEFAULT_CANDIDATES)
        self.total_voters = data.get("total_voters", 0)
        self.admin_pin = data.get("admin_pin", self.DEFAULT_PIN)
        self.session_locked = data.get("session_locked", False)
        self.used_voter_id_hashes = set(data.get("voter_id_hashes", []))
        self.failed_pin_attempts = int(data.get("failed_pin_attempts", 0))
        self.pin_lockout_until = float(data.get("pin_lockout_until", 0.0))

    def load_data(self) -> None:
        """Load votes at rest. Supports AES-GCM v2, legacy v1 plaintext (migrates),
        and corrupt-file fallback (loudly logged — never silent)."""
        if not os.path.exists(self.DATA_FILE):
            self.candidates = dict(self.DEFAULT_CANDIDATES)
            self.total_voters = 0
            self.admin_pin = self.DEFAULT_PIN
            self.session_locked = False
            self.used_voter_id_hashes = set()
            return
        try:
            with open(self.DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, OSError):
            self.candidates = dict(self.DEFAULT_CANDIDATES)
            self.total_voters = 0
            self.admin_pin = self.DEFAULT_PIN
            self.session_locked = False
            self.used_voter_id_hashes = set()
            self._persist_tamper("VOTES_DATA_UNREADABLE", "Corrupt votes file — not silently lost")
            return

        if isinstance(data, dict) and data.get("version") == 2:
            if not _HAS_CRYPTO:
                # Cannot decrypt without cryptography — keep going in integrity-only
                # mode with defaults rather than crashing the kiosk.
                self.candidates = dict(self.DEFAULT_CANDIDATES)
                self.total_voters = 0
                self.admin_pin = self.DEFAULT_PIN
                self.session_locked = False
                self.used_voter_id_hashes = set()
                self._persist_tamper("CRYPTO_UNAVAILABLE", "Cannot decrypt v2 votes file without cryptography package")
                return
            try:
                nonce = self._b64d(data["nonce"])
                key = self._machine_key()
                plaintext = AESGCM(key).decrypt(nonce, self._b64d(data["ct"]), None)
                self._apply_votes_payload(json.loads(plaintext.decode("utf-8")))
                return
            except Exception:
                # Tag mismatch => tampered or moved/copied without its key file.
                self.candidates = dict(self.DEFAULT_CANDIDATES)
                self.total_voters = 0
                self.session_locked = False
                self.used_voter_id_hashes = set()
                self._persist_tamper("VOTES_DATA_TAMPERED", "AES-GCM tag verification failed — file modified or copied without dvm_key.key")
                return
        else:
            # Legacy plaintext v1 -> migrate transparently to encrypted v2
            self._apply_votes_payload(data)
            self._persist_tamper("MIGRATED_TO_ENCRYPTION", "Legacy plaintext votes re-encrypted at rest")
            self.save_data()

    def save_data(self) -> None:
        """Atomically persist votes (AES-GCM v2). Falls back to cleartext +
        loud audit entry when cryptography is unavailable."""
        payload = self._votes_payload()
        tmp_file = self.DATA_FILE + ".tmp"
        try:
            if _HAS_CRYPTO:
                nonce = os.urandom(12)
                ct = AESGCM(self._machine_key()).encrypt(nonce, json.dumps(payload).encode("utf-8"), None)
                doc = {"version": 2, "nonce": self._b64e(nonce),
                       "ct": self._b64e(ct)}
            else:
                payload["version"] = 1
                doc = payload
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(doc, f, indent=2)
            os.replace(tmp_file, self.DATA_FILE)
        except OSError as save_error:
            # Clean up the temp file, then record the failure loudly — never silently
            if os.path.exists(tmp_file):
                try:
                    os.remove(tmp_file)
                except OSError:
                    pass
            print(f"[DVM] SAVE FAILED: {save_error}", file=sys.stderr)
            self._persist_tamper(
                "SAVE_DATA_FAILED",
                f"Cannot write {os.path.abspath(self.DATA_FILE)} — {save_error}. "
                "Tally persists in memory only until the disk issue is resolved.",
            )

    def _persist_tamper(self, event: str, detail: str) -> None:
        """Record a persistence anomaly without crashing startup."""
        try:
            self.append_audit(event=event, actor="SYSTEM", detail=detail)
        except OSError:
            pass

    # ------------------------------------------------------------------
    # Audit log — tamper-evident hash chain (seq + prev + sha256)
    # ------------------------------------------------------------------
    @staticmethod
    def _canonical_entry(entry: dict) -> bytes:
        return json.dumps({k: entry[k] for k in ("seq", "timestamp", "event", "actor", "detail", "prev")},
                          sort_keys=True, separators=(",", ":")).encode("utf-8")

    def _read_audit_log(self) -> list:
        if not os.path.exists(self.AUDIT_FILE):
            return []
        try:
            with open(self.AUDIT_FILE, "r", encoding="utf-8") as f:
                log = json.load(f)
            return log if isinstance(log, list) else []
        except (json.JSONDecodeError, OSError):
            return []

    def _migrate_audit_chain(self) -> None:
        """Re-chain legacy plain entries (seq/hash missing) in place, once."""
        log = self._read_audit_log()
        if not log or all(isinstance(e, dict) and "seq" in e and "hash" in e for e in log):
            return
        prev_hash = "GENESIS"
        rebuilt = []
        for i, entry in enumerate(log):
            if not isinstance(entry, dict):
                entry = {"event": "UNKNOWN", "actor": "SYSTEM", "detail": str(entry)[:200], "timestamp": "1970-01-01T00:00:00"}
            entry = dict(entry)
            entry.setdefault("timestamp", datetime.datetime.now().isoformat(timespec="seconds"))
            entry.setdefault("actor", "SYSTEM")
            entry.setdefault("detail", "")
            entry["seq"] = i
            entry["prev"] = prev_hash
            entry["hash"] = hashlib.sha256(self._canonical_entry(entry)).hexdigest()
            prev_hash = entry["hash"]
            rebuilt.append(entry)
        tmp_file = self.AUDIT_FILE + ".tmp"
        try:
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(rebuilt, f, indent=2)
            os.replace(tmp_file, self.AUDIT_FILE)
        except OSError:
            pass

    def verify_audit_chain(self) -> bool:
        """Recompute every entry's hash and linkage. Returns False on any break."""
        log = self._read_audit_log()
        prev_hash = "GENESIS"
        for i, entry in enumerate(log):
            if not isinstance(entry, dict):
                return False
            try:
                if entry.get("seq") != i:
                    return False
                if entry.get("prev") != prev_hash:
                    return False
                expected = hashlib.sha256(self._canonical_entry(entry)).hexdigest()
                if not hmac.compare_digest(entry.get("hash", ""), expected):
                    return False
                prev_hash = entry["hash"]
            except (KeyError, TypeError):
                return False
        return True

    def append_audit(self, event: str, actor: str, detail: str = "") -> None:
        """Append a timestamped, hash-chained audit event to the audit log."""
        log = self._read_audit_log()
        prev_hash = log[-1].get("hash", "GENESIS") if log and isinstance(log[-1], dict) else "GENESIS"
        entry = {
            "seq": len(log),
            "timestamp": datetime.datetime.now().isoformat(timespec="seconds"),
            "event": event,
            "actor": actor,
            "detail": detail,
            "prev": prev_hash,
        }
        entry["hash"] = hashlib.sha256(self._canonical_entry(entry)).hexdigest()
        log.append(entry)
        if _HAS_DB and self.__dict__.get("db_available"):
            try:
                _DB.insert_audit(entry["seq"], entry["event"], entry["actor"],
                                 entry["detail"], entry["hash"])
            except Exception as e:
                print(f"[DVM-DB] mirror audit failed (non-fatal): {e}", file=sys.stderr)
        tmp_file = self.AUDIT_FILE + ".tmp"
        try:
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(log, f, indent=2)
            os.replace(tmp_file, self.AUDIT_FILE)
        except OSError:
            if os.path.exists(tmp_file):
                try:
                    os.remove(tmp_file)
                except OSError:
                    pass

    # ------------------------------------------------------------------
    # State Machine
    # ------------------------------------------------------------------
    def is_valid_transition(self, source: str, dest: str, actor: str = "VOTER") -> bool:
        """Check whether source -> dest is a valid FSM transition."""
        if dest not in VALID_TRANSITIONS.get(source, set()):
            return False
        # Officer-only guard
        if dest in OFFICER_TRANSITIONS.get(source, set()):
            return actor == "OFFICER" and self.authenticated_officer
        return True

    def set_state(self, new_state: str, actor: str = "SYSTEM", log: bool = True) -> None:
        """
        Transition the FSM to new_state and refresh the UI.
        Plays a transition beep and logs to audit trail.
        """
        if new_state not in ALL_STATES:
            play_sound("error")
            return

        if not self.is_valid_transition(self.current_state, new_state, actor):
            play_sound("error")
            messagebox.showwarning(
                "Invalid Transition",
                f"Transition {self.current_state} -> {new_state} is not permitted "
                f"in the current state or requires officer authentication.",
            )
            return

        old_state = self.current_state
        self.current_state = new_state

        # Fresh ballot for each voter: clear any armed voter ID
        if new_state in (READY, IDLE):
            self.current_voter_id = None
            self._reset_voter_panel()

        # Update session-locked flag
        self.session_locked = new_state in (LOCKED, RESULT)
        self.save_data()

        if log and old_state != new_state:
            self.append_audit(
                event=f"STATE_CHANGE_{old_state}_to_{new_state}",
                actor=actor,
                detail=f"Machine transitioned from {old_state} to {new_state}",
            )

        play_sound("transition")
        self.refresh_ui()

    # ------------------------------------------------------------------
    # UI Construction
    # ------------------------------------------------------------------
    def build_ui(self) -> None:
        """Construct all frames and widgets."""
        self.container = tk.Frame(self.root, bg="#f8f9fa")
        self.container.pack(fill="both", expand=True)

        # Create frames for each state
        self.frames = {}
        for state in ALL_STATES:
            frame = tk.Frame(self.container, bg="#f8f9fa")
            frame.place(relx=0, rely=0, relwidth=1, relheight=1)
            self.frames[state] = frame

        self._build_idle_frame()
        self._build_login_frame()
        self._build_ready_frame()
        self._build_voted_frame()
        self._build_locked_frame()
        self._build_result_frame()

        # Persistent status bar (always visible)
        self.status_bar = tk.Label(
            self.root,
            text="",
            bd=1,
            relief="sunken",
            anchor="w",
            bg="#e9ecef",
            fg="#212529",
            font=("Segoe UI", 10),
            padx=10,
            pady=4,
        )
        self.status_bar.pack(side="bottom", fill="x")

        # State indicator pill
        self.state_indicator = tk.Label(
            self.root,
            text="",
            bg="#adb5bd",
            fg="white",
            font=("Segoe UI", 11, "bold"),
            padx=14,
            pady=6,
        )
        self.state_indicator.place(relx=1.0, rely=0.0, anchor="ne", x=-12, y=12)

    # ------------------------- IDLE -------------------------
    def _build_idle_frame(self) -> None:
        f = self.frames[IDLE]
        tk.Label(
            f,
            text="DIGITAL VOTING MACHINE",
            font=("Segoe UI", 24, "bold"),
            bg="#f8f9fa",
            fg="#212529",
        ).pack(pady=(60, 10))
        tk.Label(
            f,
            text="Secure Ballot Terminal - Academic Project",
            font=("Segoe UI", 12),
            bg="#f8f9fa",
            fg="#6c757d",
        ).pack(pady=(0, 40))

        btn_frame = tk.Frame(f, bg="#f8f9fa")
        btn_frame.pack()

        tk.Button(
            btn_frame,
            text="Officer Login",
            command=self.open_login,
            width=22,
            height=2,
            font=("Segoe UI", 12, "bold"),
            bg="#0d6efd",
            fg="white",
            activebackground="#0b5ed7",
            cursor="hand2",
        ).pack(pady=8)

        tk.Button(
            btn_frame,
            text="Exit",
            command=self.on_close,
            width=22,
            height=2,
            font=("Segoe UI", 11),
            bg="#dc3545",
            fg="white",
            activebackground="#bb2d3b",
            cursor="hand2",
        ).pack(pady=8)

    # ------------------------- LOGIN -------------------------
    def _build_login_frame(self) -> None:
        # Dedicated login frame (not an FSM state)
        f = tk.Frame(self.container, bg="#f8f9fa")
        f.place(relx=0, rely=0, relwidth=1, relheight=1)
        self.frames["LOGIN"] = f

        tk.Label(
            f,
            text="Officer Authentication",
            font=("Segoe UI", 20, "bold"),
            bg="#f8f9fa",
            fg="#212529",
        ).pack(pady=(80, 20))

        tk.Label(
            f,
            text="Enter Admin PIN:",
            font=("Segoe UI", 12),
            bg="#f8f9fa",
        ).pack()

        self.pin_entry = tk.Entry(f, show="*", font=("Segoe UI", 14), width=20, justify="center")
        self.pin_entry.pack(pady=10)
        self.pin_entry.bind("<Return>", lambda e: self.attempt_login())

        self.login_error = tk.Label(f, text="", bg="#f8f9fa", fg="#dc3545", font=("Segoe UI", 10))
        self.login_error.pack()

        btn_frame = tk.Frame(f, bg="#f8f9fa")
        btn_frame.pack(pady=20)

        tk.Button(
            btn_frame,
            text="Login",
            command=self.attempt_login,
            width=18,
            height=2,
            font=("Segoe UI", 12, "bold"),
            bg="#0d6efd",
            fg="white",
            activebackground="#0b5ed7",
            cursor="hand2",
        ).pack(side="left", padx=8)

        tk.Button(
            btn_frame,
            text="Back",
            command=lambda: self.set_state(IDLE, actor="SYSTEM"),
            width=18,
            height=2,
            font=("Segoe UI", 11),
            bg="#6c757d",
            fg="white",
            activebackground="#5a6268",
            cursor="hand2",
        ).pack(side="left", padx=8)

    def open_login(self) -> None:
        """Display the officer login frame."""
        self.pin_entry.delete(0, tk.END)
        self.login_error.config(text="")
        self.frames["LOGIN"].tkraise()

    def attempt_login(self) -> None:
        """Validate the officer PIN (persistent 3-attempt lockout + 30s cooldown)."""
        if self.pin_lockout_until and self._lockout_remaining() > 0:
            self.login_error.config(
                text=f"Keypad locked — try again in {self._lockout_remaining()}s.")
            play_sound("error")
            return
        pin = self.pin_entry.get().strip()
        if not pin:
            self.login_error.config(text="PIN cannot be empty.")
            play_sound("error")
            return
        if not pin.isdigit() or len(pin) > 8:
            self.login_error.config(text="PIN must be 4-8 digits.")
            play_sound("error")
            return

        if pin == self.admin_pin:
            self.authenticated_officer = True
            self.failed_pin_attempts = 0
            self.pin_lockout_until = 0.0
            self.save_data()
            self.append_audit(event="OFFICER_LOGIN_SUCCESS", actor="OFFICER")
            play_sound("success")
            self._start_officer_timer()
            messagebox.showinfo("Authentication", "Officer authenticated successfully.")
            self.set_state(READY, actor="OFFICER")
        else:
            self.failed_pin_attempts += 1
            self.append_audit(event="OFFICER_LOGIN_FAILED", actor="OFFICER")
            play_sound("error")
            remaining = self.max_pin_attempts - self.failed_pin_attempts
            if self.failed_pin_attempts >= self.max_pin_attempts:
                self.pin_lockout_until = time.time() + self.LOCKOUT_SECONDS
                self.save_data()
                self.pin_entry.config(state="disabled")
                self.login_error.config(
                    text=f"Maximum PIN attempts — keypad locked for {self.LOCKOUT_SECONDS}s."
                )
                self._schedule_lockout_end()
                self.append_audit(event="OFFICER_LOGIN_LOCKOUT", actor="OFFICER")
                messagebox.showerror("Access Denied", "Too many failed attempts. Keypad locked.")
            else:
                self.save_data()
                self.login_error.config(
                    text=f"Incorrect PIN. {remaining} attempt(s) remaining."
                )

    # ------------------------- READY -------------------------
    def _build_ready_frame(self) -> None:
        f = self.frames[READY]

        tk.Label(
            f,
            text="Voting Session Open",
            font=("Segoe UI", 20, "bold"),
            bg="#f8f9fa",
            fg="#0d6efd",
        ).pack(pady=(30, 6))

        # ---- Voter authentication (Step 1 of 2) ----
        tk.Label(
            f,
            text="Step 1 of 2 — Verify voter ID to open the ballot",
            font=("Segoe UI", 11, "bold"),
            bg="#f8f9fa",
            fg="#495057",
        ).pack(pady=(0, 4))

        id_frame = tk.Frame(f, bg="#f8f9fa")
        id_frame.pack()

        self.voter_id_entry = tk.Entry(
            id_frame, font=("Segoe UI", 13), width=24, justify="center"
        )
        self.voter_id_entry.pack(side="left", padx=(0, 8))
        self.voter_id_entry.bind("<Return>", lambda e: self.verify_voter_id())

        tk.Button(
            id_frame,
            text="VERIFY & OPEN BALLOT",
            command=self.verify_voter_id,
            width=20,
            font=("Segoe UI", 10, "bold"),
            bg="#0d6efd",
            fg="white",
            activebackground="#0b5ed7",
            cursor="hand2",
        ).pack(side="left")

        self.voter_error = tk.Label(f, text="", bg="#f8f9fa", fg="#dc3545", font=("Segoe UI", 9))
        self.voter_error.pack()
        self.voter_status = tk.Label(f, text="", bg="#f8f9fa", fg="#198754", font=("Segoe UI", 9, "bold"))
        self.voter_status.pack()

        # ---- Ballot (Step 2 of 2) ----
        tk.Label(
            f,
            text="Step 2 of 2 — Select your candidate and press Cast Vote. You may vote only once.",
            font=("Segoe UI", 11),
            bg="#f8f9fa",
            fg="#495057",
        ).pack(pady=(14, 2))

        # Cast vote button (created before redraw so redraw can configure it)
        self.btn_cast_vote = tk.Button(
            f,
            text="Cast Vote",
            command=self.cast_vote,
            width=24,
            height=2,
            font=("Segoe UI", 13, "bold"),
            bg="#198754",
            fg="white",
            activebackground="#157347",
            cursor="hand2",
            state="disabled",
        )
        self.btn_cast_vote.pack(pady=25)

        # Candidate buttons container
        self.candidate_btn_frame = tk.Frame(f, bg="#f8f9fa")
        self.candidate_btn_frame.pack(pady=10)

        self.candidate_buttons = {}
        self.redraw_candidate_buttons()

        # Officer action buttons
        off_frame = tk.Frame(f, bg="#f8f9fa")
        off_frame.pack(pady=20)

        tk.Button(
            off_frame,
            text="Lock Machine (Officer)",
            command=lambda: self._confirm_officer_action(
                "Lock the machine now? Voting will be sealed until the officer re-arms it.",
                lambda: self.set_state(LOCKED, actor="OFFICER")),
            width=24,
            height=2,
            font=("Segoe UI", 11),
            bg="#fd7e14",
            fg="white",
            activebackground="#e8670c",
            cursor="hand2",
        ).pack(side="left", padx=8)

        tk.Button(
            off_frame,
            text="Return to Idle (Officer)",
            command=lambda: self._confirm_officer_action(
                "Return the machine to IDLE? Any in-progress session will be disarmed.",
                lambda: self.set_state(IDLE, actor="OFFICER")),
            width=24,
            height=2,
            font=("Segoe UI", 11),
            bg="#6c757d",
            fg="white",
            activebackground="#5a6268",
            cursor="hand2",
        ).pack(side="left", padx=8)

        tk.Button(
            off_frame,
            text="Change PIN (Officer)",
            command=self.change_pin,
            width=24,
            height=2,
            font=("Segoe UI", 11),
            bg="#0d6efd",
            fg="white",
            activebackground="#0b5ed7",
            cursor="hand2",
        ).pack(side="left", padx=8)

        tk.Button(
            tk.Frame(f),
            text="Upload Document (Officer)",
            command=self.upload_document,
            width=24,
            height=2,
            font=("Segoe UI", 11),
            bg="#198754",
            fg="white",
            activebackground="#157347",
            cursor="hand2",
        ).pack(pady=(0, 14))

    def redraw_candidate_buttons(self) -> None:
        """Render candidate selection buttons."""
        for widget in self.candidate_btn_frame.winfo_children():
            widget.destroy()
        self.candidate_buttons = {}

        # Two columns for readability; each row carries its party colour swatch
        items = list(self.candidates.items())
        for idx, (cid, info) in enumerate(items):
            row = idx // 2
            col = idx % 2
            color = info.get("color", "#6C757D")
            text = f"{info['name']}"
            cell = tk.Frame(self.candidate_btn_frame, bg="#f8f9fa")
            swatch = tk.Canvas(cell, width=34, height=44,
                               bg="#f8f9fa", highlightthickness=0, bd=0)
            swatch.create_rectangle(2, 2, 32, 42, fill=color, outline="#212529")
            swatch.create_text(17, 22, text=cid, fill="white", font=("Segoe UI", 10, "bold"))
            btn = tk.Button(
                cell,
                text=text,
                command=lambda c=cid: self.select_candidate(c),
                width=38,
                height=2,
                font=("Segoe UI", 10),
                bg="white",
                fg="#212529",
                activebackground="#e9ecef",
                relief="raised",
                bd=1,
                cursor="hand2",
                anchor="w",
            )
            swatch.grid(row=0, column=0, sticky="w")
            btn.grid(row=0, column=1, sticky="w")
            cell.grid(row=row, column=col, padx=8, pady=6, sticky="w")
            self.candidate_buttons[cid] = btn

        # Initially disabled unless READY and not voted
        enabled = (self.current_state == READY and not self.voter_has_voted
                   and self.current_voter_id)
        state = "normal" if enabled else "disabled"
        for btn in self.candidate_buttons.values():
            btn.config(state=state)
        self.btn_cast_vote.config(state="normal" if enabled else "disabled")

    def select_candidate(self, candidate_id: str) -> None:
        """Highlight the selected candidate."""
        self.selected_candidate = candidate_id
        # Reset all button reliefs
        for cid, btn in self.candidate_buttons.items():
            btn.config(relief="raised", bg="white")
        # Highlight selected
        self.candidate_buttons[candidate_id].config(relief="sunken", bg="#e7f1ff")
        play_sound("transition")

    def cast_vote(self) -> None:
        """
        Cast the vote for the selected candidate.
        Enforces single-vote lockout and immediate button disabling.
        """
        if self.current_state != READY:
            play_sound("error")
            messagebox.showwarning("Not Ready", "Voting is not open at this time.")
            return

        if self.voter_has_voted:
            play_sound("error")
            messagebox.showwarning("Already Voted", "You have already cast your vote in this session.")
            return

        if not self.current_voter_id:
            play_sound("error")
            messagebox.showwarning("Voter ID Required", "Verify the voter ID first to open the ballot.")
            return

        if not hasattr(self, "selected_candidate") or not self.selected_candidate:
            play_sound("error")
            messagebox.showwarning("No Selection", "Please select a candidate before casting your vote.")
            return

        cid = str(self.selected_candidate)
        if cid not in self.candidates:
            play_sound("error")
            return

        # Final confirmation before the ballot is cast (irreversible)
        name = self.candidates[cid]["name"]
        confirmed = messagebox.askyesno(
            "Confirm Your Vote",
            f"You selected:\n\n{name}\n\nThis choice is final and cannot be changed. Cast this vote?",
            icon=messagebox.QUESTION,
        )
        if not confirmed:
            return

        # Increment tally (candidate ID validated against roster)
        self.candidates[cid]["votes"] = int(self.candidates[cid]["votes"]) + 1
        self.total_voters = int(self.total_voters) + 1
        self.voter_has_voted = True

        # Mark this voter ID as spent — persist with the ballot (never the raw ID)
        if self.current_voter_id:
            self.used_voter_id_hashes.add(self._voter_id_hash(self.current_voter_id))
            self.current_voter_id = None

        # Persist immediately (atomic write)
        self.save_data()

        # Audit
        self.append_audit(
            event="VOTE_CAST",
            actor="VOTER",
            detail=f"Candidate {cid} ({self.candidates[cid]['name']})",
        )

        # Visual + auditory feedback
        play_sound("success")
        self.candidate_buttons[cid].config(bg="#d1e7dd", fg="#0f5132", relief="sunken")

        # Disable ALL voting buttons immediately (single-vote lockout)
        for btn in self.candidate_buttons.values():
            btn.config(state="disabled")
        self.btn_cast_vote.config(state="disabled")

        # Transition to VOTED
        self.set_state(VOTED, actor="VOTER")

    # ------------------------------------------------------------------
    # Voter ID authentication (one ID per ballot, hashed at rest)
    # ------------------------------------------------------------------
    @staticmethod
    def _voter_id_hash(voter_id: str) -> str:
        return hashlib.sha256(b"DVM-VOTER\x00" + voter_id.encode("utf-8")).hexdigest()

    def verify_voter_id(self) -> None:
        """Validate the EPIC/voter ID, reject duplicates, open the ballot."""
        raw = self.voter_id_entry.get().strip().upper()
        self.voter_error.config(text="")
        if not self.VOTER_ID_RE.match(raw):
            self.voter_error.config(text="Invalid voter ID — 6-12 letters, digits or hyphens.")
            play_sound("error")
            self.append_audit(event="VOTER_ID_REJECTED", actor="VOTER", detail="Format failed validation")
            return
        h = self._voter_id_hash(raw)
        if h in self.used_voter_id_hashes:
            self.voter_error.config(text="This voter ID has already been used to vote.")
            play_sound("error")
            self.append_audit(event="VOTER_ID_DUPLICATE", actor="VOTER", detail="Repeat ID presented")
            return
        self.current_voter_id = raw
        self.voter_status.config(text="BALLOT OPEN — WELCOME, VOTER")
        self.append_audit(event="VOTER_ID_VERIFIED", actor="VOTER", detail=f"Hash {h[:12]}…")
        play_sound("success")
        self.redraw_candidate_buttons()

    def _reset_voter_panel(self) -> None:
        if hasattr(self, "voter_id_entry"):
            self.voter_id_entry.delete(0, tk.END)
            self.voter_error.config(text="")
            self.voter_status.config(text="")

    # ------------------------------------------------------------------
    # Officer confirmations + keyboard shortcuts
    # ------------------------------------------------------------------
    def _confirm_officer_action(self, question: str, action: Callable[[], None]) -> None:
        """Ask the officer to confirm a destructive/sealed action before running it."""
        if messagebox.askyesno("Officer Confirmation", question, icon=messagebox.QUESTION):
            action()

    def _keyboard_select(self, cid: str) -> None:
        """Number-key shortcut for candidate selection (READY state only)."""
        if self.current_state == READY and not self.voter_has_voted and self.current_voter_id:
            self.select_candidate(cid)

    # ------------------------------------------------------------------
    # Officer PIN change (re-arm uses existing PIN as credential)
    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    # Officer document upload (copies into uploaded_documents/)
    # ------------------------------------------------------------------
    def upload_document(self) -> None:
        """Let the officer attach a document (resolution, roster, manifest…).

        The file is copied into ./uploaded_documents/ with a timestamped
        name; details are logged to the audit chain and (if online) the
        MySQL dvm_documents ledger. Works for PDFs, images and text files.
        """
        from tkinter import filedialog

        source = filedialog.askopenfilename(
            title="Select document to upload",
            filetypes=[
                ("Documents", "*.pdf *.doc *.docx *.txt *.md *.csv *.json"),
                ("Images", "*.png *.jpg *.jpeg *.webp *.gif *.bmp"),
                ("All files", "*.*"),
            ],
        )
        if not source:
            return

        upload_dir = os.path.join(os.path.dirname(os.path.abspath(self.DATA_FILE)),
                                  "uploaded_documents")
        os.makedirs(upload_dir, exist_ok=True)
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", os.path.basename(source))
        destination = os.path.join(upload_dir, f"{timestamp}_{safe_name}")

        try:
            import shutil
            shutil.copy2(source, destination)
            size_bytes = os.path.getsize(destination)
        except OSError as e:
            messagebox.showerror("Upload Failed", f"Could not copy the file:\n{e}")
            self.append_audit(event="DOCUMENT_UPLOAD_FAILED", actor="OFFICER", detail=str(e))
            return

        self.append_audit(event="DOCUMENT_UPLOADED", actor="OFFICER",
                          detail=f"{os.path.basename(destination)} ({size_bytes} bytes)")
        if _HAS_DB and self.__dict__.get("db_available"):
            try:
                _DB.insert_document(os.path.basename(destination),
                                    kind=os.path.splitext(source)[1].lstrip('.').lower() or 'document',
                                    uploaded_by='OFFICER',
                                    size=size_bytes)
            except Exception as e:
                print(f"[DVM-DB] document ledger insert failed (non-fatal): {e}", file=sys.stderr)

        messagebox.showinfo("Upload Complete",
                            f"Document saved:\n{os.path.basename(destination)}\n\n"
                            f"Stored in uploaded_documents/ and recorded in the audit log.")
        play_sound("success")

    def change_pin(self) -> None:
        """Change the officer PIN after re-authenticating with the current one."""
        current = simpledialog.askstring("Change PIN", "Current officer PIN:",
                                         show="*", parent=self.root)
        if current is None:
            return
        if current != self.admin_pin:
            play_sound("error")
            messagebox.showerror("Incorrect PIN", "Current PIN is incorrect.")
            self.append_audit(event="PIN_CHANGE_FAILED", actor="OFFICER", detail="Current PIN mismatch")
            return
        new_pin = simpledialog.askstring("Change PIN", "New PIN (4-8 digits):",
                                         show="*", parent=self.root)
        if new_pin is None:
            return
        if not new_pin.isdigit() or not (4 <= len(new_pin) <= 8):
            messagebox.showerror("Invalid PIN", "PIN must be 4-8 digits.")
            return
        confirm = simpledialog.askstring("Change PIN", "Confirm new PIN:",
                                         show="*", parent=self.root)
        if confirm != new_pin:
            messagebox.showerror("PIN mismatch", "Entries do not match.")
            return
        self.admin_pin = new_pin
        self.save_data()
        self.append_audit(event="PIN_CHANGE_SUCCESS", actor="OFFICER", detail="PIN changed and persisted")
        messagebox.showinfo("PIN Changed", "Officer PIN updated successfully.")

    # ------------------------------------------------------------------
    # Officer session timeout (inactivity auto-lock to IDLE)
    # ------------------------------------------------------------------
    def _start_officer_timer(self) -> None:
        if self.officer_timer is not None:
            self.root.after_cancel(self.officer_timer)
        self.officer_timer = self.root.after(self.SESSION_TIMEOUT_MS, self._officer_timeout)
        self.root.bind("<Button-1>", self._reset_officer_timer, add="+")
        self.root.bind("<KeyPress>", self._reset_officer_timer, add="+")
        # Candidate shortcut keys: 1-4 select candidates in READY state
        # (ignored while typing inside an Entry widget — e.g. voter ID / PIN)
        for cid in ("1", "2", "3", "4"):
            self.root.bind(cid, lambda e, c=cid: None if isinstance(e.widget, tk.Entry) else self._keyboard_select(c))

    def _reset_officer_timer(self, _event=None) -> None:
        if self.authenticated_officer:
            if self.officer_timer is not None:
                self.root.after_cancel(self.officer_timer)
            self.officer_timer = self.root.after(self.SESSION_TIMEOUT_MS, self._officer_timeout)

    def _officer_timeout(self) -> None:
        if self.authenticated_officer:
            self.authenticated_officer = False
            self.officer_timer = None
            self.append_audit(event="OFFICER_SESSION_TIMEOUT", actor="SYSTEM",
                              detail="Officer session locked after 5 minutes of inactivity")
            self.set_state(IDLE, actor="OFFICER")
            messagebox.showinfo("Session Locked", "Officer session locked after inactivity.")

    # ------------------------------------------------------------------
    # PIN lockout persistence + 30s cooldown
    # ------------------------------------------------------------------
    def _lockout_remaining(self) -> int:
        remaining = int(self.pin_lockout_until - time.time())
        return max(0, remaining)

    def _schedule_lockout_end(self) -> None:
        if self._lockout_remaining() > 0:
            self.root.after(self._lockout_remaining() * 1000 + 250, self._end_lockout)

    def _end_lockout(self) -> None:
        self.pin_lockout_until = 0.0
        self.failed_pin_attempts = 0
        self.save_data()
        if hasattr(self, "pin_entry"):
            self.pin_entry.config(state="normal")
            self.login_error.config(text="Lockout over — you may try again.")

    # ------------------------- VOTED -------------------------
    def _build_voted_frame(self) -> None:
        f = self.frames[VOTED]

        tk.Label(
            f,
            text="Vote Cast Successfully",
            font=("Segoe UI", 20, "bold"),
            bg="#f8f9fa",
            fg="#198754",
        ).pack(pady=(80, 20))

        self.voted_confirm_label = tk.Label(
            f,
            text="",
            font=("Segoe UI", 13),
            bg="#f8f9fa",
            fg="#212529",
        )
        self.voted_confirm_label.pack(pady=10)

        tk.Label(
            f,
            text="Your vote has been recorded. Voting buttons are locked.",
            font=("Segoe UI", 11),
            bg="#f8f9fa",
            fg="#495057",
        ).pack(pady=10)

        tk.Label(
            f,
            text="Awaiting officer action...",
            font=("Segoe UI", 11, "italic"),
            bg="#f8f9fa",
            fg="#6c757d",
        ).pack(pady=(20, 40))

        btn_frame = tk.Frame(f, bg="#f8f9fa")
        btn_frame.pack()

        tk.Button(
            btn_frame,
            text="Reset for Next Voter (Officer)",
            command=lambda: self._confirm_officer_action(
                "Re-arm the ballot for the next voter?",
                lambda: self.set_state(READY, actor="OFFICER")),
            width=30,
            height=2,
            font=("Segoe UI", 11),
            bg="#0d6efd",
            fg="white",
            activebackground="#0b5ed7",
            cursor="hand2",
        ).pack(side="left", padx=8)

        tk.Button(
            btn_frame,
            text="Lock Machine (Officer)",
            command=lambda: self._confirm_officer_action(
                "Lock the machine now? Voting will be sealed until the officer re-arms it.",
                lambda: self.set_state(LOCKED, actor="OFFICER")),
            width=22,
            height=2,
            font=("Segoe UI", 11),
            bg="#fd7e14",
            fg="white",
            activebackground="#e8670c",
            cursor="hand2",
        ).pack(side="left", padx=8)

    def refresh_voted_frame(self) -> None:
        """Update the voted confirmation text."""
        if hasattr(self, "selected_candidate"):
            info = self.candidates.get(self.selected_candidate, {})
            self.voted_confirm_label.config(
                text=f"You voted for: {info.get('name', 'Unknown Candidate')}"
            )

    # ------------------------- LOCKED -------------------------
    def _build_locked_frame(self) -> None:
        f = self.frames[LOCKED]

        tk.Label(
            f,
            text="Session Locked",
            font=("Segoe UI", 20, "bold"),
            bg="#f8f9fa",
            fg="#fd7e14",
        ).pack(pady=(80, 20))

        tk.Label(
            f,
            text="No further votes will be accepted.",
            font=("Segoe UI", 12),
            bg="#f8f9fa",
            fg="#495057",
        ).pack(pady=10)

        btn_frame = tk.Frame(f, bg="#f8f9fa")
        btn_frame.pack(pady=40)

        tk.Button(
            btn_frame,
            text="Show Results (Officer)",
            command=self.open_results_login,
            width=26,
            height=2,
            font=("Segoe UI", 12, "bold"),
            bg="#6f42c1",
            fg="white",
            activebackground="#5a379f",
            cursor="hand2",
        ).pack(side="left", padx=8)

        tk.Button(
            btn_frame,
            text="Reset Machine (Officer)",
            command=self.confirm_full_reset,
            width=26,
            height=2,
            font=("Segoe UI", 11),
            bg="#dc3545",
            fg="white",
            activebackground="#bb2d3b",
            cursor="hand2",
        ).pack(side="left", padx=8)

    def open_results_login(self) -> None:
        """Re-authenticate officer before revealing results."""
        if not self.authenticated_officer:
            self.authenticated_officer = False
            self.frames["LOGIN"].tkraise()
            self.pin_entry.delete(0, tk.END)
            self.login_error.config(text="Officer authentication required to view results.")
            return
        self.set_state(RESULT, actor="OFFICER")

    def confirm_full_reset(self) -> None:
        """Confirm full machine reset (clears votes)."""
        if not self.authenticated_officer:
            messagebox.showwarning("Authentication Required", "Officer PIN required.")
            self.frames["LOGIN"].tkraise()
            return
        confirmed = messagebox.askyesno(
            "Confirm Reset",
            "This will clear ALL vote totals and return the machine to IDLE. Continue?",
        )
        if confirmed:
            self.reset_machine()

    # ------------------------- RESULT -------------------------
    def _build_result_frame(self) -> None:
        f = self.frames[RESULT]

        tk.Label(
            f,
            text="Election Results",
            font=("Segoe UI", 22, "bold"),
            bg="#f8f9fa",
            fg="#6f42c1",
        ).pack(pady=(30, 10))

        # Scrollable tally table
        table_frame = tk.Frame(f, bg="white", relief="solid", bd=1)
        table_frame.pack(pady=10, padx=40, fill="both", expand=True)

        headers = ["Candidate", "Votes", "% of Total"]
        for col, h in enumerate(headers):
            tk.Label(
                table_frame,
                text=h,
                font=("Segoe UI", 11, "bold"),
                bg="#e9ecef",
                fg="#212529",
                width=30,
                relief="ridge",
            ).grid(row=0, column=col, sticky="nsew")

        self.result_rows = {}
        for r, (cid, info) in enumerate(self.candidates.items(), start=1):
            tk.Label(
                table_frame,
                text=info["name"],
                font=("Segoe UI", 10),
                bg="white",
                fg="#212529",
                width=30,
                relief="groove",
                anchor="w",
            ).grid(row=r, column=0, sticky="nsew")
            votes_lbl = tk.Label(
                table_frame,
                text=str(info["votes"]),
                font=("Segoe UI", 10, "bold"),
                bg="white",
                fg="#212529",
                width=30,
                relief="groove",
            )
            votes_lbl.grid(row=r, column=1, sticky="nsew")
            pct_lbl = tk.Label(
                table_frame,
                text="0.0%",
                font=("Segoe UI", 10),
                bg="white",
                fg="#212529",
                width=30,
                relief="groove",
            )
            pct_lbl.grid(row=r, column=2, sticky="nsew")
            self.result_rows[cid] = (votes_lbl, pct_lbl)

        table_frame.grid_columnconfigure(0, weight=1)
        table_frame.grid_columnconfigure(1, weight=1)
        table_frame.grid_columnconfigure(2, weight=1)

        self.total_voters_label = tk.Label(
            f,
            text="Total Voters: 0",
            font=("Segoe UI", 12, "bold"),
            bg="#f8f9fa",
            fg="#212529",
        )
        self.total_voters_label.pack(pady=(15, 5))

        tk.Button(
            f,
            text="Return to Idle (Officer)",
            command=lambda: self._confirm_officer_action(
                "Return the machine to IDLE? The results screen will close.",
                lambda: self.set_state(IDLE, actor="OFFICER")),
            width=26,
            height=2,
            font=("Segoe UI", 11),
            bg="#6c757d",
            fg="white",
            activebackground="#5a6268",
            cursor="hand2",
        ).pack(pady=25)

    def refresh_result_frame(self) -> None:
        """Populate the results table with current tallies."""
        total = self.total_voters if self.total_voters > 0 else 1
        for cid, (votes_lbl, pct_lbl) in self.result_rows.items():
            votes = self.candidates[cid]["votes"]
            pct = (votes / total) * 100
            votes_lbl.config(text=str(votes))
            pct_lbl.config(text=f"{pct:.1f}%")
        self.total_voters_label.config(text=f"Total Voters: {self.total_voters}")

    # ------------------------------------------------------------------
    # UI Refresh & Utilities
    # ------------------------------------------------------------------
    def refresh_ui(self) -> None:
        """Raise the frame for the current state and refresh its content."""
        # Raise the correct frame
        self.frames[self.current_state].tkraise()

        # Special refresh per state
        if self.current_state == READY:
            self.redraw_candidate_buttons()
            self.btn_cast_vote.config(
                state="normal" if (not self.voter_has_voted) else "disabled"
            )
        elif self.current_state == VOTED:
            self.refresh_voted_frame()
        elif self.current_state == RESULT:
            self.refresh_result_frame()

        # Update status bar
        state_label = STATE_LABELS.get(self.current_state, self.current_state)
        self.status_bar.config(text=f"State: {state_label}  |  Total Votes Cast: {self.total_voters}")

        # Update state indicator pill
        colour = STATE_COLOURS.get(self.current_state, "#adb5bd")
        self.state_indicator.config(text=state_label, bg=colour)

    def reset_machine(self) -> None:
        """Full reset: clear votes, tally, and return to IDLE."""
        self.candidates = {k: {"name": v["name"], "votes": 0} for k, v in self.DEFAULT_CANDIDATES.items()}
        self.total_voters = 0
        self.voter_has_voted = False
        self.authenticated_officer = False
        self.session_locked = False
        self.failed_pin_attempts = 0
        self.save_data()
        self.append_audit(event="MACHINE_RESET", actor="OFFICER", detail="All tallies cleared")
        play_sound("lock")
        self.set_state(IDLE, actor="OFFICER")

    def on_close(self) -> None:
        """Graceful shutdown: persist data before exit."""
        self.save_data()
        self.root.destroy()


# ---------------------------------------------------------------------------
# Application Entry Point
# ---------------------------------------------------------------------------
def main() -> None:
    root = tk.Tk()
    app = DigitalVotingMachine(root)
    root.mainloop()


if __name__ == "__main__":
    main()
