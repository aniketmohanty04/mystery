# Mystery Box — A Multi-Layered Cryptographic Puzzle Box

An interactive cybersecurity escape room puzzle built with TypeScript, Vite, semantic HTML, and modern CSS.

Designed with an **editorial forensic workstation / archival evidence terminal** aesthetic: an investigator reviewing classified digital evidence files and solving sequential layers to uncover a hidden message.

---

## Current Status: Phase 5 Implemented & Playable (All Layers 1–5 Complete)

- **Layer 1 (Cryptography):** **Implemented & Playable.** Intercepted transmission encoded with ROT-13. Classified evidence card, progressive hint disclosure, strict ASCII input normalization, SHA-256 hash validation, copy-to-clipboard, decoded badge, and explicit Continue progression.
- **Layer 2 (DOM Inspection):** **Implemented & Playable.** Live DOM Mutation puzzle. Player inspects `#evidence-seal` in DevTools Elements panel and edits `data-seal="intact"` to `data-seal="verified"`. Detected via native `MutationObserver`, verified truthfully against the central state machine without leaking answers.
- **Layer 3 (Cross-Tab Sync):** **Implemented & Playable.** Real-time multi-tab signal intercept. Dual-terminal carrier frequency alignment across browser tabs using native `BroadcastChannel` with `localStorage` storage-event fallback, heartbeat telemetry, and peer consensus.
- **Layer 4 (Temporal Logic):** **Implemented & Playable.** Incident timeline reconstruction with interactive scrubber axis and strict 90-second entropy timer. Players sequence five corrupted evidence logs by deducing hardware RTC clock drift (-60m) and EST (UTC-4) timezone skew to establish universal UTC causality.
- **Layer 5 (Final Reveal):** **Implemented & Playable.** Operation Omega — The Final Vault. Players synthesize the four forensic credentials recovered from prior investigation stages into the unified master vault key (`KNOWLEDGE-VERIFIED-SYNCHRONIZED-EV-955`). Features an interactive dossier matrix, quadrant token assembly, rotating mechanical blast door animation, and a comprehensive classified case debriefing screen.

---

## Architectural Principles

1. **Frontend-Only by Design:** No backend, Express server, database, or API routes. Runs entirely in modern browsers via native APIs (`Web Crypto API`, `MutationObserver`, `sessionStorage`, `DOM`).
2. **Central State Machine (`state-machine.ts`):** Single source of truth for puzzle progression.
   - Four explicit layer statuses: `'locked'`, `'unlocked'`, `'active'`, and `'solved'`.
   - `currentLayer` is strictly typed as `LayerId | null`. Points to `'crypto'` initially, advances to `'dom-inspect'` after Layer 1, and becomes `null` once Layer 2 is solved (since Layer 3 is unlocked but pending Phase 3).
   - Progression is strictly sequential; out-of-order attempts are rejected.
   - Guarded against concurrent submissions and in-flight reset races with generation counters.
   - Fully injectable dependencies (`store`, `validateAnswer`, `implementedLayers`) for deterministic testing; each instance owns its own event bus.
   - `solve()` never rejects: it returns `'accepted' | 'incorrect' | 'busy' | 'cancelled' | 'error'`. `'error'` means validation could not run (state untouched, retry is safe).
3. **Storage Abstraction & Session Persistence (`storage.ts`):**
   - Game progression state is isolated behind the `StateStore` interface (`load()`, `save()`, `clear()`), allowing future phases (such as Phase 3 cross-tab sync) to plug in `BroadcastChannel` or `localStorage` without altering the core state machine.
   - Strict schema versioning (`{ version: 1, progression: [...] }`).
   - Validates linear progression shape (prefix of implemented solved layers, exactly one boundary active/unlocked layer, followed by locked layers). Automatically promotes stored `unlocked` layers when newly implemented in future phases.
4. **Answer Normalization Pipeline (`answer-validator.ts`):**
   - Applies strict normalization in order:
     1. `trim()` leading/trailing whitespace.
     2. Collapse runs of permitted separators (`[\s_\-\u2010\u2011\u2013\u2014]+`) into a single `-`, and strip leading/trailing `-`.
     3. Reject any character outside ASCII `[A-Za-z0-9-]` before case folding. (NFKC is deliberately not applied to letters to reject unicode lookalikes such as dotless `ı`, long `ſ`, Kelvin sign, or fullwidth characters).
     4. `toUpperCase()`, then SHA-256 compare against embedded digests via native `crypto.subtle.digest`.
5. **Success-Feedback Lifecycle & Focus Management:**
   - Solving a layer immediately marks it solved and updates the progress indicator.
   - The solved layer card remains mounted to display success feedback (badges, decrypted status) alongside a visible **Continue** button.
   - Activating Continue unmounts the card, renders the next layer, and transfers keyboard focus to the new layer's heading (`tabindex="-1"`).

---

## Security Disclosure & Honest Limitations

This is an educational frontend challenge for demonstration and codeathon purposes:
- SHA-256 hashes are embedded in the client JavaScript bundle. Anyone inspecting the minified sources or debugger can find the hash or manipulate local storage.
- Layer 2 intentionally requires using browser DevTools to inspect and modify an HTML attribute (`data-seal`).
- In Layer 2, the expected attribute value (`verified`) is evaluated client-side. The DOM comparison and state validator both enforce strict ASCII normalization.
- Answer checking uses the Web Crypto API, which browsers only expose on HTTPS or `localhost`. On a plain-HTTP origin (for example `http://192.168.x.x`) the game shows a "validation unavailable" message instead of hanging; serve it over HTTPS or `localhost` to play.
- `sessionStorage` is scoped per-tab; the storage interface introduced in Phase 2 prepares the architecture for cross-tab communication in Phase 3.

---

## Setup & Running

### Prerequisites
- Node.js: `^22.22.2 || ^24.15.0 || >=26` (verified on Node.js `v22.22.2`)
- npm: `10+` (verified on npm `10.9.7`)
- A browser context that exposes Web Crypto: serve over **HTTPS or `localhost`** (see Security Disclosure)

### Installation
```bash
npm install
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Launch local Vite development server (http://localhost:5173) |
| `npm test` | Run all 161 unit & lifecycle tests using Vitest |
| `npm run typecheck` | Run TypeScript type checks (`tsc --noEmit`) on `src/` |
| `npm run typecheck:test` | Run TypeScript type checks (`tsc -p tsconfig.test.json --noEmit`) on `src/` and `tests/` |
| `npm run build` | Run TypeScript checks and bundle for production (`tsc && vite build`) |
| `npm run preview` | Preview production build locally |
| `npm run package` | Build `mystery-box.zip` from the **committed** files via `git archive` (no `node_modules/`, `dist/` or `.git/`). Refuses to run on a dirty tree or outside a git repo, so nothing is silently left out |

---

## Puzzle Solutions

<details>
<summary><strong>SPOILERS — For judges and evaluators only (Click to expand)</strong></summary>

### Layer 1: Cryptography
- **Ciphertext:** `ZLFGREL-OBK-BCRAF-JVGU-XABJYRQTR`
- **Clue:** "The alphabet contains 26 letters. The shift is exactly half its length." (Shift = 13, ROT-13)
- **Plaintext / Canonical Answer:** `MYSTERY-BOX-OPENS-WITH-KNOWLEDGE`
- **Accepted Formats:** Any case, spaces instead of hyphens (`MYSTERY BOX OPENS WITH KNOWLEDGE`), underscores, en-dashes (`–`), em-dashes (`—`), U+2010, U+2011, and mixed separator runs.

### Layer 2: DOM Inspection
- **Target Element:** `<div id="evidence-seal" data-seal="intact">`
- **Interaction:** Open browser DevTools (<kbd>F12</kbd> or right-click → *Inspect*), locate `#evidence-seal` in the **Elements** tree, and change `data-seal="intact"` to `data-seal="verified"`.
- **Accepted Value:** `verified` (case-insensitive, trimmed, strict ASCII).
- **Progress:** Displays neutral `SEAL: CHECKING`, validates with the state machine, renders `SEAL: VERIFIED`, and presents the Continue button to unlock Layer 3.

### Layer 3: Cross-Tab Sync
- **Mechanic:** Open the puzzle URL in a second browser window or tab. The two terminals handshake over `BroadcastChannel` (or `localStorage` fallback).
- **Carrier Alignment:** Node Alpha transmits `SIGNAL`, and Node Beta transmits `SYNCHRONIZED`.
- **Accepted Answer:** `SIGNAL-SYNCHRONIZED` (case-insensitive, trimmed).

### Layer 4: Temporal Logic
- **Mechanic:** Sequence five forensic evidence logs in chronological order by normalizing to Universal Coordinated Time (UTC).
- **Key Deductions:**
  1. `EV-814` logged `01:55 UTC`, but suffered a `-60 minute` hardware RTC drift (actual: `02:55 UTC`).
  2. `EV-127` logged `23:22 EST` (UTC-4); converted to UTC standard: `23:22 + 4h = 03:22 UTC`.
- **Chronological Sequence:**
  1. `EV-302` (02:15 UTC) — Perimeter Optical Fence Breach
  2. `EV-814` (02:55 UTC true) — Terminal Console Authentication Override
  3. `EV-409` (03:08 UTC) — Data Vault Archive Exfiltration
  4. `EV-127` (03:22 UTC true) — Evidence Locker Magnetic Seal Severed
  5. `EV-955` (03:45 UTC) — Emergency Facility Lockdown Initiated
- **Accepted Answer:** `EV-302-EV-814-EV-409-EV-127-EV-955` (case-insensitive, spaces/underscores accepted).

</details>
