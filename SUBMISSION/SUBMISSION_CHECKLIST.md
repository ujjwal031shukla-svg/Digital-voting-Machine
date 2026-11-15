# DVM — Submission Checklist (2026-11-14)

**Student:** [Student Name]  |  **Course:** Digital Electronics / Software Engineering
**Project:** Digital Voting Machine (DVM-900, course simulation)
**Date:** 2026-11-14

> Educational simulation — not a certified EVM, not for real elections.

## Contents of this package (regenerate via `SUBMISSION/pack.ps1`, never hand-edit)
- [x] `DVM_Project_Report.md` — full 8-section report (Scope & Limitations §1.3, Assumptions §1.4, Known Issues §1.5, Appendix A Security Addendum)
- [x] `README.md` — run/build instructions for both implementations (disclaimer up top)
- [x] `TODO_LIST.md` — fresh to-do list (Phases 1–6, 2026-11-14)
- [x] `python_tkinter/digital_voting_machine.py` — Python/Tkinter desktop implementation (FSM, voter-ID gate, AES-GCM at rest, hash-chained audit)
- [x] `dvm-web/` — React + Vite paper-civic web terminal (source only; no node_modules, no build)
- [x] `tests/test_python.py` — 19 test cases (previous run: 19/19 PASS)
- [x] `pack.ps1` — regeneration script (keeps this package in sync with root)
- [x] `DEMO_SCRIPT.md` — demo walk-through

## Pre-submission verification
- [x] `python -m py_compile python_tkinter/digital_voting_machine.py` — PASS
- [x] `python tests/test_python.py` — 19/19 PASS (report as recorded on 2026-11-12)
- [x] `npm run build` (dvm-web) — PASS on this machine after `.npmrc` cache fix (D: drive)
- [x] `npm run lint` — 0 errors (warnings only: unused vars, one hooks-deps note)
- [ ] Student name / roll number / institution / date filled into report title page
- [ ] Demo video recorded (see DEMO_SCRIPT.md)

## Credentials / test data
- **Officer PIN:** `1234` (default; change in-app via "CHANGE OFFICER PIN")
- **Voter IDs:** any 6–12 alphanumeric/hyphen string (e.g. `EPIC-000001`) — format-check only, not a real voter roll
- **ID uploads:** any PNG/JPG/WEBP/PDF ≤ 4 MB — checked by file hash, not identity

## Honest exclusions (never in the package)
`.env`, `dvm_key.key`, `votes_data.json`, `audit_log.json`, `uploaded_documents/`,
`node_modules/`, `dist/`, `__pycache__/`, `.npm-cache/`, `.pip-cache/`

## Honest limitations (see report Section 6 for the full list)
Encryption keys sit beside the data they protect; voter verification is a regex plus a
client-side unique-ID list; the "tamper-evident" audit chain can be recomputed by anyone
who can write the file; officer PIN is `1234` with a client-side lockout. Demo only.
