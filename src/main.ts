import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { stateMachine } from './core/state-machine.js';
import { CryptoLayer } from './layers/crypto-layer.js';
import { DomLayer } from './layers/dom-layer.js';
import { CrossTabLayer } from './layers/cross-tab-layer.js';
import { TemporalLayer } from './layers/temporal-layer.js';
import { FinalVaultLayer } from './layers/final-vault-layer.js';
import { LAYER_META } from './core/constants.js';
import type { LayerId, LayerStatus } from './core/types.js';

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------

function statusLabel(status: LayerStatus): string {
  switch (status) {
    case 'active':   return 'ACTIVE';
    case 'solved':   return 'VERIFIED';
    case 'unlocked': return 'UNLOCKED';
    case 'locked':   return 'LOCKED';
  }
}

function renderProgress(): void {
  const nav = document.getElementById('progress-nav');
  if (!nav) return;

  nav.innerHTML = '';

  let solvedCount = 0;
  for (const { id, status } of stateMachine.progression) {
    if (status === 'solved') solvedCount++;
    const meta = LAYER_META[id];
    const item = document.createElement('li');
    item.className = 'progress-item';
    item.dataset.status = status;
    item.innerHTML = `
      <span class="sr-only">${meta.displayName}: ${statusLabel(status)}</span>
      <span class="progress-item__dot" aria-hidden="true"></span>
      <span class="progress-item__body" aria-hidden="true">
        <span class="progress-item__index">${meta.index}</span>
        <span class="progress-item__name">${meta.displayName.toUpperCase()}</span>
      </span>
      <span class="progress-item__status" aria-hidden="true">${statusLabel(status)}</span>
    `;

    nav.appendChild(item);
  }

  // Update header clearance and telemetry if elements exist
  const clearanceEl = document.getElementById('clearance-level-indicator');
  if (clearanceEl) {
    clearanceEl.textContent = `LEVEL ${Math.min(5, solvedCount + 1)}/5`;
  }
  const footerSessionEl = document.getElementById('footer-session-state');
  if (footerSessionEl) {
    const curId = stateMachine.currentLayer;
    if (curId && LAYER_META[curId]) {
      footerSessionEl.textContent = `STAGE ${LAYER_META[curId].index}: ${LAYER_META[curId].displayName.toUpperCase()}`;
    } else if (solvedCount === 5) {
      footerSessionEl.textContent = 'ALL STAGES VERIFIED // MASTER VAULT UNLOCKED';
    }
  }
}

// ---------------------------------------------------------------------------
// Layer rendering
// ---------------------------------------------------------------------------

/** Mounted layer instance — tracked so we can destroy it on transition. */
let mountedLayer: { destroy: () => void } | null = null;

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

function bindReset(): void {
  const btn = document.getElementById('reset-btn');
  btn?.addEventListener('click', () => {
    if (confirm('Reset all puzzle progress?')) {
      stateMachine.reset();
      try {
        localStorage.removeItem('mystery-box-sync-session-id');
        localStorage.removeItem('mystery-box-sync-event-v1');
      } catch {
        // Storage access may be restricted in private or sandboxed contexts
      }
      renderProgress();
      renderLayer(true);
    }
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

/** Move keyboard focus to the current layer's heading (after a transition or reset). */
function focusHeading(container: HTMLElement): void {
  const heading = container.querySelector<HTMLElement>('.layer-card__title');
  if (!heading) return;
  heading.setAttribute('tabindex', '-1');
  heading.focus();
}

export function renderLayer(shouldFocusHeading = false): void {
  const container = document.getElementById('layer-container');
  if (!container) return;

  // Destroy the previously mounted layer before replacing it.
  mountedLayer?.destroy();
  mountedLayer = null;
  container.innerHTML = '';

  const currentId = stateMachine.currentLayer;

  if (currentId === 'crypto') {
    const layer = new CryptoLayer();
    layer.mount(container);
    layer.activate();
    mountedLayer = layer;
    if (shouldFocusHeading) focusHeading(container);
    return;
  }

  if (currentId === 'dom-inspect') {
    const layer = new DomLayer();
    layer.mount(container);
    layer.activate();
    mountedLayer = layer;
    if (shouldFocusHeading) focusHeading(container);
    return;
  }

  if (currentId === 'cross-tab') {
    const layer = new CrossTabLayer();
    layer.mount(container);
    layer.activate();
    mountedLayer = layer;
    if (shouldFocusHeading) focusHeading(container);
    return;
  }

  if (currentId === 'temporal') {
    const layer = new TemporalLayer();
    layer.mount(container);
    layer.activate();
    mountedLayer = layer;
    if (shouldFocusHeading) focusHeading(container);
    return;
  }

  if (currentId === 'final-reveal') {
    const layer = new FinalVaultLayer();
    layer.mount(container);
    layer.activate();
    mountedLayer = layer;
    if (shouldFocusHeading) focusHeading(container);
    return;
  }

  // Check if all stages are solved
  const allSolved = stateMachine.progression.every(e => e.status === 'solved');
  if (allSolved) {
    renderVaultCompletionScreen(container);
    if (shouldFocusHeading) focusHeading(container);
    return;
  }

  // No implemented layer is active — find the unlocked stage to display.
  const unlocked = stateMachine.progression.find(e => e.status === 'unlocked');
  if (unlocked) {
    renderUnlockedPlaceholder(container, unlocked.id);
    if (shouldFocusHeading) focusHeading(container);
    return;
  }

  // Fallback complete screen
  container.innerHTML = `
    <div class="layer-card layer-card--complete" role="status">
      <p class="narrative">All available stages complete.</p>
    </div>
  `;
}

function renderVaultCompletionScreen(container: HTMLElement): void {
  const el = document.createElement('article');
  el.className = 'layer-card layer-card--complete';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'Case File Complete — Operation Omega Vault Accessed');

  el.innerHTML = `
    <header class="layer-card__header">
      <div class="layer-meta">
        <span class="layer-meta__ref">REF #005</span>
        <span class="layer-meta__badge badge badge--success">ARCHIVE DECLASSIFIED // CLEARANCE OMEGA</span>
      </div>
      <h2 class="layer-card__title">Operation Omega &bull; All Security Systems Breached</h2>
      <p class="layer-card__layer-id">Mystery Box Completed &bull; Case File 409-B</p>
    </header>
    <div class="layer-card__body">
      <div class="vault-completion-panel" role="region" aria-label="Classified Case Debriefing">
        <div class="completion-badge">
          <span>&#x2713;</span>
          <span>OPERATION OMEGA &bull; ALL 5 INVESTIGATION STAGES SOLVED</span>
        </div>
        <p class="narrative" style="color: var(--col-text-1);">
          All security defense countermeasures protecting the Station Master Vault have been neutralized.
          Forensic telemetry confirms complete recovery of all exfiltrated archives.
        </p>

        <table class="completion-summary-table" aria-label="Investigation stages summary">
          <thead>
            <tr>
              <th>Stage</th>
              <th>Domain</th>
              <th>Recovered Artifact</th>
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
          <button id="final-reset-btn" type="button" class="btn btn--primary">
            Re-lock Vault &amp; Reset Investigation
          </button>
        </div>
      </div>
    </div>
  `;

  container.appendChild(el);

  const resetBtn = el.querySelector<HTMLButtonElement>('#final-reset-btn');
  resetBtn?.addEventListener('click', () => {
    const resetActionBtn = document.getElementById('reset-btn') as HTMLButtonElement | null;
    if (resetActionBtn) {
      resetActionBtn.click();
    } else {
      stateMachine.reset();
      renderProgress();
      renderLayer(true);
    }
  });
}

function renderUnlockedPlaceholder(container: HTMLElement, id: LayerId): void {
  const meta = LAYER_META[id];
  const el = document.createElement('div');
  el.className = 'layer-card layer-card--unlocked';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', `${meta.displayName}: unlocked, implementation pending`);

  el.innerHTML = `
    <header class="layer-card__header">
      <div class="layer-meta">
        <span class="layer-meta__ref">REF&#x202F;#${meta.index}</span>
        <span class="layer-meta__badge badge badge--unlocked">UNLOCKED</span>
      </div>
      <h2 class="layer-card__title">${meta.displayName}</h2>
      <p class="layer-card__layer-id">Layer ${meta.index}</p>
    </header>
    <div class="layer-card__body">
      <p class="narrative">
        Prior investigation stage completed. This stage has been unlocked, but its
        puzzle mechanics are pending implementation in the next phase.
      </p>
      <p class="narrative narrative--dim">
        Return when Phase&nbsp;${parseInt(meta.index, 10)} is approved and built.
      </p>
    </div>
  `;

  container.appendChild(el);
}

export function init(): void {

  renderProgress();
  renderLayer(false);
  bindReset();

  const container = document.getElementById('layer-container');
  // Success-feedback lifecycle:
  // When a layer is solved, the state machine saves state and emits 'transition',
  // which immediately updates the progress indicator. However, main.ts defers
  // rendering the next layer until the player clicks the "Continue" button on the
  // solved layer card. This ensures success badges and feedback remain visible.
  container?.addEventListener('layer:continue', () => {
    renderProgress();
    renderLayer(true);
  });

  stateMachine.on('transition', () => {
    // Immediately update progress indicator; defer card re-render until Continue is clicked.
    renderProgress();
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

export { renderProgress };

