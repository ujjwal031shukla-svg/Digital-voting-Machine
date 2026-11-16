# DVM — Digital Voting Machine · To-Do List

**Date written:** 2026-11-15 (rewritten from brutal-feedback review, 0 sugarcoating)
**Status:** Phases 0–6 complete (honesty labels, repo hygiene, React tests, UX, demo packaging, demo backend).

> This is an educational simulation of an EVM. It is not a voting machine, cannot be one, and must not pretend to be one.
> Every claim in the code/docs must be either verifiable (one line of test you can run) or removed.

---

## ✅ Completed (kept for the record — do not delete or re-open)

- Phase 1 — Honesty & Report Integrity (2026-11-14): disclaimers added everywhere; theater strings re-captioned; README/report rewritten.
- Phase 2 — Repo Hygiene (2026-11-14): git init, dead files removed, SUBMISSION regenerates from root via `pack.ps1`, honest checklist.
- Phase 3 — React Test Coverage (2026-11-15): 11/11 Vitest FSM smoke tests PASS (`npm test`).
- Phase 4 — Voter/Officer UX (2026-11-15): CTAs split, keyboard FSM navigation, modal focus traps, type scale, dark/light verified.
- Phase 5 — Demo & Submission (2026-11-15): DEMO_SCRIPT rewritten, checklist rewritten, package regenerates; video deferred by user.
- Phase 6 — Demo Backend (2026-11-15): stdlib SQLite backend (server-side EPIC dedup, hash-chained audit, 8/8 smoke tests PASS).

---

## Phase 7 — Claim integrity (BLOCKS submission quality)

Stop implying the app is more secure/verified than it is. Make every remaining claim testable or delete it.

- [ ] Audit every "tamper-evident", "encrypted", "integrity", "secure", "verified", "sealed", "locked", "protected", "audit" phrase in code, README, report, UI strings.
- [ ] For each occurrence: either add a one-line verifiable test/property, rename it to what it actually is ("obfuscation", "checksum", "client-side format check", "demo log"), or delete it.
- [ ] Remove "tamper OK", "SHA-256 hash-chained audit", "AES-256-GCM encrypted at rest" phrasing from user-facing text; replace with exact, boring description ("bytes stored in browser localStorage; key stored next to them; swap the files and nothing notices").
- [ ] Remove "PRECINCT 14-B (FICTIONAL)", "SIM UNIT · BAY 01 READY", "seal #SIM-000", `SERIAL DVM-SIM-000`, "REG", "Kiosk Terminal 04", "BAY 02 · BAY 01 READY" decoration in favour of a single honest line, e.g. "DVM-900 COURSE SIMULATION — NOT FOR OFFICIAL ELECTIONS".
- [ ] No external accreditation icons, badges, seals, stamps, holograms anywhere — not even "FICTIONAL".
- [ ] Add a one-paragraph "What this machine actually guarantees" to README, report, and the demo script — a plain-language honesty page.

---

## Phase 8 — One implementation only

Two divergent codebases (Tkinter + React) both claim to be "the FSM". This will keep drifting; the Python twin already drifted.

- [ ] Decide: ship web only, or Python only. Pick one. Delete the other or archive it untouched as "sprint-1 reference" with a clear README note.
- [ ] Recommended: keep React app; move Tkinter version to an `archive/` folder with `NOT MAINTAINED` note; remove Tkinter claims from main README/report positioning.
- [ ] Report must state clearly which implementation is the submission and what role the other has.

---

## Phase 9 — Honest internals (upgrade the demo to a C- version instead of a D+)

Every existing "control" bypasses a single line in DevTools. Fix the two cheapest ones; leave the rest documented as honest-limit.

- [ ] Replace "voter ID verified" with a proper demo: server issues a **signed HMAC receipt** per recorded ballot (server signs, client displays, server re-verifies on tally read). No external keys; demo key stays local.
- [ ] Make the web audit log verify **on every boot** and refuse to display a tally if chain fails — not just an advisory toast; a hard block with "audit chain invalid — do not trust this tally".
- [ ] Demo backend: write-only tally endpoint (public tally read; no voter identity visible per candidate, no voter list exposed).
- [ ] Keep: format-only EPIC validation, dual-key lockout, idle auto-lock — these are UX guards, not election guarantees. Rename them correctly in docs.
- [ ] Document every remaining bypass in §6 honestly (each: how to defeat it in one line, what it would take to fix, why we didn't).

---

## Phase 10 — Real small experiment (optional, high value)

Gives the report a real data point instead of fiction.

- [ ] With permission of 10+ real people (family/class/colleagues), run one real "mock election" through the web app in their presence.
- [ ] Record (anonymized): how many understood the STANDBY ribbon, how many found EPIC/upload flow confusing, how many cast correctly, how many got stuck.
- [ ] Add findings to report as "Preliminary usability observation (n=…, …)" — do not overstate.
- [ ] Discard the votes. Only the behavioral notes survive.

---

## Phase 11 — CI (cheap, high credibility)

- [ ] Add `.github/workflows/ci.yml` (or equivalent): on push → Python: `python tests/test_python.py`; web: `npm ci`, `npm test`, `npm run build`, `npm run lint`.
- [ ] Report CI status badge or at least state in README/checklist that tests re-run on every push.
- [ ] Submission checklist references CI run id/date.

---

## Phase 12 — Report upgrade (makes it a good submission, not just an honest one)

- [ ] Replace every "19/19 PASS" / "11/11 PASS" claim in the report with **actual captured output** pasted in a fenced block (rerun tests, copy output).
- [ ] Add section "How to rerun everything" (single command block per suite + expected output).
- [ ] Add "Known failure modes" section: each concrete thing that broke during development, what I changed, what still breaks (e.g., jsdom act() warnings, Tailwind removed-then-restored, `.npmrc`, C: drive full, EFSM CRASHES in this project's history, officer PIN lost on refresh edge cases).
- [ ] Fill student fields (Name, Roll No., Faculty, College, Date) by yourself before submission.
- [ ] Title page: remove anything implying institutional/government approval.
- [ ] Submission size: includes report + demo video + code; confirm total size fits your portal's limit.

---

## Phase 13 — Cleanup hygiene (cheap housekeeping, still open)

- [ ] `.gitignore` sanity: `dist/`, `.npm-cache/`, `.pip-cache/`, `node_modules/`, `__pycache__/`, `.venv/`, `votes.db`, `.backend_key`, `*.log` — all ignored; verify with `git status --ignored`.
- [ ] Remove root-level `__pycache__` if any tracked; remove `.npm-cache/`, `.pip-cache/` from disk if large.
- [ ] Free C: drive space before recording (ENOSPC bit us multiple times during demo recording setup).
- [ ] Commit everything, then `Ctrl+F5` on a clean browser profile against `dist/` build (not dev server) to verify submission build.

---

## Explicitly NOT doing (list to stop scope creep)

- No blockchain. No VVPAT printer. No "tamper-proof", "unhackable", "secure" language anywhere.
- No real voter roll acquisition. No "real election" anywhere including private phrasing.
- No new UI framework, no visual rewrite, no animation polish beyond what's there.
- No claiming certification, standards, or accreditation from any body.

---

## Summary

| Priority | Item | Status |
|---|---|---|
| 🔴 7 | Claim integrity (verifiable or delete) | OPEN — blocking submission quality |
| 🟠 8 | Pick one implementation, archive the other | OPEN |
| 🟠 9 | HMAC receipt + hard tally block on chain failure + write-only tally endpoint | OPEN |
| 🟡 10 | Real 10-person usability observation | OPEN (optional, high value) |
| 🟡 11 | CI workflow | OPEN |
| 🔴 12 | Report honesty upgrade (actual outputs, failure modes) | OPEN |
| 🟢 13 | Hygiene (gitignore verify, disk cleanup, Ctrl+F5 on dist) | OPEN |
| ✅ 1–6 | Earlier phases (honesty labels, repo, tests, UX, demo, backend) | DONE |

**Honest scope statement:** this is a course simulation, not an EVM; nothing here certifies or enables real elections. That sentence is the project — keep it in the footer, README, report, and demo script, always.
