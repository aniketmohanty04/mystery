import type { PuzzleLayer, LayerId, SolveResult } from '../core/types.js';
import { stateMachine } from '../core/state-machine.js';
import { VALIDATION_UNAVAILABLE_MESSAGE } from '../core/constants.js';
import { normalizeAnswer } from '../core/answer-validator.js';

export interface EvidenceDossier {
  stageNumber: string;
  layerId: LayerId;
  ref: string;
  title: string;
  category: string;
  evidenceText: string;
  directive: string;
  token: string;
  quadrant: number;
}

export const EVIDENCE_DOSSIERS: readonly EvidenceDossier[] = [
  {
    stageNumber: '01',
    layerId: 'crypto',
    ref: 'REF #001',
    title: 'Radio Transmission Decryption',
    category: 'CRYPTOGRAPHIC INTERCEPT',
    evidenceText: 'Recovered plaintext transmission: "MYSTERY-BOX-OPENS-WITH-KNOWLEDGE". Decryption verified using shift substitution.',
    directive: 'Foundational Access Principle: The terminal philosophy required to open the box is the final word of the transmission.',
    token: 'KNOWLEDGE',
    quadrant: 0,
  },
  {
    stageNumber: '02',
    layerId: 'dom-inspect',
    ref: 'REF #002',
    title: 'Security Seal Integrity Inspection',
    category: 'TAMPER-EVIDENT HARDWARE',
    evidenceText: 'Station Locker Seal #8841-B inspected in client document tree. Hardware security integrity confirmed intact.',
    directive: 'Clearance Status Flag: The exact security authentication state validated within the DOM seal structure.',
    token: 'VERIFIED',
    quadrant: 1,
  },
  {
    stageNumber: '03',
    layerId: 'cross-tab',
    ref: 'REF #003',
    title: 'Multi-Channel Carrier Pairing',
    category: 'CROSS-CHANNEL TELEMETRY',
    evidenceText: 'Broadcast frequencies synchronized across dual station consoles. Recovered carrier code: "SIGNAL-SYNCHRONIZED".',
    directive: 'Carrier Synchronization State: The terminal operational resonance token established across the dual-tab link.',
    token: 'SYNCHRONIZED',
    quadrant: 2,
  },
  {
    stageNumber: '04',
    layerId: 'temporal',
    ref: 'REF #004',
    title: 'Incident Timeline Reconstruction',
    category: 'CHRONOLOGY FORENSICS',
    evidenceText: 'Corrected chronological incident sequence: EV-302 (02:15) \u2192 EV-814 (02:55) \u2192 EV-409 (03:08) \u2192 EV-127 (03:22) \u2192 EV-955 (03:45).',
    directive: 'Facility Lockdown Incident Tag: The incident identifier of the final event that triggered total station lockdown.',
    token: 'EV-955',
    quadrant: 3,
  },
];

export const FINAL_VAULT_KEY = 'KNOWLEDGE-VERIFIED-SYNCHRONIZED-EV-955';

const HINTS: readonly string[] = [
  'The Vault Master Key is formed by joining four specific tokens extracted sequentially from Files #001 through #004 with hyphens: [TOKEN1]-[TOKEN2]-[TOKEN3]-[TOKEN4].',
  'Quadrant 1 is the single-word access philosophy at the end of the decrypted Stage 1 message: KNOWLEDGE.',
  'Quadrants 2 & 3 are the exact authentication flags established in the tamper seal (VERIFIED) and multi-channel carrier link (SYNCHRONIZED).',
  'Quadrant 4 is the event tag for the final chronological incident in the restored Layer 4 timeline (EV-955). The complete key is KNOWLEDGE-VERIFIED-SYNCHRONIZED-EV-955.',
];

export class FinalVaultLayer implements PuzzleLayer {
  readonly id: LayerId = 'final-reveal';
  readonly displayName = 'Final Reveal';

  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private isSolved = false;
  private isSubmitting = false;
  private hintsRevealed = 0;
  private quadrantTokens: (string | null)[] = [null, null, null, null];

  private formHandler: ((e: Event) => void) | null = null;
  private buttonHandlers: Map<HTMLElement, { type: string; fn: EventListener }> = new Map();

  mount(container: HTMLElement): void {
    this.container = container;
    this.root = document.createElement('article');
    this.root.className = 'layer-card';
    this.root.dataset.status = 'active';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Evidence File 005 — Final Forensic Vault & Master Key Synthesis');

    this.root.innerHTML = `
      <header class="layer-card__header">
        <div class="layer-meta">
          <span class="layer-meta__ref">REF&#x202F;#005</span>
          <span id="vault-badge" class="layer-meta__badge badge badge--active">VAULT SEALED // CLEARANCE REQUIRED</span>
        </div>
        <h2 class="layer-card__title">Final Reveal</h2>
        <p class="layer-card__layer-id">Layer 05 &bull; Operation Omega &amp; Forensic Evidence Synthesis</p>
      </header>

      <div class="layer-card__body">
        <div class="vault-subsystem">
          <!-- Vault Blast Door Mechanism Graphic -->
          <div id="vault-blast-door" class="vault-blast-door" aria-label="Master Vault Heavy Blast Door">
            <div class="vault-door-outer">
              <div class="vault-door-left"></div>
              <div class="vault-door-right"></div>
              <div class="vault-central-mechanism">
                <div class="vault-dial" id="vault-dial">
                  <span class="vault-dial-code">&#x25C8;</span>
                </div>
                <div class="vault-bolt vault-bolt--top" data-bolt="0"></div>
                <div class="vault-bolt vault-bolt--right" data-bolt="1"></div>
                <div class="vault-bolt vault-bolt--bottom" data-bolt="2"></div>
                <div class="vault-bolt vault-bolt--left" data-bolt="3"></div>
              </div>
            </div>
            <div class="vault-status-indicator">
              <span id="vault-lock-status">INTERLOCK SYSTEM ENGAGED &bull; 4 BOLTS PRIMED</span>
            </div>
          </div>

          <div class="evidence-record">
            <p class="narrative">
              All perimeter, cryptographic, tamper-detection, and temporal forensics have been successfully analyzed.
              The inner station vault remains secured by an automated multi-quadrant cryptographic interlock.
            </p>
            <p class="narrative narrative--dim">
              Synthesize the four core security credentials recovered from each prior investigation file into the
              unified <strong>Master Vault Key</strong> to disengage the blast doors and access the classified case archive.
            </p>
          </div>

          <!-- Evidence Synthesis Matrix (4 Dossiers) -->
          <section aria-label="Evidence Synthesis Dossier Matrix">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <span style="font-family: monospace; font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">
                EVIDENCE SYNTHESIS DOSSIERS (CLICK TO EXTRACT QUADRANT TOKENS):
              </span>
              <button id="btn-assemble-all" type="button" class="btn btn--secondary btn--sm" style="font-size: 0.75rem;">
                Assemble All Discovered Tokens
              </button>
            </div>

            <div class="synthesis-matrix">
              ${EVIDENCE_DOSSIERS.map(
                d => `
                <div class="dossier-card" id="dossier-${d.layerId}" data-quadrant="${d.quadrant}">
                  <div class="dossier-card__header">
                    <span>${d.ref} &bull; STAGE ${d.stageNumber}</span>
                    <span class="badge badge--active" style="font-size: 0.7rem;">RESOLVED</span>
                  </div>
                  <div class="dossier-card__title">${d.title}</div>
                  <div class="dossier-card__evidence">
                    ${d.evidenceText}
                  </div>
                  <div class="dossier-card__directive">
                    <strong>DIRECTIVE:</strong> ${d.directive}
                  </div>
                  <button
                    type="button"
                    class="btn btn--secondary btn--sm btn-extract-token"
                    data-quadrant="${d.quadrant}"
                    data-token="${d.token}"
                    style="margin-top: auto; font-family: monospace; font-size: 0.75rem;"
                  >
                    Extract Token [${d.token}]
                  </button>
                </div>
              `
              ).join('')}
            </div>
          </section>

          <!-- Key Assembly Display -->
          <div class="key-assembly-bar" aria-label="Key Synthesis Quadrant Assembly">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-family: monospace; font-size: 0.75rem; color: #94a3b8; text-transform: uppercase;">
                Master Key Quadrants Synthesis:
              </span>
              <button id="btn-clear-key" type="button" class="btn btn--ghost btn--sm" style="font-size: 0.75rem;">
                Clear Assembly
              </button>
            </div>

            <div class="quadrant-slots" role="group" aria-label="Four key quadrants">
              <div class="quadrant-slot" id="slot-quadrant-0">
                <span class="quadrant-slot__label">QUADRANT 01 (CRYPTO)</span>
                <span class="quadrant-slot__val">&mdash;</span>
              </div>
              <div class="quadrant-slot" id="slot-quadrant-1">
                <span class="quadrant-slot__label">QUADRANT 02 (DOM SEAL)</span>
                <span class="quadrant-slot__val">&mdash;</span>
              </div>
              <div class="quadrant-slot" id="slot-quadrant-2">
                <span class="quadrant-slot__label">QUADRANT 03 (CARRIER)</span>
                <span class="quadrant-slot__val">&mdash;</span>
              </div>
              <div class="quadrant-slot" id="slot-quadrant-3">
                <span class="quadrant-slot__label">QUADRANT 04 (CHRONO)</span>
                <span class="quadrant-slot__val">&mdash;</span>
              </div>
            </div>
          </div>

          <!-- Progressive Hints -->
          <div class="hints-section" style="margin-top: 0.5rem; margin-bottom: 0.5rem;">
            <button id="vault-hint-btn" type="button" class="btn btn--ghost hint-toggle">
              Reveal Clue (0/4)
            </button>
            <div id="vault-hints-list" class="hints-list"></div>
          </div>

          <!-- Answer Form -->
          <form class="answer-form" id="vault-form" novalidate aria-label="Submit synthesized master vault key">
            <label for="vault-key-input" class="sr-only">Synthesized Master Vault Key</label>
            <div class="answer-form__input-group">
              <input
                id="vault-key-input"
                type="text"
                class="input font-mono"
                placeholder="QUAD1-QUAD2-QUAD3-QUAD4"
                autocomplete="off"
                spellcheck="false"
                aria-describedby="vault-status"
              />
              <button id="vault-submit-btn" type="submit" class="btn btn--primary">
                Disengage Master Vault
              </button>
            </div>
            <p id="vault-status" class="status-msg" aria-live="polite" aria-atomic="true"></p>
          </form>

          <!-- Completion Screen Container (Populated on Solve) -->
          <div id="vault-completion-mount"></div>
        </div>
      </div>
    `;

    this.container.appendChild(this.root);
    this.bindEvents();
  }

  activate(): void {
    if (!this.root) return;
    this.root.dataset.status = 'active';
  }

  destroy(): void {
    this.cleanupButtonHandlers();

    if (this.formHandler && this.root) {
      const form = this.root.querySelector<HTMLFormElement>('#vault-form');
      form?.removeEventListener('submit', this.formHandler);
      this.formHandler = null;
    }

    if (this.root && this.container?.contains(this.root)) {
      this.container.removeChild(this.root);
    }
    this.root = null;
    this.container = null;
  }

  // ---------------------------------------------------------------------------
  // Quadrant Assembly & Interaction
  // ---------------------------------------------------------------------------

  extractToken(quadrant: number, token: string): void {
    if (quadrant < 0 || quadrant > 3 || this.isSolved) return;
    this.quadrantTokens[quadrant] = token;
    this.updateQuadrantDisplay();
  }

  assembleAllTokens(): void {
    if (this.isSolved) return;
    for (const dossier of EVIDENCE_DOSSIERS) {
      this.quadrantTokens[dossier.quadrant] = dossier.token;
    }
    this.updateQuadrantDisplay();
  }

  clearKey(): void {
    if (this.isSolved) return;
    this.quadrantTokens = [null, null, null, null];
    this.updateQuadrantDisplay();
  }

  private updateQuadrantDisplay(): void {
    if (!this.root) return;

    for (let i = 0; i < 4; i++) {
      const slot = this.root.querySelector<HTMLElement>(`#slot-quadrant-${i}`);
      const valEl = slot?.querySelector<HTMLElement>('.quadrant-slot__val');
      const bolt = this.root.querySelector<HTMLElement>(`.vault-bolt[data-bolt="${i}"]`);
      const dossierCard = this.root.querySelector<HTMLElement>(`.dossier-card[data-quadrant="${i}"]`);

      const val = this.quadrantTokens[i];
      if (val) {
        slot?.classList.add('is-filled');
        if (valEl) valEl.textContent = val;
        bolt?.classList.add('is-ready');
        dossierCard?.classList.add('is-extracted');
      } else {
        slot?.classList.remove('is-filled');
        if (valEl) valEl.innerHTML = '&mdash;';
        bolt?.classList.remove('is-ready');
        dossierCard?.classList.remove('is-extracted');
      }
    }

    // Update input field if any tokens are present
    const assembledParts = this.quadrantTokens.filter((t): t is string => t !== null);
    const input = this.root.querySelector<HTMLInputElement>('#vault-key-input');
    if (input && !this.isSolved) {
      input.value = this.quadrantTokens.map(t => t ?? '???').join('-');
      if (assembledParts.length === 4) {
        input.value = this.quadrantTokens.join('-');
      }
    }

    // Update bolt status message
    const lockStatus = this.root.querySelector<HTMLElement>('#vault-lock-status');
    if (lockStatus && !this.isSolved) {
      const primedCount = assembledParts.length;
      lockStatus.textContent = `INTERLOCK SYSTEM ENGAGED \u2022 ${primedCount} OF 4 BOLTS PRIMED`;
    }
  }

  // ---------------------------------------------------------------------------
  // Answer Submission & Verification
  // ---------------------------------------------------------------------------

  async submitAnswer(answer: string): Promise<SolveResult> {
    if (this.isSolved) {
      return 'accepted';
    }

    if (this.isSubmitting) {
      return 'busy';
    }

    this.isSubmitting = true;
    const statusEl = this.root?.querySelector<HTMLElement>('#vault-status');
    const submitBtn = this.root?.querySelector<HTMLButtonElement>('#vault-submit-btn');
    const input = this.root?.querySelector<HTMLInputElement>('#vault-key-input');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Verifying Master Key\u2026';
    }

    const result = await stateMachine.solve(this.id, answer);

    this.isSubmitting = false;

    if (result === 'accepted') {
      this.isSolved = true;
      this.triggerVaultOpeningSequence();
    } else if (result === 'incorrect') {
      const feedback = this.generateDiagnosticFeedback(answer);
      this.setStatus(statusEl, 'error', feedback);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Disengage Master Vault';
      }
      input?.focus();
    } else if (result === 'error') {
      this.setStatus(statusEl, 'error', VALIDATION_UNAVAILABLE_MESSAGE);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Disengage Master Vault';
      }
      input?.focus();
    } else {
      if (submitBtn && !this.isSolved) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Disengage Master Vault';
      }
    }

    return result;
  }

  private generateDiagnosticFeedback(rawInput: string): string {
    const normalized = normalizeAnswer(rawInput);
    if (!normalized) {
      return 'Invalid key format. Enter the four synthesized quadrant credentials separated by hyphens (e.g. QUAD1-QUAD2-QUAD3-QUAD4).';
    }

    // Single-stage answer detection
    if (normalized === 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE') {
      return 'Single-stage transmission key detected. The final vault cannot be opened with isolated credentials. Synthesize tokens from all four forensic files.';
    }
    if (normalized === 'VERIFIED') {
      return 'Single-stage seal status detected. Combine this token with credentials from the other three files.';
    }
    if (normalized === 'SIGNAL-SYNCHRONIZED') {
      return 'Single-stage carrier signal detected. Combine this token with credentials from the other three files.';
    }
    if (normalized.includes('EV-302') && normalized.includes('EV-814')) {
      return 'Single-stage chronology sequence detected. Extract the culminating lockdown incident identifier for Quadrant 4.';
    }

    const targetTokens = ['KNOWLEDGE', 'VERIFIED', 'SYNCHRONIZED', 'EV-955'];
    const parts = normalized.split('-');

    // Token count verification
    // Since EV-955 contains a hyphen, normalizeAnswer turns it into EV-955.
    // Normalized format should be KNOWLEDGE-VERIFIED-SYNCHRONIZED-EV-955 (4 tokens: KNOWLEDGE, VERIFIED, SYNCHRONIZED, EV-955)
    // When split by '-', parts has length 5: ['KNOWLEDGE', 'VERIFIED', 'SYNCHRONIZED', 'EV', '955']
    let extracted: string[] = [];
    if (parts.length === 5 && parts[3] === 'EV') {
      extracted = [parts[0], parts[1], parts[2], `${parts[3]}-${parts[4]}`];
    } else {
      extracted = parts;
    }

    if (extracted.length !== 4) {
      return `Synthesis incomplete: ${extracted.length} tokens provided. Exactly 4 quadrant tokens are required in order.`;
    }

    let correctCount = 0;
    for (let i = 0; i < 4; i++) {
      if (extracted[i] === targetTokens[i]) {
        correctCount++;
      }
    }

    return `Access Denied: ${correctCount} of 4 quadrant tokens correctly aligned. Verify the archival extraction directives in each dossier.`;
  }

  private triggerVaultOpeningSequence(): void {
    if (!this.root) return;

    this.root.dataset.status = 'solved';

    // Update Badge
    const badge = this.root.querySelector<HTMLElement>('#vault-badge');
    if (badge) {
      badge.className = 'layer-meta__badge badge badge--success';
      badge.textContent = 'VAULT UNLOCKED // ACCESS GRANTED';
    }

    // Vault Door Animation
    const blastDoor = this.root.querySelector<HTMLElement>('#vault-blast-door');
    const dial = this.root.querySelector<HTMLElement>('#vault-dial');
    const lockStatus = this.root.querySelector<HTMLElement>('#vault-lock-status');

    dial?.classList.add('is-unlocked');
    blastDoor?.classList.add('is-open');

    if (lockStatus) {
      lockStatus.textContent = 'INTERLOCK DISENGAGED \u2022 BLAST DOORS OPEN';
      lockStatus.style.color = 'var(--col-success)';
    }

    // Disable Form & Inputs
    const form = this.root.querySelector<HTMLFormElement>('#vault-form');
    if (form) {
      form.style.display = 'none';
    }

    const buttons = this.root.querySelectorAll<HTMLButtonElement>(
      '.btn-extract-token, #btn-assemble-all, #btn-clear-key'
    );
    buttons.forEach(btn => {
      btn.disabled = true;
    });

    // Render Completion Screen
    this.renderCompletionScreen();
  }

  private renderCompletionScreen(): void {
    if (!this.root) return;
    const mountEl = this.root.querySelector<HTMLElement>('#vault-completion-mount');
    if (!mountEl) return;

    mountEl.innerHTML = `
      <div class="vault-completion-panel" role="region" aria-label="Classified Case Debriefing">
        <div class="completion-badge">
          <span>&#x2713;</span>
          <span>OPERATION OMEGA &bull; ALL 5 LAYERS BREACHED</span>
        </div>

        <h3 class="completion-title">Case File 409-B: Forensic Incident Report</h3>

        <p class="narrative" style="margin: 0; color: var(--col-text-1);">
          The forensic lock on the Station Master Vault has been fully compromised. Investigation telemetry
          confirms that all five defense countermeasures across cryptography, client document security,
          multi-channel communication, and chronological timekeeping have been solved.
        </p>

        <table class="completion-summary-table" aria-label="Investigation stages summary">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Investigation Domain</th>
              <th>Discovered Artifact</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>01</td>
              <td>Cryptography</td>
              <td>KNOWLEDGE (Decrypted Intercept)</td>
              <td><span class="badge badge--success" style="font-size: 0.7rem;">SOLVED</span></td>
            </tr>
            <tr>
              <td>02</td>
              <td>DOM Inspection</td>
              <td>VERIFIED (Seal #8841-B)</td>
              <td><span class="badge badge--success" style="font-size: 0.7rem;">SOLVED</span></td>
            </tr>
            <tr>
              <td>03</td>
              <td>Cross-Tab Sync</td>
              <td>SYNCHRONIZED (Dual-Channel Pairing)</td>
              <td><span class="badge badge--success" style="font-size: 0.7rem;">SOLVED</span></td>
            </tr>
            <tr>
              <td>04</td>
              <td>Temporal Logic</td>
              <td>EV-955 (Lockdown Incident at 03:45 UTC)</td>
              <td><span class="badge badge--success" style="font-size: 0.7rem;">SOLVED</span></td>
            </tr>
            <tr>
              <td>05</td>
              <td>Final Vault</td>
              <td>KNOWLEDGE-VERIFIED-SYNCHRONIZED-EV-955</td>
              <td><span class="badge badge--success" style="font-size: 0.7rem;">SOLVED</span></td>
            </tr>
          </tbody>
        </table>

        <div style="background: rgba(0, 0, 0, 0.4); border-left: 3px solid var(--col-success); padding: 0.75rem 1rem; border-radius: 2px; font-family: monospace; font-size: 0.8rem; color: #a5b4fc;">
          <strong>FORENSIC CONCLUSION:</strong> Unauthorized exfiltration originated from Sublevel 2 Control Room via console override at 02:55 UTC. All exfiltrated data vault archives were intercepted. Master physical facility lockdown verified effective.
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 0.5rem;">
          <button id="vault-reset-btn" type="button" class="btn btn--primary">
            Re-lock Vault &amp; Reset Investigation
          </button>
        </div>
      </div>
    `;

    // Bind Reset button
    const resetBtn = mountEl.querySelector<HTMLButtonElement>('#vault-reset-btn');
    if (resetBtn) {
      const resetHandler = () => {
        stateMachine.reset();
        // Trigger container continue/reset event to force main to re-render from Layer 1
        this.container?.dispatchEvent(new CustomEvent('layer:continue', { bubbles: true }));
      };
      resetBtn.addEventListener('click', resetHandler);
      this.buttonHandlers.set(resetBtn, { type: 'click', fn: resetHandler as EventListener });
    }
  }

  // ---------------------------------------------------------------------------
  // Event Bindings
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    if (!this.root) return;

    // Form submission
    const form = this.root.querySelector<HTMLFormElement>('#vault-form');
    this.formHandler = (e: Event) => {
      e.preventDefault();
      const input = this.root?.querySelector<HTMLInputElement>('#vault-key-input');
      const val = input?.value ?? this.quadrantTokens.join('-');
      void this.submitAnswer(val);
    };
    form?.addEventListener('submit', this.formHandler);

    // Extraction buttons
    const extractButtons = this.root.querySelectorAll<HTMLButtonElement>('.btn-extract-token');
    extractButtons.forEach(btn => {
      const quadrant = parseInt(btn.dataset.quadrant ?? '0', 10);
      const token = btn.dataset.token ?? '';
      const handler = () => this.extractToken(quadrant, token);
      btn.addEventListener('click', handler);
      this.buttonHandlers.set(btn, { type: 'click', fn: handler as EventListener });
    });

    // Assemble All button
    const assembleAllBtn = this.root.querySelector<HTMLButtonElement>('#btn-assemble-all');
    if (assembleAllBtn) {
      const handler = () => this.assembleAllTokens();
      assembleAllBtn.addEventListener('click', handler);
      this.buttonHandlers.set(assembleAllBtn, { type: 'click', fn: handler as EventListener });
    }

    // Clear Key button
    const clearKeyBtn = this.root.querySelector<HTMLButtonElement>('#btn-clear-key');
    if (clearKeyBtn) {
      const handler = () => this.clearKey();
      clearKeyBtn.addEventListener('click', handler);
      this.buttonHandlers.set(clearKeyBtn, { type: 'click', fn: handler as EventListener });
    }

    // Progressive Hint button
    const hintBtn = this.root.querySelector<HTMLButtonElement>('#vault-hint-btn');
    if (hintBtn) {
      const handler = () => this.revealNextHint();
      hintBtn.addEventListener('click', handler);
      this.buttonHandlers.set(hintBtn, { type: 'click', fn: handler as EventListener });
    }
  }

  private cleanupButtonHandlers(): void {
    for (const [el, { type, fn }] of this.buttonHandlers.entries()) {
      el.removeEventListener(type, fn);
    }
    this.buttonHandlers.clear();
  }

  private revealNextHint(): void {
    if (this.hintsRevealed >= HINTS.length || !this.root) return;

    const list = this.root.querySelector('#vault-hints-list');
    const btn = this.root.querySelector<HTMLButtonElement>('#vault-hint-btn');
    if (!list) return;

    const hintEl = document.createElement('p');
    hintEl.className = 'hint-item';
    hintEl.innerHTML = `<strong>CLUE ${this.hintsRevealed + 1}:</strong> ${HINTS[this.hintsRevealed]}`;
    list.appendChild(hintEl);

    this.hintsRevealed++;

    if (btn) {
      if (this.hintsRevealed >= HINTS.length) {
        btn.textContent = 'All Clues Revealed (4/4)';
        btn.disabled = true;
      } else {
        btn.textContent = `Reveal Clue (${this.hintsRevealed}/${HINTS.length})`;
      }
    }
  }

  private setStatus(el: HTMLElement | null | undefined, type: 'error' | 'success' | 'info', text: string): void {
    if (!el) return;
    el.className = `status-msg status-msg--${type}`;
    el.textContent = text;
  }
}
