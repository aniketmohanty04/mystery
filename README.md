# Mystery Box — A Multi-Layered Cryptographic Puzzle Box

An interactive cybersecurity escape room puzzle built with TypeScript, Vite, semantic HTML, and modern CSS.

Designed with an **editorial forensic workstation / archival evidence terminal** aesthetic: an investigator reviewing classified digital evidence files and solving sequential layers to uncover a hidden message.

---

## Current Status: Phase 2 Implemented

- **Layer 1 (Cryptography):** **Implemented & Playable.** Intercepted transmission encoded with ROT-13. Classified evidence card, progressive hint disclosure, input normalization, SHA-256 hash validation, copy-to-clipboard, and decoded badge.
- **Layer 2 (DOM Inspection):** **Implemented & Playable.** Live DOM Mutation puzzle. Player inspects `#evidence-seal` in DevTools Elements panel and edits `data-seal="intact"` to `data-seal="verified"`. Detected via native `MutationObserver`.
- **Layer 3 (Cross-Tab Sync):** **Unlocked** upon solving Layer 2, but mechanics are pending Phase 3 approval. Displayed with a clear "Stage unlocked, implementation pending" state.
- **Layers 4–5:** **Locked.** Unimplemented.

---

## Architectural Principles

1. **Frontend-Only by Design:** No backend, Express server, database, or API routes. Runs entirely in modern browsers via native APIs (`Web Crypto API`, `MutationObserver`, `sessionStorage`, `DOM`).
2. **Central State Machine (`state-machine.ts`):** Single source of truth for puzzle progression.
   - Four explicit layer statuses: `'locked'`, `'unlocked'`, `'active'`, and `'solved'`.
   - `currentLayer` is strictly typed as `LayerId | null`. Points to `'crypto'` initially, advances to `'dom-inspect'` after Layer 1, and becomes `null` once Layer 2 is solved (since Layer 3 is unlocked but pending Phase 3).
   - Progression is strictly sequential; out-of-order attempts are rejected.
   - Guarded against concurrent submissions (`isSolving` lock).
3. **Session Persistence with Sanitization (`storage.ts`):** State is stored in `sessionStorage`. On page refresh, state is parsed and validated for structural ordering and linear progression. Any forged `'active'` status for unimplemented layers is automatically demoted to `'unlocked'`.
4. **Answer Validation (`answer-validator.ts`):** Input is normalized (`trim()` + `toUpperCase()`) and compared against a pre-computed SHA-256 hash using `crypto.subtle.digest`.

---

## Security Disclosure & Honest Limitations

This is an educational frontend challenge for demonstration and codeathon purposes:
- SHA-256 hashes are embedded in the client JavaScript bundle. Anyone inspecting the minified sources or debugger can find the hash or manipulate local `sessionStorage`.
- Layer 2 intentionally requires using browser DevTools to inspect and modify an HTML attribute (`data-seal`).
- This design demonstrates browser runtime inspection and the `MutationObserver` API, rather than attempting to enforce an impossible client-side security boundary.

---

## Setup & Running

### Prerequisites
- Node.js 18+ (tested on Node.js v24.20.0)
- npm 9+ (tested on npm 11.19.0)

### Installation
```bash
npm install
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Launch local Vite development server (http://localhost:5173) |
| `npm test` | Run all 71 unit tests using Vitest |
| `npm run build` | Run TypeScript type checks (`tsc`) and bundle for production (`vite build`) |
| `npm run preview` | Preview production build locally |

---

## Puzzle Solutions (For Judges & Evaluators)

### Layer 1: Cryptography
- **Ciphertext:** `ZLFGREL-OBK-BCRAF-JVGU-XABJYRQTR`
- **Clue:** "The alphabet contains 26 letters. The shift is exactly half its length." (Shift = 13, ROT-13)
- **Plaintext / Accepted Answer:** `MYSTERY-BOX-OPENS-WITH-KNOWLEDGE`

### Layer 2: DOM Inspection
- **Target Element:** `<div id="evidence-seal" data-seal="intact">`
- **Interaction:** Open browser DevTools (<kbd>F12</kbd> or right-click → Inspect), find `#evidence-seal`, and change `data-seal="intact"` to `data-seal="verified"`.
- **Accepted Value:** `verified` (case-insensitive, trimmed)
