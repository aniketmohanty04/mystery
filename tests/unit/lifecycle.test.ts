// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { init } from '../../src/main.js';
import { stateMachine } from '../../src/core/state-machine.js';

describe('Success-Feedback Lifecycle & main.ts orchestration', () => {
  beforeEach(() => {
    stateMachine.reset();
    document.body.innerHTML = `
      <header>
        <ol id="progress-nav"></ol>
        <button id="reset-btn" type="button">Reset</button>
      </header>
      <main>
        <section id="layer-container"></section>
      </main>
    `;
    init();
  });

  it('init mounts Layer 1 with progress navigation and crypto card', () => {
    const nav = document.getElementById('progress-nav');
    const container = document.getElementById('layer-container');

    expect(nav?.children.length).toBe(5);
    expect(container?.querySelector('.layer-card')).not.toBeNull();
    expect(container?.querySelector('.layer-card__title')?.textContent).toBe('Encrypted Transmission');
  });

  it('keeps Layer 1 success feedback visible until Continue is clicked, then renders Layer 2', async () => {
    const container = document.getElementById('layer-container')!;
    const input = container.querySelector('#crypto-answer') as HTMLInputElement;
    const form = container.querySelector('.answer-form') as HTMLFormElement;

    // Submit correct answer for Layer 1
    input.value = 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE';
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    // Wait for solve to finish
    await vi.waitFor(() => {
      const statusEl = container.querySelector('#crypto-status');
      expect(statusEl?.textContent).toBe('Transmission decoded. Clearance granted.');
    });

    // 1. Layer 1 success message, DECODED badge, and Continue button MUST be present
    const badge = container.querySelector('.layer-meta__badge');
    expect(badge?.textContent).toBe('DECODED');
    const continueBtn = container.querySelector('#crypto-continue') as HTMLButtonElement;
    expect(continueBtn).not.toBeNull();

    // 2. Layer 2 MUST NOT be rendered yet (CryptoLayer is still mounted)
    expect(container.querySelector('.layer-card__title')?.textContent).toBe('Encrypted Transmission');
    expect(container.querySelector('#evidence-seal')).toBeNull();

    // 3. Progress nav has updated (shows Layer 1 COMPLETE)
    const navItems = document.querySelectorAll('#progress-nav .progress-item');
    expect(navItems[0]?.getAttribute('data-status')).toBe('solved');
    expect(navItems[1]?.getAttribute('data-status')).toBe('active');

    // 4. Activating Continue now renders Layer 2
    continueBtn.click();

    expect(container.querySelector('.layer-card__title')?.textContent).toBe('Digital Evidence Seal');
    expect(container.querySelector('#evidence-seal')).not.toBeNull();
    // Verify focus moved to the new heading
    const newHeading = container.querySelector('.layer-card__title');
    expect(document.activeElement).toBe(newHeading);
  });

  it('resets progress and renders Layer 1 when reset is confirmed', () => {
    const container = document.getElementById('layer-container')!;
    const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;

    // Confirm dialog mock
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    resetBtn.click();

    expect(stateMachine.currentLayer).toBe('crypto');
    expect(container.querySelector('.layer-card__title')?.textContent).toBe('Encrypted Transmission');
  });

  it('progresses to Layer 3 and reset returns to Layer 1', async () => {
    const container = document.getElementById('layer-container')!;
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    // Solve Layer 1
    const cryptoInput = container.querySelector('#crypto-answer') as HTMLInputElement;
    const cryptoForm = container.querySelector('.answer-form') as HTMLFormElement;
    cryptoInput.value = 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE';
    cryptoForm.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(container.querySelector('#crypto-continue')).not.toBeNull();
    });
    (container.querySelector('#crypto-continue') as HTMLButtonElement).click();

    // Now on Layer 2
    expect(stateMachine.currentLayer).toBe('dom-inspect');
    expect(container.querySelector('#evidence-seal')).not.toBeNull();

    // Solve Layer 2 by mutating seal attribute
    const seal = container.querySelector('#evidence-seal') as HTMLElement;
    seal.setAttribute('data-seal', 'verified');

    await vi.waitFor(() => {
      expect(container.querySelector('#dom-continue')).not.toBeNull();
    });
    (container.querySelector('#dom-continue') as HTMLButtonElement).click();

    // Now on Layer 3
    expect(stateMachine.currentLayer).toBe('cross-tab');
    expect(container.querySelector('.layer-card__title')?.textContent).toBe('Cross-Tab Synchronization');

    // Click Reset button while on Layer 3
    const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
    resetBtn.click();

    // Proves reset returns to Layer 1
    expect(stateMachine.currentLayer).toBe('crypto');
    expect(container.querySelector('.layer-card__title')?.textContent).toBe('Encrypted Transmission');
    expect(container.querySelector('#crypto-answer')).not.toBeNull();
  });

  it('transitions from Layer 3 to Layer 4 and from Layer 4 to Layer 5 unlocked placeholder', async () => {
    const container = document.getElementById('layer-container')!;

    // 1. Complete Layer 1
    const cryptoInput = container.querySelector('#crypto-answer') as HTMLInputElement;
    const cryptoForm = container.querySelector('.answer-form') as HTMLFormElement;
    cryptoInput.value = 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE';
    cryptoForm.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(container.querySelector('#crypto-continue')).not.toBeNull();
    });
    (container.querySelector('#crypto-continue') as HTMLButtonElement).click();

    // 2. Complete Layer 2
    const seal = container.querySelector('#evidence-seal') as HTMLElement;
    seal.setAttribute('data-seal', 'verified');

    await vi.waitFor(() => {
      expect(container.querySelector('#dom-continue')).not.toBeNull();
    });
    (container.querySelector('#dom-continue') as HTMLButtonElement).click();

    // 3. Complete Layer 3 (cross-tab)
    expect(stateMachine.currentLayer).toBe('cross-tab');
    const crossTabInput = container.querySelector('#cross-tab-answer') as HTMLInputElement;
    const crossTabForm = container.querySelector('#cross-tab-form') as HTMLFormElement;
    crossTabInput.value = 'SIGNAL-SYNCHRONIZED';
    crossTabForm.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(container.querySelector('#cross-tab-continue')).not.toBeNull();
    });

    // Activating Continue on Layer 3 MUST render Layer 4 (Temporal Logic)
    (container.querySelector('#cross-tab-continue') as HTMLButtonElement).click();

    expect(stateMachine.currentLayer).toBe('temporal');
    expect(container.querySelector('.layer-card__title')?.textContent).toBe('Temporal Logic');
    expect(container.querySelectorAll('.timeline-event-card').length).toBe(5);

    // Verify progress indicator shows Layer 4 ACTIVE and Layer 5 LOCKED
    const navItems = document.querySelectorAll('#progress-nav .progress-item');
    expect(navItems[0].getAttribute('data-status')).toBe('solved');
    expect(navItems[1].getAttribute('data-status')).toBe('solved');
    expect(navItems[2].getAttribute('data-status')).toBe('solved');
    expect(navItems[3].getAttribute('data-status')).toBe('active');
    expect(navItems[4].getAttribute('data-status')).toBe('locked');

    // 4. Complete Layer 4 (Temporal Logic)
    const temporalInput = container.querySelector('#temporal-answer') as HTMLInputElement;
    const temporalForm = container.querySelector('#temporal-form') as HTMLFormElement;
    temporalInput.value = 'EV-302-EV-814-EV-409-EV-127-EV-955';
    temporalForm.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(container.querySelector('#temporal-continue')).not.toBeNull();
    });

    // Activating Continue on Layer 4 transitions to Layer 5 (Final Reveal / The Vault)
    (container.querySelector('#temporal-continue') as HTMLButtonElement).click();

    expect(stateMachine.currentLayer).toBe('final-reveal');
    expect(container.querySelector('.layer-card__title')?.textContent).toBe('Final Reveal');
    expect(container.querySelector('#vault-key-input')).not.toBeNull();

    // Progress indicator shows Layer 4 SOLVED, Layer 5 ACTIVE
    const midNav = document.querySelectorAll('#progress-nav .progress-item');
    expect(midNav[3].getAttribute('data-status')).toBe('solved');
    expect(midNav[4].getAttribute('data-status')).toBe('active');

    // 5. Complete Layer 5 (Final Vault)
    const vaultInput = container.querySelector('#vault-key-input') as HTMLInputElement;
    const vaultForm = container.querySelector('#vault-form') as HTMLFormElement;
    vaultInput.value = 'KNOWLEDGE-VERIFIED-SYNCHRONIZED-EV-955';
    vaultForm.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(stateMachine.currentLayer).toBeNull();
      expect(stateMachine.progression.every(e => e.status === 'solved')).toBe(true);
      expect(container.querySelector('.vault-completion-panel')).not.toBeNull();
    });

    // Progress indicator shows all 5 layers COMPLETE
    const finalNav = document.querySelectorAll('#progress-nav .progress-item');
    finalNav.forEach(item => expect(item.getAttribute('data-status')).toBe('solved'));
  });
});
