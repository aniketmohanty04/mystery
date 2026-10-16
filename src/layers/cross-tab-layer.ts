import type { PuzzleLayer, LayerId, SolveResult } from '../core/types.js';
import { stateMachine } from '../core/state-machine.js';
import { VALIDATION_UNAVAILABLE_MESSAGE } from '../core/constants.js';
import { CrossTabManager } from '../sync/cross-tab-manager.js';
import type { PeerInfo, SignalFragment } from '../sync/types.js';

const HINTS: readonly string[] = [
  'Open this exact puzzle URL in a second browser window or tab. The two terminals will establish an encrypted cross-channel link automatically.',
  'Click "Emit Local Beacon" on either terminal to transmit its carrier frequency across the tab boundary.',
  'Carrier Node Alpha provides "SIGNAL" and Carrier Node Beta provides "SYNCHRONIZED". Combine them with a hyphen: SIGNAL-SYNCHRONIZED.',
];

export interface CrossTabLayerOptions {
  manager?: CrossTabManager;
}

export class CrossTabLayer implements PuzzleLayer {
  readonly id: LayerId = 'cross-tab';
  readonly displayName = 'Cross-Tab Synchronization';

  private container: HTMLElement | null = null;
  private root: HTMLElement | null = null;
  private isSolved = false;
  private hintsRevealed = 0;
  private formHandler: ((e: Event) => void) | null = null;

  private manager: CrossTabManager;
  private readonly isExternalManager: boolean;

  constructor(options: CrossTabLayerOptions = {}) {
    if (options.manager) {
      this.manager = options.manager;
      this.isExternalManager = true;
    } else {
      this.manager = new CrossTabManager();
      this.isExternalManager = false;
    }
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.root = document.createElement('article');
    this.root.className = 'layer-card';
    this.root.dataset.status = 'active';
    this.root.setAttribute('role', 'region');
    this.root.setAttribute('aria-label', 'Layer 03: Cross-Tab Synchronization');

    this.root.innerHTML = `
      <header class="layer-card__header">
        <div class="layer-meta">
          <span class="layer-meta__ref">REF&#x202F;#03</span>
          <span id="cross-tab-badge" class="layer-meta__badge badge badge--active">AWAITING LINK</span>
        </div>
        <h2 class="layer-card__title">Cross-Tab Synchronization</h2>
        <p class="layer-card__layer-id">Layer 03 &bull; Dual-Terminal Signal Intercept</p>
      </header>

      <div class="layer-card__body">
        <div class="evidence-record">
          <p class="narrative">
            Decryption telemetry indicates the carrier frequency has been split across
            entangled channels. Open this application in a <strong>second browser window or tab</strong>
            to establish real-time cross-tab synchronization and align the carrier frequencies.
          </p>
        </div>

        <div class="terminal-panel" style="margin: 1.5rem 0; padding: 1.25rem; background: rgba(15, 23, 42, 0.7); border: 1px solid #334155; border-radius: 6px;">
          <div style="display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.75rem; font-family: monospace; font-size: 0.85rem; color: #94a3b8;">
            <span>TERMINAL ID: <strong id="cross-tab-tab-id" style="color: #38bdf8;">${this.manager.tabId}</strong></span>
            <span>SESSION: <strong id="cross-tab-session-id" style="color: #cbd5e1;">${this.manager.sessionId}</strong></span>
            <span>TRANSPORT: <strong id="cross-tab-transport" style="color: #a78bfa;">${this.manager.mode.toUpperCase()}</strong></span>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.25rem; font-family: monospace; font-size: 0.85rem;">
            <span>LINK TELEMETRY:</span>
            <span id="cross-tab-peer-status" class="badge badge--active">1 TERMINAL ONLINE &bull; WAITING FOR PEER</span>
          </div>

          <div class="carrier-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
            <div style="padding: 1rem; background: rgba(30, 41, 59, 0.6); border: 1px solid #475569; border-radius: 4px;">
              <div style="font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                Carrier Node Alpha (Primary)
              </div>
              <div id="carrier-alpha-val" style="font-family: monospace; font-size: 1.15rem; font-weight: bold; color: #4ade80;">
                SIGNAL [EMITTING]
              </div>
              <button id="broadcast-beacon-btn" type="button" class="btn btn--secondary" style="margin-top: 0.75rem; width: 100%; font-size: 0.8rem;">
                Emit Carrier Beacon
              </button>
            </div>

            <div style="padding: 1rem; background: rgba(30, 41, 59, 0.6); border: 1px solid #475569; border-radius: 4px;">
              <div style="font-size: 0.75rem; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
                Carrier Node Beta (Secondary)
              </div>
              <div id="carrier-beta-val" style="font-family: monospace; font-size: 1.15rem; font-weight: bold; color: #94a3b8;">
                AWAITING PEER...
              </div>
              <div id="carrier-beta-time" style="font-size: 0.75rem; color: #64748b; margin-top: 0.75rem;">
                Secondary terminal offline
              </div>
            </div>
          </div>

          <div id="reconstructed-signal-banner" style="padding: 0.85rem; background: rgba(15, 23, 42, 0.9); border: 1px dashed #64748b; border-radius: 4px; text-align: center; font-family: monospace;">
            <span style="font-size: 0.75rem; display: block; color: #94a3b8; margin-bottom: 0.25rem; text-transform: uppercase; letter-spacing: 0.05em;">
              Combined Intercept Decryption Key
            </span>
            <strong id="reconstructed-signal-text" style="font-size: 1.25rem; color: #f8fafc; letter-spacing: 0.08em;">
              AWAITING DUAL-CHANNEL CARRIER TELEMETRY
            </strong>
          </div>
        </div>

        <div class="hints-section" style="margin-bottom: 1.5rem;">
          <button id="cross-tab-hint-btn" type="button" class="btn btn--ghost hint-toggle">
            Reveal Clue (0/3)
          </button>
          <div id="cross-tab-hints-list" class="hints-list"></div>
        </div>

        <form class="answer-form" id="cross-tab-form">
          <label for="cross-tab-answer" class="sr-only">Synchronized Signal Key</label>
          <div class="answer-form__input-group">
            <input
              id="cross-tab-answer"
              type="text"
              class="input"
              placeholder="ENTER SYNCHRONIZED SIGNAL"
              autocomplete="off"
              spellcheck="false"
            />
            <button id="cross-tab-submit" type="submit" class="btn btn--primary">
              Submit
            </button>
          </div>
          <p id="cross-tab-status" class="status-msg" aria-live="polite"></p>
        </form>
      </div>
    `;

    this.container.appendChild(this.root);
    this.bindEvents();
    this.updatePeerDisplay(this.manager.peers);
    this.updateSignalsDisplay(this.manager.knownSignals);
  }

  activate(): void {
    if (!this.root) return;
    this.root.dataset.status = 'active';

    // Broadcast our local carrier signal
    this.emitLocalCarrier();
  }

  destroy(): void {
    if (!this.isExternalManager) {
      this.manager.dispose();
    }
    if (this.root && this.container?.contains(this.root)) {
      this.container.removeChild(this.root);
    }
    this.root = null;
    this.container = null;
    this.formHandler = null;
  }

  async submitAnswer(answer: string): Promise<SolveResult> {
    const statusEl = this.root?.querySelector<HTMLElement>('#cross-tab-status');
    const submitBtn = this.root?.querySelector<HTMLButtonElement>('#cross-tab-submit');
    const input = this.root?.querySelector<HTMLInputElement>('#cross-tab-answer');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Checking…';
    }

    const result = await stateMachine.solve(this.id, answer);

    if (result === 'accepted') {
      this.markSolved();
    } else if (result === 'incorrect') {
      this.setStatus(statusEl, 'error', 'Incorrect signal key. Verify dual-carrier synchronization.');
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }
      input?.focus();
    } else if (result === 'error') {
      this.setStatus(statusEl, 'error', VALIDATION_UNAVAILABLE_MESSAGE);
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit'; }
      input?.focus();
    } else {
      if (submitBtn && !this.isSolved) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Internal methods
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    if (!this.root) return;

    // Form submit
    const form = this.root.querySelector<HTMLFormElement>('#cross-tab-form');
    this.formHandler = (e: Event) => {
      e.preventDefault();
      const input = this.root?.querySelector<HTMLInputElement>('#cross-tab-answer');
      if (input && input.value.trim().length > 0) {
        this.submitAnswer(input.value);
      }
    };
    form?.addEventListener('submit', this.formHandler);

    // Broadcast Beacon button
    const beaconBtn = this.root.querySelector<HTMLButtonElement>('#broadcast-beacon-btn');
    beaconBtn?.addEventListener('click', () => {
      this.emitLocalCarrier();
      const statusEl = this.root?.querySelector<HTMLElement>('#cross-tab-status');
      this.setStatus(statusEl, 'info', 'Carrier beacon emitted across all active terminals.');
    });

    // Hints
    const hintBtn = this.root.querySelector<HTMLButtonElement>('#cross-tab-hint-btn');
    hintBtn?.addEventListener('click', () => this.revealNextHint());

    // Sync Manager listeners
    this.manager.on('peer-change', (peers) => this.updatePeerDisplay(peers));
    this.manager.on('signals-updated', (signals) => this.updateSignalsDisplay(signals));
    this.manager.on('session-reset', () => this.handleSessionReset());
  }

  private emitLocalCarrier(): void {
    // If we have peers, determine if we are Primary or Secondary carrier
    const isPeerPresent = this.manager.peers.length > 0;
    if (isPeerPresent) {
      // Broadcast secondary carrier
      this.manager.dispatchSignal('carrier', 'beta', 'SYNCHRONIZED');
    } else {
      // Broadcast primary carrier
      this.manager.dispatchSignal('carrier', 'alpha', 'SIGNAL');
    }
  }

  private updatePeerDisplay(peers: PeerInfo[]): void {
    if (!this.root) return;
    const peerStatusEl = this.root.querySelector<HTMLElement>('#cross-tab-peer-status');
    const badge = this.root.querySelector<HTMLElement>('#cross-tab-badge');

    if (!peerStatusEl) return;

    if (peers.length === 0) {
      peerStatusEl.className = 'badge badge--active';
      peerStatusEl.textContent = '1 TERMINAL ONLINE \u2022 WAITING FOR PEER TAB';
      if (!this.isSolved && badge) {
        badge.className = 'layer-meta__badge badge badge--active';
        badge.textContent = 'AWAITING LINK';
      }
    } else {
      peerStatusEl.className = 'badge badge--success';
      peerStatusEl.textContent = `${peers.length + 1} TERMINALS ONLINE \u2022 DUAL-LINK ACTIVE`;
      if (!this.isSolved && badge) {
        badge.className = 'layer-meta__badge badge badge--active';
        badge.textContent = 'LINK ACTIVE';
      }
      // Emit our carrier signal so newly connected peer immediately receives it
      this.emitLocalCarrier();
    }
  }

  private updateSignalsDisplay(signals: SignalFragment[]): void {
    if (!this.root) return;

    const betaVal = this.root.querySelector<HTMLElement>('#carrier-beta-val');
    const betaTime = this.root.querySelector<HTMLElement>('#carrier-beta-time');
    const bannerText = this.root.querySelector<HTMLElement>('#reconstructed-signal-text');
    const answerInput = this.root.querySelector<HTMLInputElement>('#cross-tab-answer');

    let hasAlpha = false;
    let hasBeta = false;

    for (const s of signals) {
      if (s.signalId === 'carrier' && s.fragmentId === 'alpha') {
        hasAlpha = true;
      }
      if (s.signalId === 'carrier' && s.fragmentId === 'beta') {
        hasBeta = true;
        if (betaVal) {
          betaVal.textContent = `${s.fragmentValue} [SYNCHRONIZED]`;
          betaVal.style.color = '#4ade80';
        }
        if (betaTime) {
          betaTime.textContent = `Carrier aligned \u2022 ${new Date(s.timestamp).toLocaleTimeString()}`;
        }
      }
    }

    if (hasAlpha && hasBeta) {
      const fullKey = 'SIGNAL-SYNCHRONIZED';
      if (bannerText) {
        bannerText.textContent = fullKey;
        bannerText.style.color = '#4ade80';
      }
      if (answerInput && !answerInput.value) {
        answerInput.value = fullKey;
      }
      const badge = this.root.querySelector<HTMLElement>('#cross-tab-badge');
      if (!this.isSolved && badge) {
        badge.className = 'layer-meta__badge badge badge--success';
        badge.textContent = 'SYNCHRONIZED';
      }
    }
  }

  private handleSessionReset(): void {
    if (!this.root) return;
    const bannerText = this.root.querySelector<HTMLElement>('#reconstructed-signal-text');
    const betaVal = this.root.querySelector<HTMLElement>('#carrier-beta-val');
    const input = this.root.querySelector<HTMLInputElement>('#cross-tab-answer');

    if (bannerText) {
      bannerText.textContent = 'AWAITING DUAL-CHANNEL CARRIER TELEMETRY';
      bannerText.style.color = '#f8fafc';
    }
    if (betaVal) {
      betaVal.textContent = 'AWAITING PEER...';
      betaVal.style.color = '#94a3b8';
    }
    if (input && !this.isSolved) {
      input.value = '';
    }
  }

  private revealNextHint(): void {
    if (this.hintsRevealed >= HINTS.length || !this.root) return;

    const list = this.root.querySelector('#cross-tab-hints-list');
    const btn = this.root.querySelector<HTMLButtonElement>('#cross-tab-hint-btn');
    if (!list) return;

    const hintEl = document.createElement('p');
    hintEl.className = 'hint-item';
    hintEl.innerHTML = `<strong>CLUE ${this.hintsRevealed + 1}:</strong> ${HINTS[this.hintsRevealed]}`;
    list.appendChild(hintEl);

    this.hintsRevealed++;

    if (btn) {
      if (this.hintsRevealed >= HINTS.length) {
        btn.textContent = 'All Clues Revealed (3/3)';
        btn.disabled = true;
      } else {
        btn.textContent = `Reveal Clue (${this.hintsRevealed}/${HINTS.length})`;
      }
    }
  }

  private markSolved(): void {
    if (!this.root) return;
    this.isSolved = true;
    this.root.dataset.status = 'solved';

    const badge = this.root.querySelector<HTMLElement>('#cross-tab-badge');
    if (badge) {
      badge.className = 'layer-meta__badge badge badge--success';
      badge.textContent = 'DECODED';
    }

    const input = this.root.querySelector<HTMLInputElement>('#cross-tab-answer');
    if (input) input.disabled = true;

    const submitBtn = this.root.querySelector<HTMLButtonElement>('#cross-tab-submit');
    if (submitBtn) submitBtn.style.display = 'none';

    const statusEl = this.root.querySelector<HTMLElement>('#cross-tab-status');
    this.setStatus(statusEl, 'success', 'Transmission carrier synchronized. Decryption clearance granted.');

    // Append Continue button
    let continueBtn = this.root.querySelector<HTMLButtonElement>('#cross-tab-continue');
    if (!continueBtn) {
      continueBtn = document.createElement('button');
      continueBtn.id = 'cross-tab-continue';
      continueBtn.type = 'button';
      continueBtn.className = 'btn btn--primary';
      continueBtn.textContent = 'Continue to Layer 04';
      continueBtn.addEventListener('click', () => {
        this.container?.dispatchEvent(new CustomEvent('layer:continue', { bubbles: true }));
      });
      const form = this.root.querySelector('.answer-form');
      form?.appendChild(continueBtn);
    }
    continueBtn.focus();
  }

  private setStatus(el: HTMLElement | null | undefined, type: 'error' | 'success' | 'info', text: string): void {
    if (!el) return;
    el.className = `status-msg status-msg--${type}`;
    el.textContent = text;
  }
}
