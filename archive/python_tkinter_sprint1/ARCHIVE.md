# Archive

This folder holds the sprint-1 Tkinter reference implementation of the DVM-900.

It is retained for historical context only — the **submission** is the React/Vite web implementation (`dvm-web/`).

## Contents (frozen, do not run or edit)
- `python_tkinter_sprint1/digital_voting_machine.py` — sprint-1 single-file Tkinter build: officer PIN, EPIC gate, AES-256-GCM-at-rest, hash-chained audit log, multi-screen state machine (IDLE → READY → VOTED → LOCKED → RESULT). Some claims in comments/UX were aspirational; this is a course prototype, not a certified EVM.

## Why it is here and not gone
- Tests reference the original layout; moving keeps history visible without drifting two codebases.
- Any future bugfix must go into `dvm-web/`, not here.

## Known issues (still true in sprint-1 code)
- Key (`dvm_key.key`) sits next to the data, so AES-GCM is obfuscation, not custody.
- EPIC verification is a regex + client-side hash list; no voter roll.
- Officer PIN `1234` ships as default and is visible in source.
- Hash-chained audit is recomputable by anyone who can write the file.
- Not a real EVM; no paper trail; no election authority certification.

See `DVM_Project_Report.md` (Section 6, Residual Risks) for the catalogue.
