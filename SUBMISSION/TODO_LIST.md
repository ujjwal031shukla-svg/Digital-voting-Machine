# DVM — Digital Voting Machine · To-Do List

**Date written:** 2026-11-14
**Status:** Fresh list — all previously tracked outstanding items deleted per user request.
**Scope note:** This is an educational simulation, not a certified voting machine. Replace any wording implying otherwise with the disclaimer below.

> Educational simulation — not for real elections.

---

## Phase 1 — Honesty & Report Integrity ✅ COMPLETE (2026-11-14)

- [x] Remove or re-caption security-theater strings with "Educational simulation — not for real elections":
  - "FEDERAL ELECTIONS COMMISSION · SECURE BALLOT INTEGRITY ACCREDITED" → "DVM-900 COURSE SIMULATION · NOT FOR OFFICIAL ELECTIONS"
  - "SERIAL DVM-88420-XF" → "SERIAL DVM-SIM-000"; "SEAL #8841-B" + copy button → "SEAL #SIM-000 (FICTIONAL)"
  - "BAY 01/02 READY" → "SIM UNIT · BAY 01 READY"; "TAMPER OK" → "SIM: TAMPER OK"; "PRECINCT 14-B" → "PRECINCT 14-B (FICTIONAL)"
  - "Solenoid 4.2N nominal", "Geneva flip-counter", "HSM-2", "SEALED", "CERTIFICATE #701-X" → all captioned as SIM (or deleted)
  - Diagnostics boot log and self-test lines prefixed `[SIM BOOT]` / `[SIM TEST]` / `[SIM DONE]`
  - "Hardware self-test complete" → "Simulated self-test complete"
  - Stale `dvm-web\ssr-dist\ssr-entry.js` artifact (contained heavier theater: "Geneva flip-counters rotate one decade") → deleted
- [x] Replace dvm-web `README.md` (was default Vite template) with real project README (setup/build/honesty).
- [x] Root README rewritten: scope disclaimer up top, accurate features, accurate deps, honest scope.
- [x] Report: "Security Limitations" consolidated in Section 6 (Residual Risks rewritten to current reality incl. document-upload file-identity-only limit and client-side enforcement); stale "no voter authentication" claim corrected.
- [x] Known Issues + Assumptions sections retained (already present, K-3 updated context).
- [x] Student placeholder fields — intentionally left as bracketed placeholders for the student to fill (not ours to invent).
- [x] Sync report claims: title-page Status → "NOT for real elections"; report disclaimer banner added; "production-ready" removed (incl. Section 5 heading and embedded listing header); HOWTO_RUN/Appendix A wording kept honest; stale "plaintext JSON" note corrected to AES-GCM (with the key kept on the same device).
- [x] Disclaimer visible in UI footer: "DVM-900 COURSE SIMULATION · NOT FOR OFFICIAL ELECTIONS"

---

## Phase 2 — Repo Hygiene ✅ COMPLETE (2026-11-14)

- [x] Initial git commit (`7ff23e3` — 52 files; repo had zero commits).
- [x] Root `.gitignore` extended: `.npm-cache/`, `.pip-cache/` (node_modules/, dist/, *.log, __pycache__/, .venv/ already covered).
- [x] `SUBMISSION/` now regenerates from root via `SUBMISSION/pack.ps1` (never hand-edited); duplicates removed; `pack.ps1` made idempotent.
- [x] Delete dead files: `cinematic-hero.tsx` (components/ + ui/), `cinematic-hero.bak.tsx`; removed `gsap` dep (+ stale node_modules copies: gsap, framer-motion stray, @tailwindcss, tailwindcss, autoprefixer, postcss).
- [x] Remove stray logs: `jsdom.log`, `lucide.log`, `preview-build.log`, `uninstall.log`, `ssr-build.log`; deleted `start.bat` / `start-dev.bat`.
- [x] Free C: drive — npm cache moved to `D:\DE Digital voting Machine\.npm-cache` via `dvm-web/.npmrc`; `npm install` + `npm run build` run out-of-the-box (verified `vite build` exit 0 on clean dep tree after `npm i`); removed corrupt node_modules tree; `npm run lint` = 0 errors (warnings only).
- [x] Reconcile Tailwind: CDN (in use at runtime) chosen; build-time Tailwind v4 removed from devDeps; `@tailwindcss/vite` removed from vite.config; `@tailwind`/`@import "tailwindcss"` directives removed from index.css; documented in both READMEs.
- [x] Decide `db/` — removed (dead pymysql code, no consumer); `db/schema.sql` report mapping item moot.
- [x] Verify `.oxlintrc.json` passes — `npm run lint`: 0 errors.
- [x] Report mapping for `db/schema.sql` if kept — N/A (db/ removed).
- [x] SUBMISSION_CHECKLIST.md rewritten honestly (removed leaked DB credential and unverifiable "MySQL verified" claim; regenerated package has identical, fresh files).

---

## Phase 3 — React Test Coverage ✅ COMPLETE (2026-11-15)

- [x] Test runner: Vitest 2.x + Testing Library (`vitest.config.js`, `src/test/setup.js`; jsdom; canvas/matchMedia stubs for jsdom absence).
- [x] `npm test` / `npm run test:watch` scripts in `dvm-web/package.json`.
- [x] FSM smoke tests (`src/test/fsm.test.jsx`, 9 tests, **9/9 PASS** on `npm test`):
  - IDLE → READY (officer PIN arm via officer drawer PIN pad)
  - READY → VOTED (EPIC verify + ID document upload + candidate select + CAST VOTE)
  - READY gate check: candidates disabled until ID verified
  - Document gate: confirm stays disabled until ID doc accepted
  - Double-vote blocked across remount (duplicate EPIC rejected)
  - Tally persists across remount (1 recorded vote, WINNER shown in RESULT)
  - Officer PIN 3-attempt → LOCKOUT ("KEYPAD LOCKED — 30S BACKOFF")
  - Locked-out state survives remount (digits refused)
  - LOCKED → RESULT (tally page) → IDLE (STANDBY reached)
- [x] `vitest.config.js` standalone config (kept `vite.config.js` for the app; no shared plugin deps)

Notes:
- Tests drive the real `App.tsx` with seeded AES-GCM storage; not mocks.
- jsdom lacks `canvas`/`matchMedia` — stubbed in `src/test/setup.js`.
- `testTimeout` raised to 30 s (monolith re-renders the whole app per interaction in jsdom).

---

## Phase 4 — Voter/Officer UX

- [ ] Split voter and officer flows: voters → EPIC + document verify → cast ballot; officer PIN arms the machine / opens officer drawer; reword CTAs so a voter never appears to need officer sign-in.
- [ ] One-time accessible CTA audit: focus traps in modals, labelled controls, keyboard-only FSM navigation, ≥16px base font for interactive elements, visible focus states, name/role/aria on icon-only controls.
- [ ] Consistent type scale across ballot console, audit stub, header, footer, step panels — remove one-off `text-[…px]` overrides.
- [ ] Verify dark-mode rendering of every component touched on this list (background-paths, landing, console).

---

## Phase 5 — Demo & Submission

- [ ] Demo video + script (officer arms ballot; voter verifies EPIC + uploads ID; casts; shows RESULTS tally; shows officer reset).
- [ ] `SUBMISSION_CHECKLIST.md` refresh to final artifact list.
- [ ] Package `SUBMISSION/` by regeneration, not copy; verify (Ctrl+F5) on a clean browser profile before recording.

---

## Phase 6 — (Optional / Future Work, NOT this course) Real Backend

Do not implement for this submission — document as Future Work in the report.

- [ ] SQLite/Express (or Flask) voter roll + signed server-side sessions.
- [ ] Write-only ballot endpoint with server-side duplicate prevention keyed on hashed EPIC.
- [ ] Append-only audit log on server; VVPAT-style printed/signed tally receipt.
- [ ] Map to production EVM requirements (EVM certification, paper trail, external audits) in report.

---

## Summary

| Status | Meaning |
|---|---|
| Phase 1 | Blocks integrity of report/submission |
| Phase 2 | Blocks a working single checkout |
| Phase 3 | Blocks confidence against regressions |
| Phase 4 | Blocks usability/demo quality |
| Phase 5 | Blocks submission |
| Phase 6 | Explicitly out of scope |

**Honest scope statement:** this is a course simulation, not an EVM; nothing here certifies or enables real elections.

