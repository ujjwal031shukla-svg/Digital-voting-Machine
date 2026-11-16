# dvm-web — Digital Voting Machine (Web, React + Vite)

> **Educational simulation — not for real elections.**
> Not a certified electronic voting machine. See the repository root `README.md` and `DVM_Project_Report.md` (Security Limitations) for the honest breakdown.

React + Vite implementation of the DVM-900 course prototype: 5-state FSM, officer PIN, voter-ID gate with document upload, browser-local encrypted persistence, and a hash-chained audit log.

## Setup

```bash
npm install
npm run dev     # http://127.0.0.1:5173
npm run build   # production build → dist/
npm run lint    # oxlint
npm test        # vitest — FSM smoke tests (9 tests)
```

If `npm install` fails with `ENOSPC`, the C: drive on this machine is full — free space or point the npm cache at D: (`--cache "D:\path\to\cache"`).

## Structure

```
src/
├── App.tsx                       # FSM + all screens
├── main.tsx                      # entry + error boundary
├── index.css                     # design system (dark/light)
├── components/
│   ├── flow-button.tsx           # animated CTA
│   ├── kinetic-grid.jsx          # canvas grid background (paused on landing)
│   └── ui/
│       ├── background-paths.tsx  # landing background (CSS/Motion)
│       ├── cinematic-hero.tsx    # unused — pending removal per TODO
│       └── button.tsx            # shadcn Button (cva + radix-slot)
└── lib/utils.ts                  # cn() class-merge helper
```

## Honest scope
All "security" here is client-side demonstration logic. The honest details:
- AES-256-GCM key sits next to the ciphertext in localStorage (obfuscation, not encryption)
- Voter ID verification is regex-only; the uploaded document is checked by file hash (a re-photographed card slips through)
- Officer PIN `1234` and the 3-attempt lockout can be bypassed via localStorage edits

Not for real elections. Ever.
