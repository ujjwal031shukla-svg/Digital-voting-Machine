# Digital Voting Machine (DVM)

> **Educational simulation — not for real elections.**
> This is a course project. It is **not** a certified electronic voting machine, not an EVM, and no part of it may be used in a real election. Every "tamper-evident", "encrypted" and "integrity" claim describes a demonstration, not a guarantee. See `DVM_Project_Report.md` → Security Limitations for the honest breakdown.

A software simulation of an electronic voting machine implemented twice:

1. **Python + Tkinter** (desktop — course submission)
2. **React + Vite** (web — `dvm-web/`)

---

## Project Structure

```
D:\DE Digital voting Machine\
├── DVM_Project_Report.md          # Full academic project report (8 sections + appendices)
├── TODO_LIST.md                   # Fresh to-do list (2026-11-14)
├── README.md                      # This file
├── python_tkinter/
│   └── digital_voting_machine.py  # Python Tkinter desktop implementation (simulation)
├── dvm-web/                       # React + Vite web implementation (simulation)
│   ├── src/
│   │   ├── App.tsx                # Main component, FSM logic (5 states)
│   │   ├── main.tsx               # Entry point
│   │   ├── index.css              # Styles; dark/light theme
│   │   └── components/ui/         # shadcn-style UI components (button, background-paths)
│   ├── package.json
│   └── vite.config.js
├── db/                            # Optional MySQL mirror (unused/optional — see TODO)
├── tests/
│   └── test_python.py             # 19 automated tests for the Tkinter version
├── SUBMISSION/                    # Submission package (report + copies)
└── dvm_key.key / votes_data.json / audit_log.json   # Auto-generated (Python version)
```

---

## Python Tkinter Version (Desktop)

### Prerequisites
- Python 3.8+ (Tkinter is in the standard library)
- Optional: `cryptography` (AES-GCM at rest) via the D: venv

### Run
```bash
# Recommended — integrity-tagged storage (D: venv)
D:\DE Digital voting Machine\.venv\Scripts\python.exe python_tkinter\digital_voting_machine.py

# Fallback — integrity-only, stdlib only
python python_tkinter\digital_voting_machine.py
```

### Features (all demonstration-only)
- Officer PIN authentication with 3-attempt lockout + 30s cooldown (persisted)
- Voter ID (EPIC) verification before the ballot opens — SHA-256 hashed at rest
- Officer inactivity auto-lock (5 minutes)
- Officer PIN change flow (current-PIN re-auth)
- FSM: IDLE → READY → VOTED → LOCKED → RESULT
- Single-vote lockout per browser/profile / per voter ID
- Simulated "AES-GCM at rest" (`dvm_key.key`, machine-local) with loud fallback to integrity-only
- Hash-chained audit log (`seq` + `prev` + SHA-256) — tamper-evident against naive edits; recomputable by anyone who can write the file
- JSON persistence (`votes_data.json`, `audit_log.json`) with atomic writes
- Visual + auditory feedback (`winsound.Beep` on Windows)
- Role-based transitions (Officer vs Voter)

### Auto-generated files
- `votes_data.json` — encrypted vote tallies, used voter-ID hashes, lockout state
- `audit_log.json` — hash-chained audit trail
- `dvm_key.key` — machine-local key (keep private; do not commit)

---

## React + Vite Version (Web)

### Prerequisites
- Node.js 18+, npm
- Note: `C:` on this development machine is nearly full — if `npm install` fails with ENOSPC, point npm's cache at D: or free space on C:

### Install / build / run / test (from `dvm-web/`)
```bash
npm install
npm run dev      # development server → http://127.0.0.1:5173
npm run build    # production build → dvm-web/dist/
npm run lint     # oxlint
npm test         # vitest — FSM smoke tests (9 tests)
```

Test coverage: officer arm → IDLE→READY, EPIC/doc gates, cast ballot, duplicate-voter rejection across remount, tally persistence across remount, 3-attempt PIN lockout (+ reload persistence), LOCKED→RESULT→IDLE flow.

### Features (all demonstration-only)
- 5-state FSM driven screens: IDLE (landing), READY, VOTED, LOCKED, RESULT, plus OFFICER drawer and DIAGNOSTICS
- Landing: animated "One Person One Ballot" background (CSS/Motion)
- **localStorage persistence** for votes, voter-ID lockout, audit log (`dvm_votes`, `dvm_audit_log`)
- Officer PIN authentication with 3-attempt lockout + 30-second cooldown (persisted)
- Voter ID **and** ID-document upload gate (`Step 1 of 2`) — one document = one vote (file-hash dedup); a re-photographed card is NOT detected (see Security Limitations)
- Dark mode toggle, print stylesheet, cookie banner, command-palette search, spec/FAQ sections
- Web Audio API sound feedback intentionally absent (performance)

### Dependencies (current)
- `react`, `react-dom` ^19.3.1
- `vite` ^5.4.21, `@vitejs/plugin-react`
- `motion` (animation), `lucide-react`, `@radix-ui/react-slot`, `class-variance-authority`, `gsap` (verify usage)

---

## Academic Submission

The complete report is in `DVM_Project_Report.md`:
1. Title Page, Metadata · 2. System Architecture & FSM · 3. Execution Roadmap
4. Technical Design · 5. Source Code · 6. Security & Anti-Fraud · 7. Test Matrix
8. Conclusion & Future Enhancements (+ Appendix A: Security Addendum)

---

## Default Credentials
- Officer PIN: `1234` — change in-app or treat as demo-only.

## Honest scope
This software simulation does not count real votes, is not certified, and must not be used at an actual polling station.

## License
Academic project — Digital Electronics / Software Engineering coursework.
