# Mystery Box — Digital Forensics Workstation & Cryptographic Investigation

[![Live Demo](https://img.shields.io/badge/Demo-Vercel%20Live-10b981?style=for-the-badge&logo=vercel)](https://mystery-one-flax.vercel.app/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-Repository-f59e0b?style=for-the-badge&logo=github)](https://github.com/aniketmohanty04/mystery)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8%2B-3178c6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646cff?style=for-the-badge&logo=vite)](https://vitejs.dev/)
[![Vitest](https://img.shields.io/badge/Tests-194%20Passing-10b981?style=for-the-badge&logo=vitest)](https://vitest.dev/)

An interactive, multi-layered cybersecurity investigation puzzle built with **TypeScript**, **Vite**, semantic **HTML5**, and modern **CSS3**.

The application is styled as a **Classified Digital Forensics Workstation & Security Operations Center (SOC) Console**: an investigator analyzing intercepted SIGINT transmissions, inspecting browser runtime DOM structures, synchronizing cross-tab carrier telemetry, scrubbing an entropy-destabilized chronological timeline, and synthesizing evidence credentials to unlock a physical blast door vault.

---

## 🌐 Live Deployments & Repository

- **Live Application:** [https://mystery-one-flax.vercel.app/](https://mystery-one-flax.vercel.app/)
- **Source Code:** [https://github.com/aniketmohanty04/mystery](https://github.com/aniketmohanty04/mystery)

---

## 🔍 Investigation Status: All 5 Stages Implemented & Playable

| Stage | Ref | Codename | Domain | Status |
|:---:|:---:|---|---|:---:|
| **01** | `REF #001` | **Encrypted Transmission** | Cryptographic Decryption (ROT-13) | **Playable & Verified** |
| **02** | `REF #002` | **Digital Evidence Seal** | Browser Forensics & DOM Inspection | **Playable & Verified** |
| **03** | `REF #003` | **Cross-Tab Synchronization** | Real-Time Multi-Terminal Telemetry | **Playable & Verified** |
| **04** | `REF #004` | **Temporal State Scrubber** | Incident Chronology & Entropy Timer | **Playable & Verified** |
| **05** | `REF #005` | **The Final Vault** | Multi-Quadrant Evidence Synthesis | **Playable & Verified** |

### Stage Breakdown

1. **Stage 01 — Encrypted Transmission (`crypto-layer.ts`):**
   - **Scenario:** A suspect device broadcast an intercepted radio transmission on frequency `142.85 MHz`.
   - **Mechanic:** ROT-13 symmetric substitution cipher.
   - **Features:** Classified evidence card, progressive hint disclosure, strict ASCII input normalization, Web Crypto SHA-256 hash validation, copy-to-clipboard, authenticated plaintext banner (`✓ DECODED PLAINTEXT`), and explicit Continue button progression.

2. **Stage 02 — Digital Evidence Seal (`dom-layer.ts`):**
   - **Scenario:** Access to evidence locker `#849-B` is locked behind an active tamper-evident digital seal with physical inputs disabled by policy.
   - **Mechanic:** Live DOM mutation inspection. The player opens browser DevTools (Elements panel), inspects `<div id="evidence-seal">`, and mutates `data-seal="intact"` to `data-seal="verified"`.
   - **Features:** Native `MutationObserver` lifecycle, instant DOM mutation feedback, strict ASCII normalization, and central state machine clearance validation without leaking answers.

3. **Stage 03 — Cross-Tab Synchronization (`cross-tab-layer.ts`):**
   - **Scenario:** Decryption telemetry indicates the carrier frequency has been split across entangled channels.
   - **Mechanic:** Real-time multi-terminal pairing. Opening the puzzle URL in a second browser window or tab establishes dual-terminal synchronization.
   - **Features:** Dual-console visual layout (Station Alpha vs Station Beta), native `BroadcastChannel` with fallback to `window.localStorage` storage events, tab peer discovery, carrier beacon exchange, heartbeat monitor, and synchronized waveform key assembly (`SIGNAL-SYNCHRONIZED`).

4. **Stage 04 — Temporal State Scrubber (`temporal-layer.ts`):**
   - **Scenario:** Station forensic servers recovered five critical incident records detailing a perimeter intrusion, but hardware RTC clock drift and cross-station timezone offsets corrupted the timestamps.
   - **Mechanic:** Incident chronology reconstruction under a 90-second visual entropy timer. Players sequence five corrupted events by deducing a `-60 minute` dead CMOS battery drift and an `EST (UTC-4)` timezone offset into a unified UTC causality timeline.
   - **Features:** Visual entropy gauge with millisecond timer and progressive 4-tier stability degradation (Coherent → Drift → Interference → Critical), 5-slot scrubber rail with active event inspector (Raw vs UTC vs Drift), keyboard reordering, drag-and-drop, and diagnostic feedback.

5. **Stage 05 — The Final Vault (`final-vault-layer.ts`):**
   - **Scenario:** Operation Omega. Perimeter and forensic systems have been breached, but the master station vault remains locked by a heavy physical blast door and an automated cryptographic interlock.
   - **Mechanic:** Multi-quadrant credential synthesis. The player extracts four tokens discovered across prior stages (`KNOWLEDGE`, `VERIFIED`, `SYNCHRONIZED`, `EV-955`) and synthesizes the unified Master Vault Key.
   - **Features:** Interactive dossier synthesis matrix, 4 independent quadrant slot monitors (`0/4` to `4/4`), full validation bypass protection (clicking "Assemble" reveals dossiers only and never marks solved), mechanical blast door opening animation with rotating dial and retracting radial bolts, and a classified case debriefing summary table.

---

## 🎨 Visual Identity & Workstation UI

The application adheres to a **Security Operations Center (SOC) & Digital Forensics Console** aesthetic:

- **Deep Graphite Backgrounds:** `#0a0c10` base canvas with layered `#11141b` and `#171b23` console panels.
- **Subtle CAD/CRT Texture:** 28px dot-matrix grid (`rgba(35, 41, 54, 0.5)`) providing tactile monitor depth.
- **Forensic Amber Accent (`#f59e0b`):** Active telemetry, evidence highlights, focus outlines, and primary action controls.
- **Restrained Emerald Green (`#10b981`):** Reserved exclusively for verified states, authenticated hashes, and sealed artifacts.
- **Muted Crimson (`#ef4444`):** Security alerts, clock drift warnings, entropy collapse, and input rejections.
- **Classified Header Banner:** Top classification strip (`RESTRICTED // INCIDENT-RESPONSE // CASE 409-B`).
- **Telemetry Shell & Navigation:** Dynamic session clearance indicator (`LEVEL X/5`), verified stage stamps (`[VERIFIED]`), emergency purge/reset button, and live persistent status strip (`OPERATIONAL // AUDIT ACTIVE`).

---

## ⚙️ Architectural & Engineering Principles

1. **Frontend-Only by Design:**
   - Zero backend server, Express routes, external databases, or third-party cloud SDKs.
   - Operates 100% in-browser using standard web platform APIs: `Web Crypto API`, `MutationObserver`, `BroadcastChannel`, `Storage API`, and semantic HTML.

2. **Authoritative State Machine (`src/core/state-machine.ts`):**
   - Single authoritative source of truth for puzzle progression.
   - Four explicit layer statuses: `'locked'`, `'unlocked'`, `'active'`, and `'solved'`.
   - Progression is strictly linear; out-of-order stage skips are rejected.
   - Guarded against concurrent submissions and in-flight reset races with generation counters.
   - Fully injectable dependencies (`store`, `validateAnswer`, `implementedLayers`) for deterministic unit and integration testing.
   - `solve()` never rejects; returns structured results: `'accepted' | 'incorrect' | 'busy' | 'cancelled' | 'error'`.

3. **Storage Abstraction & Schema Versioning (`src/core/storage.ts`):**
   - Progression persistence is abstracted behind the `StateStore` interface (`load()`, `save()`, `clear()`).
   - Strict schema versioning (`{ version: 1, progression: [...] }`) with defensive shape validation.
   - Reset button cleans persisted storage, unmounts active resources, and returns the game to Stage 1.

4. **Strict Answer Normalization Pipeline (`src/core/answer-validator.ts`):**
   - Applies deterministic sanitization in sequence:
     1. Trim leading/trailing whitespace.
     2. Collapse runs of permitted separators (`[\s_\-\u2010\u2011\u2013\u2014]+`) into a single hyphen `-`.
     3. Reject any character outside ASCII `[A-Za-z0-9-]` before case folding (deliberately avoids NFKC to reject Unicode homoglyphs and spoofing).
     4. `toUpperCase()`, then SHA-256 compare against embedded digests via native `crypto.subtle.digest`.

5. **Success-Feedback Lifecycle & Focus Management:**
   - Solving a stage immediately marks it verified and updates the navigation sidebar.
   - The solved layer card remains mounted with visual success badges and decoded artifacts alongside an explicit **Continue** button.
   - Activating Continue cleans up listeners, mounts the next stage, and shifts keyboard focus to the new heading (`tabindex="-1"`).

6. **Accessibility & Responsive Layout:**
   - Semantic landmarks: `<header>`, `<main>`, `<aside>`, `<footer>`, `<nav>`, `<article>`.
   - Complete keyboard accessibility with visible amber focus rings (`:focus-visible`).
   - `prefers-reduced-motion: reduce` fully disables timer pulsing, blast door rotation, scanlines, and CSS transitions.
   - Responsive layouts tested across multi-monitor widescreen desktops, standard laptops, tablets, and mobile devices.

---

## 📁 Project Structure

```
mystery/
├── index.html                   # Application entry HTML with classified shell & telemetry
├── package.json                 # Project configuration & scripts
├── tsconfig.json                # TypeScript application configuration
├── tsconfig.test.json           # TypeScript test configuration (includes tests/)
├── vite.config.ts               # Vite bundler configuration
├── src/
│   ├── main.ts                  # Application entry point, layer mounting & navigation
│   ├── core/                    # Authoritative game engine
│   │   ├── answer-validator.ts  # ASCII normalization & SHA-256 hashing
│   │   ├── constants.ts         # Stage metadata, titles, and IDs
│   │   ├── event-bus.ts         # Type-safe internal pub/sub event bus
│   │   ├── state-machine.ts     # Authoritative progression state machine
│   │   ├── storage.ts           # StateStore interface & localStorage persistence
│   │   └── types.ts             # Domain type definitions
│   ├── layers/                  # Puzzle stage implementations
│   │   ├── crypto-layer.ts      # Stage 01: ROT-13 SIGINT decryption
│   │   ├── dom-layer.ts         # Stage 02: MutationObserver evidence seal
│   │   ├── cross-tab-layer.ts   # Stage 03: Dual-terminal BroadcastChannel sync
│   │   ├── temporal-layer.ts    # Stage 04: Scrubber timeline & 90s entropy timer
│   │   └── final-vault-layer.ts # Stage 05: Master vault interlock & synthesis matrix
│   ├── sync/                    # Cross-tab communication subsystem
│   │   ├── cross-tab-channel.ts # BroadcastChannel wrapper with fallback
│   │   ├── cross-tab-manager.ts # Peer discovery, beacons, and signal exchange
│   │   ├── session.ts           # Session identifier management
│   │   └── transport.ts         # Transport layer abstraction
│   ├── styles/                  # Modular stylesheet architecture
│   │   ├── tokens.css           # Design tokens (graphite, amber, emerald, spacing)
│   │   ├── base.css             # Reset, typography, grid texture, scrollbars
│   │   ├── layout.css           # Header, sidebar, footer strip, responsive split
│   │   └── components.css       # Cards, terminals, scrubber, blast door, badges
│   └── utils/
│       └── crypto-utils.ts      # SHA-256 digest calculation helpers
└── tests/
    └── unit/                    # 11 Vitest test suites (194 tests)
        ├── answer-validator.test.ts
        ├── crypto-layer.test.ts
        ├── crypto-layer-dom.test.ts
        ├── dom-layer.test.ts
        ├── cross-tab-layer.test.ts
        ├── sync-session.test.ts
        ├── temporal-layer.test.ts
        ├── final-vault-layer.test.ts
        ├── state-machine.test.ts
        ├── storage.test.ts
        └── lifecycle.test.ts
```

---

## 🛠️ Setup & Running

### Prerequisites
- **Node.js**: `^22.22.2 || ^24.15.0 || >=26` (tested on Node.js `v22.22.2`)
- **npm**: `10+` (tested on npm `10.9.7`)
- **Browser Context**: Modern Chromium, Firefox, or Safari supporting the `Web Crypto API` (served over **HTTPS or `localhost`**).

### Installation
```bash
git clone https://github.com/aniketmohanty04/mystery.git
cd mystery
npm install
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Launch local development server with HMR at `http://localhost:5173` |
| `npm test` | Run all 194 unit and lifecycle tests with Vitest |
| `npm run test:watch` | Run Vitest in interactive watch mode |
| `npm run typecheck` | Run TypeScript check (`tsc --noEmit`) on `src/` |
| `npm run typecheck:test` | Run TypeScript check on both `src/` and `tests/` |
| `npm run build` | Compile TypeScript and bundle production assets to `dist/` |
| `npm run preview` | Serve the production build locally for verification |
| `npm run package` | Generate a clean `mystery-box.zip` archive via `git archive` |

---

## 🧪 Verification & Test Suite

The project includes an exhaustive suite of **194 unit and integration tests** across **11 test suites** with a 100% pass rate:

```
 RUN  v5.0.5 C:/Users/ANIKET/OneDrive/Desktop/mystery

 ✓ tests/unit/crypto-layer.test.ts (16 tests)
 ✓ tests/unit/answer-validator.test.ts (30 tests)
 ✓ tests/unit/sync-session.test.ts (22 tests)
 ✓ tests/unit/state-machine.test.ts (25 tests)
 ✓ tests/unit/storage.test.ts (19 tests)
 ✓ tests/unit/cross-tab-layer.test.ts (6 tests)
 ✓ tests/unit/final-vault-layer.test.ts (17 tests)
 ✓ tests/unit/crypto-layer-dom.test.ts (13 tests)
 ✓ tests/unit/lifecycle.test.ts (5 tests)
 ✓ tests/unit/dom-layer.test.ts (16 tests)
 ✓ tests/unit/temporal-layer.test.ts (25 tests)

 Test Files  11 passed (11)
      Tests  194 passed (194)
```

---

## 🔐 Security Disclosure & Architecture Notes

- **Client-Side Environment:** This application is designed as an educational, client-side digital forensics simulation. SHA-256 hashes are evaluated in client JavaScript using the native `Web Crypto API`.
- **Runtime Integrity:** Stage 02 intentionally requires inspecting and modifying the live DOM attribute `data-seal` in DevTools.
- **Web Crypto Constraints:** `crypto.subtle` is restricted by browser security policies to secure origins (`https://` or `localhost`). If served over plain HTTP on an external IP, a clear "validation unavailable" status is displayed instead of hanging.

---

## 🗝️ Puzzle Solutions Guide

<details>
<summary><strong>SPOILERS — Evaluator Reference (Click to expand)</strong></summary>

### Stage 01: Cryptographic Decryption
- **Ciphertext:** `ZLFGREL-OBK-BCRAF-JVGU-XABJYRQTR`
- **Deduction:** The hint indicates a shift equal to half the alphabet (13 positions forward, ROT-13).
- **Plaintext Key:** `MYSTERY-BOX-OPENS-WITH-KNOWLEDGE`
- **Recovered Token:** `KNOWLEDGE`
- **Accepted Formats:** Any case, spaces instead of hyphens (`MYSTERY BOX OPENS WITH KNOWLEDGE`), underscores, en-dashes, or em-dashes.

### Stage 02: Digital Evidence Seal
- **Target DOM Node:** `<div id="evidence-seal" data-seal="intact">`
- **Interaction:** Open browser DevTools (<kbd>F12</kbd> or right-click → *Inspect*), locate `#evidence-seal` in the Elements inspector, and edit `data-seal="intact"` to `data-seal="verified"`.
- **Recovered Token:** `VERIFIED`
- **Accepted Value:** `verified` (case-insensitive, trimmed ASCII).

### Stage 03: Cross-Tab Signal Intercept
- **Interaction:** Open the puzzle in a second browser window or tab.
- **Mechanic:** Tab Alpha emits carrier signal `SIGNAL`, while Tab Beta synchronizes with `SYNCHRONIZED`.
- **Synchronized Key:** `SIGNAL-SYNCHRONIZED`
- **Recovered Token:** `SYNCHRONIZED`

### Stage 04: Temporal State Scrubber
- **Mechanic:** Arrange five incident records in chronological order by normalizing all raw timestamps to Universal Coordinated Time (UTC).
- **Forensic Deductions:**
  1. `EV-814` logged `01:55 UTC`, but suffered a `-60 minute` hardware RTC drift (actual: `02:55 UTC`).
  2. `EV-127` logged `23:22 EST` (UTC-4); converted to UTC standard: `23:22 + 4h = 03:22 UTC`.
- **Chronological Sequence:**
  1. `EV-302` (02:15 UTC) — Optical Fence Perimeter Breach
  2. `EV-814` (02:55 UTC true) — Terminal Console Authentication Override
  3. `EV-409` (03:08 UTC) — Data Vault Archive Exfiltration
  4. `EV-127` (03:22 UTC true) — Evidence Locker Magnetic Seal Severed
  5. `EV-955` (03:45 UTC) — Emergency Facility Lockdown Initiated
- **Timeline Key:** `EV-302-EV-814-EV-409-EV-127-EV-955`
- **Recovered Token:** `EV-955`

### Stage 05: The Final Vault (Operation Omega)
- **Mechanic:** Synthesize the four discovered quadrant tokens into the unified Master Vault Key.
- **Synthesized Quadrants:**
  - `QUADRANT 01 (CRYPTO)`: `KNOWLEDGE`
  - `QUADRANT 02 (DOM SEAL)`: `VERIFIED`
  - `QUADRANT 03 (CARRIER)`: `SYNCHRONIZED`
  - `QUADRANT 04 (CHRONO)`: `EV-955`
- **Master Vault Key:** `KNOWLEDGE-VERIFIED-SYNCHRONIZED-EV-955`
- **Result:** Blast door interlock disengages, radial bolts retract, and the full classified case debriefing dossier is unlocked.

</details>

---

## 📜 License

Created for educational demonstrations, coding evaluations, and cybersecurity puzzle challenges.
