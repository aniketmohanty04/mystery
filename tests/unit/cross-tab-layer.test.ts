// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CrossTabLayer } from '../../src/layers/cross-tab-layer.js';
import { stateMachine } from '../../src/core/state-machine.js';
import { renderLayer } from '../../src/main.js';
import { CrossTabManager } from '../../src/sync/cross-tab-manager.js';
import type { ChannelTransport } from '../../src/sync/transport.js';

function createMockTransport(): ChannelTransport {
  const handlers = new Set<(raw: string) => void>();
  return {
    mode: 'broadcast-channel',
    postMessage: vi.fn(),
    onMessage: (fn) => {
      handlers.add(fn);
      return () => handlers.delete(fn);
    },
    close: vi.fn(),
  };
}

describe('CrossTabLayer & Layer 3 Integration', () => {
  let container: HTMLElement;

  beforeEach(() => {
    stateMachine.reset();
    container = document.createElement('div');
    container.id = 'layer-container';
    document.body.innerHTML = '';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // REGRESSION TEST for Bug: Old placeholder screen must NOT appear when Layer 3 is active
  it('REGRESSION TEST: renders the real CrossTabLayer and NEVER the unlocked placeholder when Layer 3 is active', async () => {
    // Progress through Layer 1 and Layer 2 to reach Layer 3
    await stateMachine.solve('crypto', 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE');
    await stateMachine.solve('dom-inspect', 'VERIFIED');

    expect(stateMachine.currentLayer).toBe('cross-tab');

    // Call renderLayer as main.ts does on transition
    renderLayer();

    const card = container.querySelector('.layer-card');
    expect(card).not.toBeNull();

    // Verify it is NOT the unlocked placeholder
    expect(card?.classList.contains('layer-card--unlocked')).toBe(false);
    expect(container.textContent).not.toContain('Prior investigation stage completed');
    expect(container.textContent).not.toContain('Return when Phase 3 is approved and built');

    // Verify it IS the real CrossTabLayer
    expect(container.querySelector('.layer-card__title')?.textContent).toBe('Cross-Tab Synchronization');
    expect(container.querySelector('#cross-tab-tab-id')).not.toBeNull();
    expect(container.querySelector('#broadcast-beacon-btn')).not.toBeNull();
    expect(container.querySelector('#cross-tab-answer')).not.toBeNull();
    expect(container.querySelector('#cross-tab-submit')).not.toBeNull();
  });

  it('mounts with initial UI and terminal metadata', () => {
    const mockTransport = createMockTransport();
    const manager = new CrossTabManager({
      transport: mockTransport,
      enableHeartbeat: false,
    });
    const layer = new CrossTabLayer({ manager });
    layer.mount(container);

    expect(container.querySelector('#cross-tab-badge')?.textContent).toBe('AWAITING LINK');
    expect(container.querySelector('#cross-tab-tab-id')?.textContent).toBe(manager.tabId);
    expect(container.querySelector('#cross-tab-peer-status')?.textContent).toContain('1 TERMINAL ONLINE');
    expect(container.querySelector('#carrier-alpha-val')?.textContent).toContain('SIGNAL');
    expect(container.querySelector('#carrier-beta-val')?.textContent).toContain('AWAITING PEER');

    layer.destroy();
  });

  it('updates peer status and carrier when remote peer and beacon are received', () => {
    const mockTransport = createMockTransport();
    const manager = new CrossTabManager({
      transport: mockTransport,
      enableHeartbeat: false,
    });
    const layer = new CrossTabLayer({ manager });
    layer.mount(container);
    layer.activate();

    // Simulate remote peer connecting
    (manager as any).activePeers.set('tab_remote_peer', {
      tabId: 'tab_remote_peer',
      protocolVersion: 1,
      lastSeen: Date.now(),
    });
    (manager as any).emit('peer-change', manager.peers);

    const peerStatus = container.querySelector('#cross-tab-peer-status');
    expect(peerStatus?.textContent).toContain('2 TERMINALS ONLINE');
    expect(container.querySelector('#cross-tab-badge')?.textContent).toBe('SYNCHRONIZED');

    // Simulate remote carrier beta signal arriving
    (manager as any).signals.set('carrier::beta', {
      signalId: 'carrier',
      fragmentId: 'beta',
      fragmentValue: 'SYNCHRONIZED',
      timestamp: Date.now(),
    });
    (manager as any).emit('signals-updated', manager.knownSignals);

    const reconstructed = container.querySelector('#reconstructed-signal-text');
    expect(reconstructed?.textContent).toBe('SIGNAL-SYNCHRONIZED');
    expect(container.querySelector('#cross-tab-badge')?.textContent).toBe('SYNCHRONIZED');

    const input = container.querySelector('#cross-tab-answer') as HTMLInputElement;
    expect(input.value).toBe('SIGNAL-SYNCHRONIZED');

    layer.destroy();
  });

  it('clicking "Emit Carrier Beacon" emits carrier signal', () => {
    const mockTransport = createMockTransport();
    const manager = new CrossTabManager({
      transport: mockTransport,
      enableHeartbeat: false,
    });
    const dispatchSpy = vi.spyOn(manager, 'dispatchSignal');

    const layer = new CrossTabLayer({ manager });
    layer.mount(container);

    const beaconBtn = container.querySelector('#broadcast-beacon-btn') as HTMLButtonElement;
    beaconBtn.click();

    expect(dispatchSpy).toHaveBeenCalledWith('carrier', 'alpha', 'SIGNAL');
    expect(container.querySelector('#cross-tab-status')?.textContent).toContain('Carrier beacon emitted');

    layer.destroy();
  });

  it('submitting correct answer solves the layer, shows success feedback, and appends Continue button', async () => {
    // Advance state machine to cross-tab
    await stateMachine.solve('crypto', 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE');
    await stateMachine.solve('dom-inspect', 'VERIFIED');

    const mockTransport = createMockTransport();
    const manager = new CrossTabManager({
      transport: mockTransport,
      enableHeartbeat: false,
    });
    const layer = new CrossTabLayer({ manager });
    layer.mount(container);
    layer.activate();

    const input = container.querySelector('#cross-tab-answer') as HTMLInputElement;
    const form = container.querySelector('#cross-tab-form') as HTMLFormElement;

    input.value = 'SIGNAL-SYNCHRONIZED';
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(container.querySelector('#cross-tab-badge')?.textContent).toBe('DECODED');
    });

    expect(container.querySelector('#cross-tab-status')?.textContent).toContain('Transmission carrier synchronized');
    expect(input.disabled).toBe(true);

    const continueBtn = container.querySelector('#cross-tab-continue') as HTMLButtonElement;
    expect(continueBtn).not.toBeNull();
    expect(document.activeElement).toBe(continueBtn);

    // Clicking continue triggers layer:continue event
    let continueFired = false;
    container.addEventListener('layer:continue', () => {
      continueFired = true;
    });
    continueBtn.click();
    expect(continueFired).toBe(true);

    layer.destroy();
  });

  it('progressively reveals hints for Layer 3', () => {
    const mockTransport = createMockTransport();
    const manager = new CrossTabManager({
      transport: mockTransport,
      enableHeartbeat: false,
    });
    const layer = new CrossTabLayer({ manager });
    layer.mount(container);

    const hintBtn = container.querySelector('#cross-tab-hint-btn') as HTMLButtonElement;
    const hintsList = container.querySelector('#cross-tab-hints-list') as HTMLElement;

    expect(hintBtn.textContent).toContain('0/3');
    expect(hintsList.children.length).toBe(0);

    hintBtn.click();
    expect(hintsList.children.length).toBe(1);
    expect(hintBtn.textContent).toContain('1/3');

    hintBtn.click();
    expect(hintsList.children.length).toBe(2);

    hintBtn.click();
    expect(hintsList.children.length).toBe(3);
    expect(hintBtn.disabled).toBe(true);

    layer.destroy();
  });
});
