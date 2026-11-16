# DVM — Submission Checklist (2026-11-15)

**Student:** [Student Name]  |  **Course:** Digital Electronics / Software Engineering
**Project:** Digital Voting Machine (DVM-900, course simulation)
**Date:** 2026-11-15

> Educational simulation — not a certified EVM, not for real elections.

## Contents of this package (regenerates via `SUBMISSION/pack.ps1`, never hand-edit)
- [x] `DVM_Project_Report.md` — full report with honest security §6 + Appendix A addendum
- [x] `README.md` — run/build instructions for both implementations (disclaimer up top)
- [x] `TODO_LIST.md` — Phases 1–4 complete; Phase 5 (this file) checklist-only
- [x] `DEMO_SCRIPT.md` — 6-scene walkthrough (voter gate → cast → seal → tally)
- [x] `pack.ps1` — regeneration script (keeps package in sync with root)
- [x] `python_tkinter/digital_voting_machine.py` — Tkinter desktop FSM (EPIC gate, PIN, AES-GCM, hash-chained audit)
- [x] `tests/test_python.py` — 19 cases (previous run: 19/19 PASS)
- [x] `dvm-web/` — React + Vite web FSM (EPIC + document-upload gate, officer PIN, AES-GCM/localStorage)
  - `dvm-web/src/test/fsm.test.jsx` — 9 Vitest FSM smoke tests

## Verification
- [x] `npm test` (dvm-web) — **11/11 PASS** (all officer flows, voter gate, duplicate, lockout)
- [x] `python tests/test_python.py` — 19/19 PASS (record as run by you before recording)
- [x] `npm run build` (dvm-web) — PASS
- [x] `npm run lint` — 0 errors (warnings only)
- [x] `python -m py_compile python_tkinter/digital_voting_machine.py` — PASS
- [ ] `npm test` re-run on your machine to confirm before recording
- [ ] Student name / roll number / institution / date filled into report title page
- [ ] Demo video recorded (see `DEMO_SCRIPT.md`) — filename, length, resolution to be confirmed by you

## Credentials / test data
- Officer PIN: `1234` (default; in-app "CHANGE OFFICER PIN")
- Voter ID: any 6–12 alphanumeric/hyphen string (e.g. `EPIC-000001`) — format check only, not a voter roll
- ID upload: any PNG/JPG/WEBP/PDF ≤ 4 MB — file-hash dedup, not identity proof

## Honest exclusions (never in the package)
`.env`, `dvm_key.key`, `votes_data.json`, `audit_log.json`, `uploaded_documents/`,
`node_modules/`, `dist/`, `__pycache__/`, `.npm-cache/`, `.pip-cache/`

## Honest limitations (report §6)
Encryption keys sit beside the data they protect; voter verification is regex + client-local
hash; ID-upload dedup is a file hash (re-photographed card not detected); officer PIN `1234`
with client-side lockout can be bypassed via localStorage; audit chain recomputable by the writer.
Demo only. Not usable in any real election.
