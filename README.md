# Digital Voting Machine (DVM-900)

> **Educational simulation — not for real elections.**
> This is a course project. It is **not** a certified electronic voting machine, not an EVM, and no part of it may be used in a real election. Every "tamper-evident", "encrypted" and "integrity" claim in this repository describes a demonstration, not a guarantee. See `DVM_Project_Report.md` → Section 6 (Residual Risks) for the honest breakdown.

A software-only simulation of an electronic voting machine implemented in:

1. **React + Vite (web) — `dvm-web/` — the submission.**
2. **Archive** — `archive/python_tkinter_sprint1/` — sprint-1 Python twin, frozen, not maintained.

---

## Optional Demo Backend (`server/` — stub, not shipping)

A thin, stdlib-only Python backend demonstrating **server-side** duplicate prevention — the gap client-localStorage can't close.

```bash
# 1. Start (uses the D: venv Python, no pip installs needed)
 D:\DE Digital voting Machine\.venv\Scripts\python.exe server\dvm_server.py

# 2. Open the demo kiosk
#    http://127.0.0.1:5000

# 3. Run the backend smoke tests (8 cases)
 D:\DE Digital voting Machine\.venv\Scripts\python.exe server\test_server.py
```

What's here:
- `dvm_server.py` — stdlib `http.server` + `sqlite3`. Endpoints: `GET /api/tally`, `GET /api/audit`, `GET /api/health`, `POST /api/vote`, `POST /api/reset`. EPIC enforced server-side (6–12 chars regex + SHA-256 of `DVM-VOTER\x00` + epic). One vote per EPIC — server-side, so bypassing the web UI doesn't matter. Hash-chained audit log (`seq` + `prev` + SHA-256). Issues an HMAC-signed receipt on each accepted vote (`receipt` field, for the demo story).
- `demo.html` — minimal kiosk page: cast a vote, watch the tally update live, see the audit tail, re-verify the chain, officer reset.
- `test_server.py` — 8 unittest cases.
- `votes.db` — created on first run (delete to reset; git-ignored).

**Honest limits:** single-kiosk scope; no voter roll (EPIC format check only); signing key `.backend_key` lives next to the DB; still not a certified EVM. The React app does **not** call this backend — it's a demonstration of the next step, not the shipping architecture.

---

## Project Structure

```
D:\DE Digital voting Machine\
├── DVM_Project_Report.md          # Full academic project report (8 sections + appendices)
├── TODO_LIST.md                   # To-do list (Phases 7-13, 2026-11-15)
├── README.md                      # This file
├── archive/
│   └── python_tkinter_sprint1/    # Sprint-1 Tkinter reference — archive only (see ARCHIVE.md)
├── dvm-web/                       # React + Vite implementation — the submission
│   ├── src/
│   │   ├── App.tsx                # Main component, FSM logic (5 states)
│   │   ├── main.tsx               # Entry point
│   │   ├── index.css              # Styles; dark/light theme
│   │   ├── components/ui/         # shadcn-style UI components (button, background-paths)
│   │   └── test/fsm.test.jsx      # 11 Vitest smoke tests
│   ├── package.json
│   └── vite.config.js
├── server/                        # Optional demo backend (not called by the app)
│   ├── dvm_server.py              # stdlib http.server + sqlite3
│   ├── demo.html                  # minimal kiosk page
│   └── test_server.py             # 8 unittest cases
├── tests/
│   └── test_python.py             # Sprint-1 test file (archive reference only)
├── SUBMISSION/                    # Submission package (report + fresh copies — see SUBMISSION/pack.ps1)
└── dvm_key.key / votes_data.json / audit_log.json   # Sprint-1 artifacts (not produced by dvm-web)
```

---

## Web Implementation (the submission)

### Prerequisites
- Node.js 18+, npm
- Note: `C:` on this development machine is nearly full — if `npm install` fails with ENOSPC, point npm's cache at D: or free space on C:

### Install / build / run / test (from `dvm-web/`)
```bash
npm install
npm run dev      # development server → http://127.0.0.1:5173
npm run build    # production build → dvm-web/dist/
npm run lint     # oxlint
npm test         # vitest — FSM smoke tests (11 tests)
```

Test coverage: officer arm → IDLE→READY, EPIC/doc gates, cast ballot, duplicate-voter rejection across remount, tally persistence across remount, 3-attempt PIN lockout (+ reload persistence), LOCKED→RESULT→IDLE flow, daylight/dark toggle crash-free.

### Features (all demonstration-only)
- 5-state FSM driven screens: IDLE (landing), READY, VOTED, LOCKED, RESULT
- Landing: animated "One Person One Ballot" background (CSS/Motion)
- **localStorage persistence** for votes, voter-ID lockout, audit log (`dvm_votes`, `dvm_audit_log`)
- Officer PIN authentication with 3-attempt lockout + 30-second cooldown (persisted)
- Voter ID **and** ID-document upload gate (`Step 1 of 2`) — one document = one vote (file-hash dedup); a re-photographed card is NOT detected (see report §6)
- Dark mode toggle, print stylesheet, cookie banner, command-palette search, spec/FAQ sections
- What "audit" means here: a SHA-256 hash chain over a small log written to localStorage. We call it **audit log** because that's what it is in the code — not because it has any security authority. It is checkable, not trustworthy.

### Dependencies (current)
- `react`, `react-dom` ^19.3.1
- `vite` ^5.4.21, `@vitejs/plugin-react`
- `motion` (animation), `lucide-react`, `@radix-ui/react-slot`, `class-variance-authority`
- No animation/icon frameworks beyond what the above use (gsap removed). `tailwindcss` v4 was removed — Tailwind via CDN is the only runtime styling.

---

## Academic Submission

The complete report is in `DVM_Project_Report.md`:
1. Title Page, Metadata · 2. System Architecture & FSM · 3. Execution Roadmap
4. Technical Design · 5. Source Code (archive reference, not the shipping source) · 6. Security & Anti-Fraud · 7. Test Matrix
8. Conclusion & Future Enhancements (+ Appendix A: Security Addendum)

## Default Credentials
- Officer PIN: `1234` — visible in source. Change in-app if you want it changed.

## Honest scope
This software simulation does not count real votes, is not certified, and must not be used at an actual polling station.

## License
Academic project — Digital Electronics / Software Engineering coursework.
