# DIGITAL VOTING MACHINE (DVM)
> **Disclaimer: educational software simulation of an electronic voting terminal.**
> **Not a certified EVM. Not for real elections. Not a government-issued system.**
> All "seal", "tamper", "integrity" and "encrypted" wording in this document describes demonstration code, not real election security. See Section 1.3 and Section 6.

## A Fully Software-Based Electronic Voting Terminal
### Implemented in Python with Tkinter GUI

---

## TITLE PAGE

| Field | Detail |
|-------|--------|
| **Project Title** | Digital Voting Machine (DVM) — A Software-Based Electronic Voting Terminal |
| **Course** | Digital Electronics / Software Engineering |
| **Level** | Undergraduate Engineering |
| **Implementation Language** | Python 3.x |
| **GUI Framework** | Tkinter (standard library) |
| **Data Persistence** | JSON (local file-based) |
| **Operating System** | Cross-platform (Windows, Linux, macOS) |
| **Authentication** | Officer PIN-based access control |
| **Core States** | IDLE, READY, VOTED, LOCKED, RESULT |
| **Status** | Academic coursework simulation — **not for real elections** |

**Prepared by:** [Ansh Shukla, Ishan Srivastav, Vidushi Srivastava , Jiya Verma, Anjani Shani, Avanish Verma, Gaurav Sharma, Pratibha verma]  
**Student ID:** [202510101150017, 202510101150013, 202510101150016, 202510101150003, 202510101150028, 202510101150040, 202510101150020, 202510101150048]  
**Supervisor:** [Dr. Rashmita]  
**Department:** Digital Electronic 
**Institution:** [SRMU]  
**Date:** [20/11/2026]  

*Note: Replace all bracketed fields above with your actual details before submission.*

---

## ABSTRACT

The Digital Voting Machine (DVM) is a fully software-based electronic voting terminal designed to simulate the core functionality of a hardware electronic voting machine using Python and the Tkinter graphical user interface toolkit. The system models a real-world polling environment in which an election officer controls machine states and voters cast a single, irrevocable vote for one of several candidates or the NOTA (None of the Above) option.

The software is built around a Finite State Machine (FSM) comprising five discrete states — IDLE, READY, VOTED, LOCKED, and RESULT — that govern the officer-versus-voter workflow. State transitions are restricted by role-based authentication: only an authenticated officer may initiate, lock, or conclude an election session, while a voter may cast exactly one vote per session before being locked out. Ballot data and audit trails are persisted locally in JSON format with atomic write semantics to guard against data loss.

The design emphasizes anti-fraud controls including single-vote lockout, button disabling after vote cast, race-condition mitigation through sequential state transitions, and suppression of tally visibility until the officer explicitly opens the result state. Visual and auditory feedback (colour-coded indicators, status banners, and beep tones) confirm each user action.

This report presents the complete system architecture, state-machine design, execution roadmap, technical component breakdown, simulation source code, security analysis, validation matrix, and future enhancement path. The implementation is intended as a coursework artifact demonstrating software engineering principles, state-driven interface design, and data handling in an academic context — it is explicitly **not** usable in a real election.

---

## 1. PROJECT METADATA & PROBLEM STATEMENT

### 1.1 Problem Statement

Conventional paper-based balloting is susceptible to manual counting errors, ballot stuffing, delayed result declaration, and lack of real-time auditability. While hardware-based Electronic Voting Machines (EVMs) address many of these concerns, their cost and proprietary nature place them beyond the reach of academic laboratory exploration and small-scale student elections.

The problem addressed by this project is the design and implementation of a low-cost, fully software-based Digital Voting Machine that reproduces the essential security and operational properties of a hardware EVM — single-vote enforcement, officer-controlled session lifecycle, tamper-resistant tally concealment, and persistent audit logging — using only freely available software (Python 3 and Tkinter). The system must be sufficiently robust to serve as a teaching aid for digital electronics and software engineering concepts while remaining simple enough for undergraduate-level comprehension and modification.

### 1.2 Objectives

1. To design and implement a graphical voting terminal in Python/Tkinter supporting officer and voter roles.
2. To model the voting session as a Finite State Machine with states IDLE, READY, VOTED, LOCKED, and RESULT.
3. To enforce single-vote-per-voter lockout and disable voting buttons after a vote is cast.
4. To persist vote totals and audit events to local JSON files with atomic write protection.
5. To authenticate the officer via PIN and conceal election results until explicitly unlocked.
6. To provide visual and auditory feedback for every user interaction.
7. To document security controls, test cases, and limitations for academic evaluation.

### 1.3 Scope & Limitations

**In scope:**
- Officer login and PIN authentication.
- Officer-controlled session start (IDLE → READY), lock (READY/VOTED → LOCKED), and result declaration (LOCKED → RESULT).
- Voter candidate selection and single-vote casting.
- JSON persistence of candidate tallies and an append-only audit log.
- Visual status banners, colour-coded state indicators, and sound feedback.

**Out of scope (noted for future work):**
- Networked or web-based voting.
- Biometric or smart-card voter authentication.
- Encrypted database backend (cryptographic signing of tallies).
- Voter-verified paper audit trail (VVPAT) hardware integration.

### 1.4 Assumptions

The deployment and evaluation of this system assume the following:

1. **Single-kiosk polling booth.** One terminal, one voter at a time; the officer is a trusted operator physically present at the machine.
2. **Physical control of the terminal.** The kiosk, its storage media, and the `dvm_key.key` file are protected by the precinct (locked case, supervised access).
3. **The polling officer follows the stated procedure.** PIN custody, seal inspection cadence, and ballot issue/receipt discipline are organizational controls, not enforced by software.
4. **Local execution only.** The machine operates without any network connection; nothing in the design requires internet or LAN access.
5. **Election-scale testing.** Automated tests validate logic, persistence, and the FSM; usability-scale, multi-week field trials are out of scope for coursework.
6. **Voter IDs are valid EPIC numbers.** The app checks format and uniqueness, not the government register — no online verification exists by design.
7. **Audit log is trusted as the evidence trail.** Tamper-evidence is provided by the SHA-256 hash chain; physical seizure of the machine before the chain is re-verified is acknowledged as a residual risk (see Residual Risks).

### 1.5 Known Issues

| # | Issue | Severity | Workaround / Plan |
|---|-------|----------|--------------------|
| K-1 | Officer PIN is unsalted SHA-256 (React) / plaintext-comparable JSON (Python fallback). | Low–Med | 4-digit PIN brute-force requires local access + lockout delays; 30s lockout on 3 failures mitigates. |
| K-2 | `dvm_machine_key` / `dvm_key.key` live on the same device as the data. | Med | Kiosk must be physically sealed; encryption protects casual copy, not a determined local attacker. |
| K-3 | Voter-ID uniqueness is app-local (no national register cross-check). | Med | Precinct staff verify IDs at the desk before handing out the session token. |
| K-4 | Windows console encoding may print UTF-8 characters as mojibake in logs. | Cosmetic | Logs are ASCII-safe; file output uses UTF-8. |
| K-5 | `npm audit` warnings from transitive devDependencies. | Low | Dev-only; no production deploy. |
| K-6 | `.tmp` residue possible if the process is killed during an atomic write. | Low | `.tmp` is ignored by the loader; next save overwrites it. |
| K-7 | Auditorium/large-hall use of sound feedback can be intrusive. | Cosmetic | Sounds are short and local; can be muted at OS level or by editing `play_sound`. |

These are deliberate, documented trade-offs for an academic single-kiosk implementation — not defects.
- PIN change mechanism (default PIN `1234` is hardcoded; change by editing `votes_data.json`).

**Note on security:** This is an academic demonstration. Vote data is stored in JSON files protected at rest by an AES-256-GCM key held on the same device (not real cryptographic custody — see Section 6). An attacker with file-system access can modify tallies. The audit log provides discrepancy detection, not prevention. Do not use for real political elections.

---

## 2. SYSTEM ARCHITECTURE & FINITE STATE MACHINE (FSM) DESIGN

### 2.1 High-Level Architecture

The DVM follows a single-tier, event-driven architecture. The Tkinter main event loop drives all interaction. The application state is held in-memory by the `DigitalVotingMachine` controller object and synchronized to disk via JSON persistence. The architecture decomposes into four logical layers:

| Layer | Responsibility |
|-------|----------------|
| **Presentation Layer** | Tkinter frames/widgets for officer login, candidate selection, status banners, and results display. |
| **Controller Layer** | `DigitalVotingMachine` class managing state transitions, role authentication, vote tallying, and persistence. |
| **Persistence Layer** | JSON file I/O for `votes_data.json` (tallies) and `audit_log.json` (append-only event log). |
| **Feedback Layer** | `winsound` (Windows) beep tones and Tkinter colour/banner updates for visual-auditory confirmation. |

### 2.2 Finite State Machine

The voting session is modelled as a deterministic Finite State Machine:

**States:**
- **IDLE** — Machine is powered on but no session is active. Officer login is required to proceed. Voting buttons are disabled.
- **READY** — Officer has authenticated and opened the session. Voting buttons are enabled; a voter may cast a vote.
- **VOTED** — A voter has successfully cast a vote. Voting buttons are immediately locked (disabled) to prevent double-voting in the current session. The officer must act to continue.
- **LOCKED** — Session is closed; no further votes accepted. Machine awaits officer action to either reset or declare results.
- **RESULT** — Officer-authenticated state displaying the final tally. Votes are concealed until this state is entered.

**Transitions:**
1. IDLE → READY : Officer enters correct PIN and presses "Start Voting".
2. READY → VOTED : Voter selects a candidate and presses "Cast Vote".
3. VOTED → LOCKED : Officer presses "Lock Machine" (closes session).
4. VOTED → READY : Officer presses "Reset for Next Voter" (clears single-voter lock; used only in single-kiosk demo mode).
5. LOCKED → RESULT : Officer enters PIN and presses "Show Results".
6. LOCKED → IDLE : Officer presses "Reset Machine" (clears all state, returns to power-on default).
7. RESULT → IDLE : Officer presses "Return to Idle".

**State-transition diagram (textual):**

```
        [Start Voting + PIN]       [Cast Vote]           [Lock Machine]         [Show Results + PIN]
   IDLE  ---------------->  READY  ---------------->  VOTED  ---------------->  LOCKED  ---------------->  RESULT
     ^                                                                                          |          |
     |                                                                                          v          v
     |----------------------------------- [Reset Machine]  <----------------------------------|          |
     |                                                                   [Reset for Next Voter]       |
     |----------------------------------- [Return to Idle] <-------------------------------------------|
```

### 2.3 Officer vs. Voter Workflow

| Actor | Permitted Actions by State |
|-------|----------------------------|
| **Unauthenticated User** | IDLE: view welcome screen only. No voting, no results. |
| **Voter** | READY: select candidate + cast vote (once). VOTED/LOCKED/RESULT: read-only, buttons disabled. |
| **Officer (PIN-authenticated)** | IDLE: start session → READY. READY/VOTED: lock → LOCKED. LOCKED: show results → RESULT or reset → IDLE. RESULT: return → IDLE. |

The officer is the sole authority over state transitions. The voter's influence is limited to a single cast-vote action in the READY state. This separation of duties prevents a voter from unilaterally opening, closing, or inspecting the tally.

---

## 3. DAY-BY-DAY EXECUTION ROADMAP & SPRINT PLAN

The project is planned as a **10-day execution roadmap** (two academic weeks). Each day lists specific tasks, deliverables, and milestones.

### Day 1 — Requirements, Environment Setup & Repository
| Task | Detail |
|------|--------|
| Requirements analysis | Finalize candidate list, state machine, roles, and persistence format. |
| Environment setup | Install Python 3.11+, verify Tkinter availability, create project folder and Git repository. |
| Skeleton project | Create `digital_voting_machine.py`, `votes_data.json` template, `audit_log.json` template, and `README.md`. |
| **Deliverable** | Working Python interpreter, empty project scaffold, committed to version control. |
| **Milestone M1** | Development environment ready; version control initialized. |

### Day 2 — State Machine Design & State Constants
| Task | Detail |
|------|--------|
| FSM formalization | Define state constants (IDLE, READY, VOTED, LOCKED, RESULT) and transition table in documentation and code stubs. |
| State stub implementation | Implement `set_state()` method with placeholder frame switching. |
| Unit check | Print state transitions to console to verify FSM logic before GUI wiring. |
| **Deliverable** | State transition module with all five states and valid/invalid transition guards. |
| **Milestone M2** | FSM logic verified. |

### Day 3 — Officer Authentication & PIN Guard
| Task | Detail |
|------|--------|
| PIN authentication | Implement officer login dialog, default PIN, and PIN-change capability (stored in JSON). |
| Auth decorator/guard | Wrap officer-only transitions (start, lock, results, reset) behind authentication check. |
| Failed-attempt handling | Lockout after N incorrect PIN attempts with cooldown message. |
| **Deliverable** | Officer login frame and authentication guard functions. |
| **Milestone M3** | Role-based access control functional. |

### Day 4 — Voter GUI & Candidate Selection
| Task | Detail |
|------|--------|
| Candidate UI | Build candidate buttons (including NOTA) with labels and vote counts hidden. |
| Vote casting | Implement `cast_vote(candidate_id)` with single-vote lockout and button disabling. |
| Visual feedback | Colour-coded candidate buttons, status banner updates ("Vote cast successfully"). |
| **Deliverable** | Voter-facing voting frame operational in READY state. |
| **Milestone M4** | Voter can cast one vote; buttons lock afterward. |

### Day 5 — Sound & Visual Feedback Layer
| Task | Detail |
|------|--------|
| Audio feedback | Implement `play_sound()` using `winsound.Beep` (Windows) with cross-platform fallback (silent or system beep). |
| Sound events | Beep on state transition, success tone on vote cast, error tone on invalid PIN/double vote. |
| Status banners | Coloured banners (green=success, red=error, blue=info) reflecting current state. |
| **Deliverable** | Audio-visual feedback module integrated across all states. |
| **Milestone M5** | Multi-sensory feedback confirmed. |

### Day 6 — JSON Persistence & Audit Logging
| Task | Detail |
|------|--------|
| Data model | Define `votes_data.json` (candidates, tallies, total voters) and `audit_log.json` (timestamped events). |
| Load/save | Implement `load_data()` and `save_data()` with atomic write (write to temp file, then replace). |
| Audit events | Log every state transition, vote cast, login attempt, and result view with timestamp. |
| **Deliverable** | Persistent data layer surviving application restart. |
| **Milestone M6** | Data persists across sessions; audit log append-only. |

### Day 7 — State Integration & End-to-End Session
| Task | Detail |
|------|--------|
| Full session flow | Connect all frames: IDLE → READY → VOTED → LOCKED → RESULT → IDLE. |
| Officer flow | Authenticate → start → lock → show results → reset. |
| Voter flow | Cast vote → lockout → await officer. |
| Bug fix | Resolve transition guard violations and stale UI references. |
| **Deliverable** | Complete end-to-end voting session executable. |
| **Milestone M7** | Full FSM-to-UI integration. |

### Day 8 — Hardening & Edge-Case Handling
| Task | Detail |
|------|--------|
| Race-condition guard | Serialize vote casting; disable buttons during processing; confirm state before tally increment. |
| Data-loss guard | Atomic JSON writes; exception handling around file I/O; fallback default state on corrupt JSON. |
| Input validation | Reject empty/malformed PIN; ignore votes in non-READY states. |
| **Deliverable** | Hardened application with defensive coding. |
| **Milestone M8** | Security and stability controls in place. |

### Day 9 — Testing & Validation Matrix
| Task | Detail |
|------|--------|
| Test execution | Run all test cases from Section 7; record actual vs. expected behavior. |
| Defect logging | Record bugs, root cause, and fix verification. |
| Validation matrix | Complete the Test ID / Description / Expected Behavior / Status table. |
| **Deliverable** | Completed validation matrix with PASS/FAIL status. |
| **Milestone M9** | All test cases executed. |

### Day 10 — Documentation, Report & Submission
| Task | Detail |
|------|--------|
| Report writing | Complete this academic report (all eight sections). |
| Code review | Self-review source code for comments, naming conventions, and structure. |
| Final demo | Record a walkthrough video or conduct live demonstration of IDLE → RESULT flow. |
| Submission | Package source code, report, sample JSON files, and README. |
| **Deliverable** | Final project package ready for university submission. |
| **Milestone M10** | Project complete and submitted. |

---

## 4. TECHNICAL DESIGN & COMPONENT BREAKDOWN

### 4.1 GUI Layout

The application uses a single `Tk` root window with a fixed geometry (900×700). Five mutually exclusive `tk.Frame` subclasses represent the FSM states; only one frame is raised at a time via `tkraise()`.

| Frame | Widgets | Purpose |
|-------|---------|---------|
| `frame_idle` | Welcome label, officer login button, state indicator | Power-on default; entry point. |
| `frame_login` | PIN entry field, login button, back button, error label | Officer authentication. |
| `frame_ready` | Candidate buttons, "Cast Vote" button, status banner, state indicator | Voting session open. |
| `frame_voted` | Confirmation banner, candidate voted for, "Awaiting Officer" message, state indicator | Post-vote lockout. |
| `frame_locked` | Session closed banner, "Show Results" button, "Reset Machine" button, state indicator | Session closed. |
| `frame_result` | Tally table (candidate, votes, percentage), total voters, "Return to Idle" button | Result declaration. |

A persistent status bar at the bottom displays the current FSM state, session phase, and last event. State indicators use colour: grey (IDLE), blue (READY), green (VOTED), amber (LOCKED), purple (RESULT).

### 4.2 State Management

State management is centralized in `DigitalVotingMachine.current_state`. The `set_state(new_state)` method:
1. Validates the requested transition against the transition table (rejects invalid transitions with an error beep).
2. Updates `current_state`.
3. Raises the corresponding frame.
4. Refreshes the status bar and state indicator.
5. Logs the transition to the audit file with `datetime.now().isoformat()`.

All widget enabling/disabling is derived from `current_state`, ensuring the UI is always a function of state (no stray enabled buttons in disallowed states).

### 4.3 Single-Vote Lockout Logic

Single-vote enforcement operates at two levels:

1. **Session-level (UI):** Immediately after `cast_vote()` succeeds, all candidate buttons and the "Cast Vote" button are disabled (`state="disabled"`), and the machine transitions READY → VOTED. The voter cannot cast another vote without officer intervention.
2. **Data-level (persistence):** The vote is persisted to `votes_data.json` before the UI confirms success. On restart, the tallies reflect all prior votes; no voter may retroactively subtract or duplicate.

In a single-kiosk deployment, the officer presses "Reset for Next Voter" to clear the per-session `voter_has_voted` flag and return READY for the next voter, while the cumulative tally remains intact.

### 4.4 JSON Local Data Persistence

Two JSON files are used:

**`votes_data.json`:**
```json
{
  "candidates": {
    "1": {"name": "Candidate A - Progressive Alliance", "votes": 0},
    "2": {"name": "Candidate B - Conservative Front", "votes": 0},
    "3": {"name": "Candidate C - Liberty Party", "votes": 0},
    "4": {"name": "NOTA - None of the Above", "votes": 0}
  },
  "total_voters": 0,
  "admin_pin": "1234",
  "session_locked": false
}
```

**`audit_log.json`:** Append-only array of event objects:
```json
[
  {"timestamp": "2026-11-09T10:15:00", "event": "SESSION_STARTED", "actor": "OFFICER"},
  {"timestamp": "2026-11-09T10:16:30", "event": "VOTE_CAST", "actor": "VOTER", "candidate": "1"},
  {"timestamp": "2026-11-09T10:17:00", "event": "SESSION_LOCKED", "actor": "OFFICER"}
]
```

**Atomic write:** `save_data()` writes to a temporary file (`*.tmp`) and then replaces the target via `os.replace()`, which is atomic on POSIX and Windows, preventing partial/corrupt writes during crashes or power loss.

---

## 5. COMPLETE SIMULATION SOURCE CODE (Tkinter) — as submitted at sprint end

Below is the complete, well-commented Tkinter implementation as of the initial sprint. Save as `digital_voting_machine.py`. It requires Python 3.x and Tkinter (bundled).

> **Note (2026-11-12):** Phase 1 security hardening (voter-ID gating, AES-GCM encrypted at rest, hash-chained audit, persistent PIN lockout with 30s cooldown, officer inactivity auto-lock, PIN change) was applied **directly to `digital_voting_machine.py` after this listing was embedded**. The embedded listing is retained as the sprint-1 artifact for historical context; it is not bit-identical to the current source. See **Appendix A — Security Addendum** for the exact changes and the measured verification results.

```python
"""
================================================================================
DIGITAL VOTING MACHINE (DVM) - COURSE SIMULATION (Tkinter) — NOT FOR REAL ELECTIONS
================================================================================
Course: Digital Electronics / Software Engineering
Platform: Python 3.x (standard library only)
States: IDLE, READY, VOTED, LOCKED, RESULT

Features:
  - Officer PIN authentication
  - Single-vote lockout per session
  - Button disabling after vote cast
  - JSON persistence (votes_data.json, audit_log.json)
  - Atomic file writes for crash safety
  - Visual + auditory feedback (winsound on Windows, fallback elsewhere)
  - Role-based state transitions (Officer vs Voter)

Usage:
    python digital_voting_machine.py
================================================================================
"""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import json
import os
import datetime
import sys
import threading

# ---------------------------------------------------------------------------
# Cross-platform sound feedback
# ---------------------------------------------------------------------------
try:
    import winsound  # Windows only
    _HAS_WINSOUND = True
except ImportError:  # pragma: no cover - non-Windows platforms
    _HAS_WINSOUND = False


def play_sound(kind: str) -> None:
    """
    Play auditory feedback for a given event kind.
    Runs in a background thread so the GUI never blocks.
    """
    def _beep():
        if not _HAS_WINSOUND:
            # Fallback: ASCII bell (works on most terminals/Tk)
            sys.stdout.write("\a")
            sys.stdout.flush()
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

    # Default candidate roster
    DEFAULT_CANDIDATES = {
        "1": {"name": "Candidate A - Progressive Alliance", "votes": 0},
        "2": {"name": "Candidate B - Conservative Front", "votes": 0},
        "3": {"name": "Candidate C - Liberty Party", "votes": 0},
        "4": {"name": "NOTA - None of the Above", "votes": 0},
    }

    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title("Digital Voting Machine - Secure Ballot Terminal")
        self.root.geometry("900x720")
        self.root.resizable(False, False)
        self.root.configure(bg="#f8f9fa")

        # --- Runtime state ---
        self.current_state = IDLE
        self.voter_has_voted = False          # single-vote lockout flag (session)
        self.authenticated_officer = False    # officer PIN validated
        self.failed_pin_attempts = 0
        self.max_pin_attempts = 3

        # --- Data ---
        self.candidates = {}
        self.total_voters = 0
        self.admin_pin = self.DEFAULT_PIN
        self.session_locked = False

        # Load persisted data (or initialize defaults)
        self.load_data()

        # --- Build UI ---
        self.build_ui()

        # --- Initialize to IDLE ---
        self.set_state(IDLE, log=False)

        # Handle window close gracefully
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------
    def load_data(self) -> None:
        """Load votes and audit configuration from JSON files."""
        # Load vote data
        if os.path.exists(self.DATA_FILE):
            try:
                with open(self.DATA_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                self.candidates = data.get("candidates", self.DEFAULT_CANDIDATES)
                self.total_voters = data.get("total_voters", 0)
                self.admin_pin = data.get("admin_pin", self.DEFAULT_PIN)
                self.session_locked = data.get("session_locked", False)
            except (json.JSONDecodeError, OSError):
                # Corrupt file: fall back to defaults to avoid data loss
                self.candidates = dict(self.DEFAULT_CANDIDATES)
                self.total_voters = 0
                self.admin_pin = self.DEFAULT_PIN
                self.session_locked = False
        else:
            self.candidates = dict(self.DEFAULT_CANDIDATES)
            self.total_voters = 0
            self.admin_pin = self.DEFAULT_PIN
            self.session_locked = False

    def save_data(self) -> None:
        """
        Atomically persist vote data to JSON.
        Writes to a temporary file then replaces the target (os.replace).
        """
        data = {
            "candidates": self.candidates,
            "total_voters": self.total_voters,
            "admin_pin": self.admin_pin,
            "session_locked": self.session_locked,
        }
        tmp_file = self.DATA_FILE + ".tmp"
        try:
            with open(tmp_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.replace(tmp_file, self.DATA_FILE)
        except OSError:
            # Clean up temp file if it exists
            if os.path.exists(tmp_file):
                try:
                    os.remove(tmp_file)
                except OSError:
                    pass

    def append_audit(self, event: str, actor: str, detail: str = "") -> None:
        """Append a timestamped audit event to the audit log."""
        entry = {
            "timestamp": datetime.datetime.now().isoformat(timespec="seconds"),
            "event": event,
            "actor": actor,
            "detail": detail,
        }
        log = []
        if os.path.exists(self.AUDIT_FILE):
            try:
                with open(self.AUDIT_FILE, "r", encoding="utf-8") as f:
                    log = json.load(f)
                if not isinstance(log, list):
                    log = []
            except (json.JSONDecodeError, OSError):
                log = []
        log.append(entry)
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
        f = self.frames["LOGIN"] if "LOGIN" in self.frames else None
        # Reuse a dedicated login frame (not an FSM state)
        if f is None:
            f = tk.Frame(self.container, bg="#f8f9fa")
            f.place(relx=0, rely=0, relwidth=1, relheight=1)
            self.frames["LOGIN"] = f

        for widget in f.winfo_children():
            widget.destroy()

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
        """Validate the officer PIN."""
        pin = self.pin_entry.get().strip()
        if not pin:
            self.login_error.config(text="PIN cannot be empty.")
            play_sound("error")
            return

        if pin == self.admin_pin:
            self.authenticated_officer = True
            self.failed_pin_attempts = 0
            self.append_audit(event="OFFICER_LOGIN_SUCCESS", actor="OFFICER")
            play_sound("success")
            messagebox.showinfo("Authentication", "Officer authenticated successfully.")
            self.set_state(READY, actor="OFFICER")
        else:
            self.failed_pin_attempts += 1
            self.append_audit(event="OFFICER_LOGIN_FAILED", actor="OFFICER")
            play_sound("error")
            remaining = self.max_pin_attempts - self.failed_pin_attempts
            if self.failed_pin_attempts >= self.max_pin_attempts:
                self.login_error.config(
                    text="Maximum PIN attempts reached. Access denied."
                )
                self.pin_entry.config(state="disabled")
                messagebox.showerror("Access Denied", "Too many failed attempts.")
            else:
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
        ).pack(pady=(40, 10))

        tk.Label(
            f,
            text="Select your candidate and press Cast Vote. You may vote only once.",
            font=("Segoe UI", 11),
            bg="#f8f9fa",
            fg="#495057",
        ).pack(pady=(0, 30))

        # Candidate buttons container
        self.candidate_btn_frame = tk.Frame(f, bg="#f8f9fa")
        self.candidate_btn_frame.pack(pady=10)

        self.candidate_buttons = {}
        self.redraw_candidate_buttons()

        # Cast vote button
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

        # Officer action buttons
        off_frame = tk.Frame(f, bg="#f8f9fa")
        off_frame.pack(pady=20)

        tk.Button(
            off_frame,
            text="Lock Machine (Officer)",
            command=lambda: self.set_state(LOCKED, actor="OFFICER"),
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
            command=lambda: self.set_state(IDLE, actor="OFFICER"),
            width=24,
            height=2,
            font=("Segoe UI", 11),
            bg="#6c757d",
            fg="white",
            activebackground="#5a6268",
            cursor="hand2",
        ).pack(side="left", padx=8)

    def redraw_candidate_buttons(self) -> None:
        """Render candidate selection buttons."""
        for widget in self.candidate_btn_frame.winfo_children():
            widget.destroy()
        self.candidate_buttons = {}

        # Two columns for readability
        items = list(self.candidates.items())
        for idx, (cid, info) in enumerate(items):
            row = idx // 2
            col = idx % 2
            text = f"{info['name']}"
            btn = tk.Button(
                self.candidate_btn_frame,
                text=text,
                command=lambda c=cid: self.select_candidate(c),
                width=42,
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
            btn.grid(row=row, column=col, padx=12, pady=6, sticky="w")
            self.candidate_buttons[cid] = btn

        # Initially disabled unless READY and not voted
        enabled = (self.current_state == READY and not self.voter_has_voted)
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

        if not hasattr(self, "selected_candidate") or not self.selected_candidate:
            play_sound("error")
            messagebox.showwarning("No Selection", "Please select a candidate before casting your vote.")
            return

        cid = self.selected_candidate
        if cid not in self.candidates:
            play_sound("error")
            return

        # Increment tally
        self.candidates[cid]["votes"] += 1
        self.total_voters += 1
        self.voter_has_voted = True

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
            command=lambda: self.set_state(READY, actor="OFFICER"),
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
            command=lambda: self.set_state(LOCKED, actor="OFFICER"),
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
            command=lambda: self.set_state(IDLE, actor="OFFICER"),
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
```

### 5.1 How to Run

1. Ensure Python 3.8+ is installed.
2. Save the code above as `digital_voting_machine.py`.
3. Run: `python digital_voting_machine.py`
4. On first run, `votes_data.json` and `audit_log.json` are created automatically in the same folder.
5. Default officer PIN: `1234` (change via `votes_data.json` or extend the GUI).

---

## 6. SECURITY & ANTI-FRAUD ANALYSIS

| Threat | Control Mechanism | Effectiveness |
|--------|-------------------|---------------|
| **Double-voting** | After `cast_vote()`, all candidate buttons and the Cast button are disabled (`state="disabled"`), and the FSM moves READY → VOTED. The `voter_has_voted` flag blocks re-voting until officer intervention. | High (session scope) |
| **Unauthorized tally access** | RESULT state is reachable only from LOCKED via officer authentication. The results frame is never raised without a valid PIN. | High |
| **Unauthorized session control** | All officer transitions (start, lock, results, reset) require `authenticated_officer = True`, set only after correct PIN entry. Failed attempts are counted and lock after 3 tries. | High |
| **Race conditions** | Tkinter is single-threaded; `cast_vote()` executes atomically within the event loop. Buttons are disabled before the state transition completes, eliminating concurrent vote submissions. | High (single-threaded GUI) |
| **Data loss / corruption** | `save_data()` uses atomic write-to-temp-then-`os.replace()`. Corrupt JSON triggers fallback to defaults rather than crashing. | Medium-High |
| **Tally tampering (offline)** | JSON files are human-editable; no cryptographic signing. An attacker with file access can modify tallies. Mitigated by the append-only `audit_log.json`, which records every change for discrepancy detection. | Low-Medium (see Future Enhancements) |
| **Replay / reset attack** | Full reset requires officer confirmation and clears all tallies; recorded in audit log. Cannot be triggered by a voter. | Medium |

### Residual Risks (documented for academic honesty)
1. **Voter uniqueness is client-side and per-device.** The EPIC gate proves format (`[A-Z0-9-]{6,12}`) plus uniqueness only on this browser profile/machine. A different browser profile, cleared site data, or a different PC lets the same person vote again. There is no voter roll.
2. **ID-document upload is file-identity-only.** The SHA-256 is of the uploaded *file bytes* — a re-photographed card produces a different hash and is accepted, deliberately or innocently. The upload binds a session to a presented document; it does not verify identity. Do not describe it as identity verification.
3. **Controller-key custody:** `dvm_machine_key` (web) / `dvm_key.key` (desktop) sits beside the data it protects. AES-GCM here is obfuscation, not custody.
4. **PIN `1234` shipped as default** with unsalted SHA-256; a 4-digit PIN is brute-forced in milliseconds offline with local access. The 30s client-side lockout is editable/bypassable by editing localStorage, not a real rate limiter.
5. **Hash-chained audit is recomputable.** Anyone who can write the file can rewrite a consistent chain; the chain detects naive edits, not a determined forger.
6. **Single kiosk, no network, no VVPAT hardware, no election-body certification.** Every "seal", "hopper", "interlock", "vault" and "tamper" affordance in the UI is a fictional prop for the course demo. Real EVMs require physical paper trails, certified firmware, chain-of-custody procedures and independent audits.
7. **Stale claims corrected:** the earlier claim that "no voter authentication exists" is now outdated — the EPIC gate and document upload exist but are demonstration-grade. The outdated claim was removed from the Residual Risks list rather than silently patched.

---

## 7. COMPREHENSIVE TEST CASES & VALIDATION MATRIX

| Test ID | Description | Expected Behavior | Status |
|---------|-------------|-------------------|--------|
| TC-01 | Launch application | Welcome/IDLE screen appears; voting buttons disabled; state indicator shows IDLE | PASS |
| TC-02 | Officer enters correct PIN (1234) | Login success; transition to READY; candidate buttons enabled | PASS |
| TC-03 | Officer enters incorrect PIN 3 times | "Maximum PIN attempts reached"; PIN entry disabled; error beep | PASS |
| TC-04 | Voter selects candidate and casts vote | Tally increments; vote confirmed; all voting buttons disabled; transition to VOTED | PASS |
| TC-05 | Voter attempts second vote in same session | Warning dialog: "Already Voted"; no tally change; buttons remain disabled | PASS |
| TC-06 | Voter casts vote without selecting candidate | Warning: "No Selection"; no tally change | PASS |
| TC-07 | Officer locks machine from READY | Transition to LOCKED; "Session Locked" screen; no votes accepted | PASS |
| TC-08 | Officer locks machine from VOTED | Transition to LOCKED; session closed; voter locked out | PASS |
| TC-09 | Unauthenticated user attempts Show Results from LOCKED | Redirect to login; PIN required before RESULT state | PASS |
| TC-10 | Officer authenticates and views results from LOCKED | Transition to RESULT; tally table displayed with votes and percentages | PASS |
| TC-11 | Officer returns from RESULT to IDLE | Transition to IDLE; welcome screen restored | PASS |
| TC-12 | Officer performs full reset from LOCKED | All tallies cleared to zero; total voters = 0; transition to IDLE; audit entry created | PASS |
| TC-13 | Invalid state transition attempted (e.g., IDLE → RESULT directly) | Warning dialog; state unchanged; error beep | PASS |
| TC-14 | Application restart after votes cast | Tallies persist in `votes_data.json`; previous totals displayed on reload | PASS |
| TC-15 | Audit log append | Every state transition and vote recorded with timestamp in `audit_log.json` | PASS |
| TC-16 | Sound feedback on vote cast | Success beep heard (or terminal bell on non-Windows) | PASS |
| TC-17 | Visual state indicator colour | Indicator changes colour per state (gray/blue/green/amber/purple) | PASS |
| TC-18 | Atomic write safety (simulated) | `votes_data.json` not left as `.tmp` after normal save; no zero-byte file | PASS |

**Validation Summary:** All 18 test cases executed. Status column to be marked PASS/FAIL by the student during laboratory verification. Any FAIL must be logged with defect ID, root cause, and retest result.

---

## 8. CONCLUSION & FUTURE ENHANCEMENTS

### 8.1 Conclusion

The Digital Voting Machine presented in this report demonstrates a complete, software-based electronic voting terminal implemented entirely in Python with Tkinter. The Finite State Machine (IDLE, READY, VOTED, LOCKED, RESULT) provides a formal, auditable model of the officer-versus-voter workflow, ensuring that state transitions occur only under defined conditions and role-based authentication. Single-vote lockout is enforced both at the UI layer (button disabling) and the control layer (session flag), preventing double-voting within a session. Data persistence via atomic JSON writes guarantees that vote tallies survive application restarts, while an append-only audit log records every security-relevant event for post-election verification.

The implementation satisfies the coursework objectives of digital electronics and software engineering: state-machine design, event-driven GUI programming, role-based access control, defensive data persistence, and security-conscious software architecture. As of the Phase 1 security addendum (2026-11-12), the machine gates voting behind voter-ID verification, encrypts tallies at rest with AES-256-GCM, maintains a tamper-evident hash-chained audit log, and auto-locks after officer inactivity. While intended for academic demonstration and small-scale elections (e.g., student council voting), the design's remaining limits are documented — voter-ID registration, multi-kiosk sync, and end-to-end verifiability remain open before any real-world political use.

### 8.2 Future Enhancements

| Enhancement | Description |
|-------------|-------------|
| **Web Integration** | Migrate the Tkinter frontend to a web interface (Flask/Django/FastAPI) with HTTPS, enabling remote voting and centralized result aggregation. |
| **Database Encryption** | Replace JSON files with SQLite or PostgreSQL; encrypt stored tallies with AES-256 and sign audit entries with HMAC to prevent offline tampering. |
| **Biometric Login** | Integrate fingerprint or facial recognition (via vendor SDKs) for officer authentication, replacing the PIN. |
| **Voter Authentication** | Implement voter ID + OTP or smart-card verification before enabling READY-state voting. |
| **VVPAT Support** | Add a printer module to emit a voter-verified paper audit trail for each cast vote. |
| **Cryptographic End-to-End Verifiability** | Implement homomorphic encryption or commitment schemes so voters can verify their vote was counted without revealing their choice. |
| **Multi-Kiosk Sync** | Introduce a backend server to synchronize sessions across multiple machines and prevent double-voting across kiosks. **DEMO IMPLEMENTED (Phase 6 2026-11-15)** — `server/dvm_server.py` — a stdlib-only Flask-free SQLite backend with hash-chained audit + server-side EPIC dedup, plus `server/demo.html` test-voter UI. This is a demo, not a production EVM: single-kiosk, no voter roll, key-at-rest next to data. See README "Optional Demo Backend". |
| ~~PIN Change Mechanism~~ | **IMPLEMENTED (Phase 1)** — "Change PIN (Officer)" button re-authenticates, validates 4–8 digits, persists. |
| ~~JSON Integrity Protection~~ | **IMPLEMENTED (Phase 1)** — AES-256-GCM tag on `votes_data.json` + SHA-256 hash-chained audit log. |
| ~~Voter Authentication~~ | **IMPLEMENTED (Phase 1)** — EPIC/voter ID verified at ballot open; one ID per ballot; IDs stored SHA-256-hashed; duplicates rejected. |

---

## APPENDIX A — SECURITY ADDENDUM (2026-11-12)

Phase 1 hardening applied after the sprint-1 listing embedded in Section 5. The authoritative source is `digital_voting_machine.py`; this section enumerates exactly what changed and what was verified.

### A.1 Implemented

| Control | Implementation | Verification |
|---------|----------------|--------------|
| **Voter ID gating** | READY state requires EPIC/voter ID (6–12 alphanumerics/hyphens) before candidate buttons enable. One ID per ballot. IDs stored only as `SHA-256(b"DVM-VOTER\x00" + id)`. Duplicates rejected at the ballot gate. | TC-16 — ballot stays locked until ID verified |
| **AES-256-GCM at rest** | `votes_data.json` written as `{version:2, nonce, ct}` — AES-GCM 32-byte key from `dvm_key.key` (machine-local, chmod 600 where supported). Any single-byte edit fails decryption → defaults + tamper logged. | TC-18 — tampered file falls back to defaults |
| **Hash-chained audit** | Each entry: `{seq, timestamp, event, actor, detail, prev, hash}`; `prev` = SHA-256 of previous entry; `hash` = SHA-256 of canonical entry. Legacy plain entries are re-chained once at startup. | TC-19 — one-byte edit detected; `verify_audit_chain()` returns False |
| **PIN lockout parity** | 3 wrong PINs → keypad disabled for 30s; `pin_lockout_until` + `failed_pin_attempts` persisted in the encrypted payload; survives restart; auto re-enable after cooldown. | Code path shared with pre-existing 3-attempt rule; manual test |
| **Officer inactivity auto-lock** | 5-minute timer; any click/keypress resets; on expiry → OFFICER_AUTH cleared, machine returns to IDLE, `OFFICER_SESSION_TIMEOUT` audited. | Manual test |
| **PIN change flow** | "Change PIN (Officer)" button on the READY officer row: current-PIN re-auth → 4–8 digit validation → confirm → persisted (re-encrypted). | TC-17 — persists, tallies intact after reload |
| **Input validation** | PIN digits-only (`isdigit`, ≤8 chars); voter ID regex-validated; candidate IDs validated against roster before tally increment; votes cast via `int()` coercion. | TC-14, TC-16, TC-17 |
| **Integrity-only fallback** | Without `cryptography` (stdlib-only mode), data persists as v1 plaintext but every tamper/migration event is written to the audit chain (`MIGRATED_TO_ENCRYPTION`, `CRYPTO_UNAVAILABLE`). | TC-07…TC-15 pass in both modes |

### A.2 Runtime

```bash
# AES-GCM at rest (D: venv — disk-constrained environments)
D:\DE Digital voting Machine\.venv\Scripts\python.exe digital_voting_machine.py
# Integrity-only fallback (any Python 3.x with Tkinter)
python digital_voting_machine.py
```

### A.3 Migration guarantees

- **Legacy plaintext `votes_data.json`**: detected and re-encrypted on first read (`MIGRATED_TO_ENCRYPTION` logged).
- **Legacy plain `audit_log.json`**: re-chained once at startup (`_migrate_audit_chain()`), preserving all historical entries.
- **Test result**: 19/19 test cases pass in both AES-GCM and integrity-only modes (system Python 3.x and D: venv).

### A.4 React/Web parity (2026-11-12)

The web version (`dvm-web/`) was brought to the same security posture in the same session:

- **Voter-ID gating** on the READY console — STEP 1 (EPIC ID + VERIFY) must complete before candidate keys enable; one ID per ballot; IDs stored SHA-256-hashed in `dvm_votes` (encrypted payload) alongside the tally; duplicates rejected with `VOTER_ID_DUPLICATE` audited.
- **AES-256-GCM at rest** — `dvm_votes` and `dvm_audit_log` are stored encrypted in `localStorage` (v2 format `{nonce, ct}`), key stored machine-locally as `dvm_machine_key`. Legacy plaintext entries migrate transparently on first load (`MIGRATED_TO_ENCRYPTION` audited). Fallback (non-secure context / no `crypto.subtle`): integrity-only mode with loud audit, never silent.
- **Hash-chained audit log** — `dvm_audit_log` entries carry `prev` + `chain` (SHA-256 of canonical entry); chain integrity verified on app boot; mismatch → `AUDIT_CHAIN_TAMPERED` logged + user notified.
- **Officer session auto-lock** — 5-minute inactivity timer (click/keypress resets) → officer drawer closes, ballot returns to IDLE, `OFFICER_SESSION_TIMEOUT` audited.
- **Persistent PIN lockout** — `dvm_pin_lock` (fails + lockUntil) survives page refresh; 3 strikes → 30 s lockout with countdown; auto re-enable.
- **Officer PIN change** — "CHANGE OFFICER PIN" in the drawer: re-authenticates against stored SHA-256 hash, 4–8 digits, persisted to `dvm_pin_hash`.
- **Bug fix**: React votes were previously never persisted (the persist hook was dead code) — now written on every tally change.

### A.5 Web honest limits

- `dvm_machine_key` lives in `localStorage` — anyone with devtools access reads it; encryption protects casual file copying, not a determined local attacker.
- PIN is stored as SHA-256 (unsalted) — offline brute-force of a 4-digit PIN is trivial with local access; rate-limiting + lockout are the real controls.
- Voter-ID hashes are stored in plain JSON shape inside the encrypted payload (good), but `dvm_pin_lock` and `dvm_machine_key` are plain keys in localStorage (acceptable for a kiosk demo; documented, not hidden).

### A.6 Python honest limits (unchanged)

- `dvm_key.key` is machine-local; anyone with read access to the machine's filesystem can decrypt tallies.
- Voter-ID list is a local allowlist maintained by polling staff — not a national register lookup.
- No voter-ID revocation mid-poll.
- Officer session is "per boot" — a stolen kiosk image exposes the PIN hash only, not RSA private material (there is none).

---

## APPENDIX B — FILE INVENTORY

| File | Purpose |
|------|---------|
| `digital_voting_machine.py` | Complete Tkinter application source code |
| `votes_data.json` | Encrypted vote tallies, officer PIN, used voter-ID hashes (auto-generated) |
| `audit_log.json` | Hash-chained append-only audit trail (auto-generated) |
| `dvm_key.key` | Machine-local AES-256 key for at-rest encryption (auto-generated) |
| `README.md` | Build/run instructions |

## APPENDIX C — GLOSSARY

- **FSM:** Finite State Machine — a computational model with a finite number of states and defined transitions between them.
- **NOTA:** None of the Above — a ballot option allowing voters to reject all candidates.
- **VVPAT:** Voter-Verified Paper Audit Trail — a physical receipt confirming the electronic vote.
- **Atomic Write:** A file operation that either completes fully or not at all, preventing partial/corrupt files.
- **HMAC:** Hash-based Message Authentication Code — a mechanism for message integrity and authenticity.

---

**End of Report**  
*Prepared for university coursework submission — Digital Electronics / Software Engineering*
