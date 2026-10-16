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
    item.setAttribute('aria-label', `${meta.displayName}: ${statusLabel(status)}`);

    item.innerHTML = `
      <span class="progress-item__dot" aria-hidden="true"></span>
      <span class="progress-item__body">
        <span class="progress-item__index">${meta.index}</span>
        <span class="progress-item__name">${meta.displayName.toUpperCase()}</span>
      </span>
      <span class="progress-item__status">${statusLabel(status)}</span>
    `;

    nav.appendChild(item);
  }
}

// ---------------------------------------------------------------------------
// Layer rendering
// ---------------------------------------------------------------------------

/** Mounted layer instance — tracked so we can destroy it on transition. */
let mountedLayer: { destroy: () => void } | null = null;

function renderLayer(): void {
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
    return;
  }

  if (currentId === 'dom-inspect') {
    const layer = new DomLayer();
    layer.mount(container);
    layer.activate();
    mountedLayer = layer;
    return;
  }

  // No implemented layer is active — find the unlocked stage to display.
  const unlocked = stateMachine.progression.find(e => e.status === 'unlocked');
  if (unlocked) {
    renderUnlockedPlaceholder(container, unlocked.id);
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

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

function bindReset(): void {
  const btn = document.getElementById('reset-btn');
  btn?.addEventListener('click', () => {
    if (confirm('Reset all puzzle progress?')) {
      stateMachine.reset();
      renderProgress();
      renderLayer();
    }
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function init(): void {
  renderProgress();
  renderLayer();
  bindReset();

  stateMachine.on('transition', () => {
    renderProgress();
    renderLayer();
  });
}

document.addEventListener('DOMContentLoaded', init);
