import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { stateMachine } from './core/state-machine.js';
import { CryptoLayer } from './layers/crypto-layer.js';
import { DomLayer } from './layers/dom-layer.js';
import { LAYER_META } from './core/constants.js';
import type { LayerId, LayerStatus } from './core/types.js';

// ---------------------------------------------------------------------------
// Progress indicator
// ---------------------------------------------------------------------------

function statusLabel(status: LayerStatus): string {
  switch (status) {
    case 'active':   return 'ACTIVE';
    case 'solved':   return 'COMPLETE';
    case 'unlocked': return 'UNLOCKED';
    case 'locked':   return 'LOCKED';
  }
}

function renderProgress(): void {
  const nav = document.getElementById('progress-nav');
  if (!nav) return;

  nav.innerHTML = '';

  for (const { id, status } of stateMachine.progression) {
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

  // No implemented layer is active — find the unlocked stage to display.
  const unlocked = stateMachine.progression.find(e => e.status === 'unlocked');
  if (unlocked) {
    renderUnlockedPlaceholder(container, unlocked.id);
    if (shouldFocusHeading) focusHeading(container);
    return;
  }

  // All stages complete.
  container.innerHTML = `
    <div class="layer-card layer-card--complete" role="status">
      <p class="narrative">All available stages complete.</p>
    </div>
  `;
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

