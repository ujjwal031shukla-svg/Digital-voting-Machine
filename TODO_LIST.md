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

## Phase 7 — Claim integrity ✅ MOSTLY COMPLETE (2026-11-16)

Audit every "tamper-evident", "encrypted", "integrity", "secure", "verified", "sealed", "locked", "protected", "audit" phrase — **UI/web strings rewritten**.

- [x] Web UI strings: "SEAL #SIM-000 (FICTIONAL)" → removed; "seal hopper", "seal certificate", "SEAL TERMINAL & CLOSE", "OFFICER SIGN-IN TORESUME" → plain demo language ("CLOSE VOTING (demo)", "OFFICER SIGN-IN TO REOPEN"). Accreditation icons/mock-seal DOM nodes removed.
- [x] "SEAL #SIM-000 (FICTIONAL)", `SERIAL DVM-SIM-000`, `seal hopper`, `certificate`, `secure interlock` — **removed/renamed** to demo language.
- [x] "TAMPER OK" → removed; replaced by "DEMO" in footer/status chip.
- [x] `Goalkeeper`: hard audit-chain verification on RESULT view — `AUDIT_CHAIN_TAMPERED` blocks the tally view; no fake numbers shown.
- [x] Keep/fix test references in `fsm.test.jsx`.
- [x] React + Python archive — not maintained; moved to `archive/python_tkinter_sprint1/`.
- [x] `DVM_Project_Report.md` — claim-wise still needs the small backlog cleanup (Appendix A disclaimers already honest; Phase 12 adds measured output).

---

## Phase 8 — One implementation ✅ DONE (2026-11-16)

- [x] Tkinter twin archived: `archive/python_tkinter_sprint1/` (NOT MAINTAINED — see `archive/python_tkinter_sprint1/ARCHIVE.md`). `tests/test_python.py` updated to point at the archive.
- [x] Report + README explicitly reference the archive; web submission path is `dvm-web/`.
- [x] `SUBMISSION/pack.ps1` regenerates the package and excludes stale duplicate paths.

---

## Phase 9 — Honest internals ✅ MOSTLY DONE (2026-11-16)

- [x] `server/dvm_server.py` — server-side EPIC dedup + **HMAC-SIGNED receipt** (`receipt` field in `/api/vote` response). Uniqueness survives DevTools edit of `dvm_machine_key` / `dvm_pin_hash`.
- [x] Web RESULT screen now **hard-blocks** on `auditTampered` — refuses to render a tally whose local audit chain failed verification; shows "Audit chain FAILED / Code: AUDIT_CHAIN_TAMPERED" instead.
- [x] `demo.html` — surfaces the HMAC receipt to the voter, shows hash-chain status, re-verifies on demand; officer reset behind a confirm.
- [x] Documented the remaining bypasses in report §6 (honest limits) — each with what it limits, how a beaten voter/officer would beat it, and why we didn't add VVPAT.
- [ ] "Write-only tally endpoint" — the demo tally endpoint is open read; making it HMAC-attested write-only is left as future work (see report §6).

---

## Phase 10 — Real small experiment (NOT DONE — user task, 2026-11-16 onwards)

This phase cannot be done from a laptop-in-a-build-session; it requires 10 real participants. Phase 10 is **open**:

- [ ] Run one mock election with 10+ classmates/colleagues, collect verbal observations (questionnaire is fine — e.g., "Was STANDBY text clear?", "Did you understand EPIC+upload flow?", "Did anything break silently?").
- [ ] Add findings to the report as Appendix D "Usability observation (n=…, date)" — cite numbers where possible.
- [ ] Drop the cast votes; keep only the behavioral notes.
- [ ] If cannot be done before submission, state so explicitly in the report ("no usability data — evaluation via assumed heuristics only").

---

## Phase 11 — CI (cheap, high credibility) ✅ DONE (2026-11-16)

- [x] `.github/workflows/ci.yml` — runs on push to `main`: `npm ci`, `npm test`, `npm run build`, `npm run lint` (web) + backend `python server/test_server.py` + archive byte-compile of the Tkinter reference. Python sprint-1 test suite is best-effort (`|| true`).
- [ ] CI run id / passing status linked from the submission checklist (record the run URL after first push from your machine).
- [ ] Report does not need changing; the CI badge line can be added by editing the checklist heading.

---

## Phase 12 — Report upgrade (PARTIALLY DONE — 2026-11-16)

- [x] **Actual captured outputs** — Appendix D added to `DVM_Project_Report.md` with real outputs from `npm test` (Vitest 11/11 PASS), `python server/test_server.py` (unittest 8/8 PASS), `npm run build` (sizes), `npm run lint` (warnings only).
- [x] Phase-5 honesty pass: stale Xyz/certificate/seal language scrubbed; "Left double quotes dropped"; disclaimers everywhere.
- [ ] Student field fill-in — **NOT DONE** (user must put their name/roll/faculty/date in before submission; the report still has placeholders `[Student Name]` etc).
- [ ] College/faculty signature box — optional, often required by evaluation boards; out of scope here.
- [ ] Title page and `README.md` still leave a small handful of lowercase "ff → optional" lines; user can gild if course requires it.
- [ ] Final rebuild + `SUBMISSION/pack.ps1` — submission is regenerated after every root edit.

---

## Phase 13 — Cleanup hygiene ✅ MOSTLY DONE (2026-11-16)

- [x] `.gitignore` extended — `dist/`, `.tmp/`, `server/votes.db`, `server/.backend_key`, `.npm-cache/`, `.pip-cache/`, `__pycache__/`, `.venv/`, `*.log`, `node_modules/` all ignored.
- [x] `SUBMISSION/pack.ps1` regenerates the submission package; stale duplicate paths removed; `npm run build` exits 0 on a clean tree (after `npm install`).
- [x] Root `TODO_LIST.md` rewritten — phases 1–6 recorded as completed, phases 7–13 re-scoped honestly.
- [x] `dvm-web/` passes build + `npm run lint` (warnings only, zero errors) + 11/11 tests.
- [ ] **C: drive still effectively at 0 bytes free** — npm cache moved to `D:\DE Digital voting Machine\.npm-cache` via `dvm-web/.npmrc`; but `C:\Users\hp` is nearly full. Free space before recording the demo video (ENOSPC breaks builds and tests).
- [ ] `npm run preview` against `dist/` — user should confirm Ctrl+F5 against the `dist/` build rather than the dev server.

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
| 🟡 7 | Claim integrity (verifiable or delete) | MOSTLY DONE — web UI clean; report backlog small |
| 🟢 8 | One implementation: web only; Tkinter archived | DONE |
| 🟡 9 | HMAC receipt + hard tally block + write-only endpoint | MOSTLY DONE — write-only endpoint left as future work |
| 🟡 10 | Real 10-person usability observation | OPEN — user action, before submission |
| 🟢 11 | CI workflow (`.github/workflows/ci.yml`) | DONE |
| 🟡 12 | Report honesty upgrade | PARTIAL — Appendix D with actual outputs added; student fields missing |
| 🟢 13 | Hygiene (.gitignore, SUBMISSION regen, build/lint/test clean) | MOSTLY DONE — C: drive still full; preview-verified against `dist/` pending |
| ✅ 1–6 | Earlier phases (honesty labels, repo, tests, UX, demo, backend) | DONE |

**Honest scope statement:** this is a course simulation, not an EVM; nothing here certifies or enables real elections. That sentence is the project — keep it in the footer, README, report, and demo script, always.
