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
});
