# DVM-900 — Demo Script (≈ 5 minutes)

> **Educational simulation — not a certified EVM, not for real elections.**
> Say this out loud at the start of the demo. The machine is fictional; the crypto is real but the keys sit beside the data (see report §6).

## Scene 1 — Landing (IDLE)
1. Open `http://127.0.0.1:5173`.
2. Show the animated landing: **"One Person One Ballot"** — flowing-path background, letter-spring reveal; CTAs — **START VOTING** → scrolls to ballot console; **OFFICER SIGN-IN** → opens officer drawer.
3. Point at footer: *"DVM-900 COURSE SIMULATION · NOT FOR OFFICIAL ELECTIONS"* — nothing here is real.

## Scene 2 — Voter gate (IDLE → READY)
4. A voter arrives. Keys are locked (console shows STANDBY ribbon: *"Machine in STANDBY — the election officer must arm the ballot"*).
5. Click **OFFICER SIGN-IN** → officer drawer.
6. Keys 1-2-3-4 → **ENT** → status bar flips to `STATE 02 · READY` (or type digits on the keyboard 1-2-3-4, Enter works too).

## Scene 3 — Voter flow (READY → VOTED)
7. **Step 1**: enter `EPIC-000001` → **VERIFY** → "BALLOT OPEN — ID VERIFIED"; candidate keys unlock.
8. **Step 1b** (new): upload any image/PDF ≤ 4 MB → **VERIFY** → "ID DOC ACCEPTED"; officer asks voter to present their physical card to the officer too.
9. Keys `1–5` are now live; the FSM confirm-arm also works: select candidate 02 via **click or keyboard**.
10. Click **CONFIRM SELECTION** → confirm dialog (**CAST VOTE** / CANCEL).
11. "Ballot signed — MARCUS VANCE" toast; machine auto-locks to prevent a second vote.

## Scene 4 — Officers and tally (LOCKED → RESULT)
12. Open officer drawer (**Officer sign-in** icon) → **SEAL TERMINAL & CLOSE** → confirm → `STATE 04 · LOCKED`.
13. Officer drawer → **OPEN TALLY & AUDIT REGISTER** → results spool: every recorded ballot, percent bars, WINNER chip.
14. **COPY TALLY** → JSON tally on clipboard.
15. **RETURN TO TERMINAL STANDBY** → back to STANDBY for the next demo session.

## Scene 5 — Security story (the interesting part)
16. Open devtools → Application → Local Storage — keys `dvm_votes` / `dvm_audit_log` are AES-GCM ciphertext `{v:2, iv, ct}`, not JSON.
17. Officer drawer → audit register tail — every action hash-chained; one byte edited → `AUDIT_CHAIN_TAMPERED` on next boot.
18. Run `npm test` (dvm-web) → 9/9 FSM smoke tests PASS (arm, verify, cast, duplicate, tally persistence, lockout, lockout persistence, LOCKED→RESULT→IDLE).
19. Run `python tests/test_python.py` → 19/19 PASS.

## Scene 6 — Python desktop twin
20. Launch `D:\DE Digital voting Machine\.venv\Scripts\python.exe python_tkinter\digital_voting_machine.py`.
21. Same FSM, same EPIC gate, same PIN pad. It is a Tkinter twin of the web terminal — show it runs headless in the tests.

## Not-to-claim during demo
- No real voter-duplicate prevention across devices; ID verification is regex + hash only; the document upload is a file-hash, not identity proof.
- AES-GCM means "encrypted bytes stored in localStorage", not "lawful custody of ballots".
- No VVPAT hardware, no election-authority certification, no paper audit.
