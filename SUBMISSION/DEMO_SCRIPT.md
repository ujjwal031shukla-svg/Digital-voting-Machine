# DVM-900 — Demo Script (≈ 5 minutes)

## Scene 1 — Landing (IDLE)
1. Open the web terminal at `http://127.0.0.1:5173`.
2. Show the cinematic landing: "One person. One ballot." CTAs — **START VOTING** / **OFFICER SIGN-IN**.
3. Note the KineticGrid background, Paper-civic design, live audit chip ("POLLS OPEN · TAMPER OK").

## Scene 2 — Officer auth (IDLE → READY)
4. Click **OFFICER SIGN-IN** → officer drawer opens.
5. Tap keys 1-2-3-4 → **ENTER** → session armed (toast: "Officer authenticated — ballot armed").
6. Click **RELEASE NEXT BALLOT** (or navigate to READY tab) → ACTIVE BALLOT screen appears.

## Scene 3 — Voter flow (READY → VOTED)
7. Point at STEP 1: enter `EPIC-000001` → **VERIFY** → keys unlock ("BALLOT OPEN — ID VERIFIED").
8. Select candidate 02 (highlight ring + stamp circle fill).
9. Click **CONFIRM SELECTION** → confirmation modal → confirm.
10. RECORDED stamp appears; VVPAT slip concept shown; auto-returns to IDLE after 5s. Attempt to vote again →
    blocked ("One vote per session" / duplicate ID rejected at next ballot).

## Scene 4 — Results (LOCKED → RESULT)
11. Open officer drawer → **SEAL TERMINAL & CLOSE** → confirm → LOCKED screen.
12. Officer drawer → **OPEN TALLY & AUDIT REGISTER** → results spool shows real vote counts + WINNER chip.
13. **COPY TALLY** → JSON summary copied to clipboard.

## Scene 5 — Security story
14. Audit register (officer drawer, last entries) — every action hash-chained.
15. Show `dvm_votes`/`dvm_audit_log` in localStorage devtools — values are AES-GCM ciphertext, not JSON.
16. MySQL: `SELECT * FROM dvm_votes;` → mirror row present (server 3306).

## Scene 6 — Python desktop twin
17. Launch `D:\DE Digital voting Machine\.venv\Scripts\python.exe python_tkinter\digital_voting_machine.py`.
18. Same FSM; voter-ID gate; officer PIN; vote confirm; hash-chained audit; encrypted votes_data.json.
19. `python tests/test_python.py` → 19/19 PASS.
