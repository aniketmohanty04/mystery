// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CryptoLayer } from '../../src/layers/crypto-layer.js';
import { stateMachine } from '../../src/core/state-machine.js';

describe('CryptoLayer DOM & Interaction', () => {
  let container: HTMLElement;
  let layer: CryptoLayer;

  beforeEach(() => {
    stateMachine.reset();
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);
    layer = new CryptoLayer();
    layer.mount(container);
    layer.activate();
  });

  it('renders the classified forensic evidence card structure', () => {
    const card = container.querySelector('.layer-card');
    expect(card).not.toBeNull();
    expect(card?.getAttribute('data-status')).toBe('active');

    const title = container.querySelector('.layer-card__title');
    expect(title?.textContent).toBe('Encrypted Transmission');

    const ciphertext = container.querySelector('.ciphertext');
    expect(ciphertext?.textContent).toBe('ZLFGREL-OBK-BCRAF-JVGU-XABJYRQTR');
  });

  it('shows validation message on empty submission', async () => {
    const form = container.querySelector('.answer-form') as HTMLFormElement;
    const input = container.querySelector('#crypto-answer') as HTMLInputElement;
    const status = container.querySelector('#crypto-status') as HTMLElement;

    input.value = '';
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(status.textContent).toBe('Please enter a decrypted message.');
    expect(status.className).toContain('answer-form__status--info');
  });

  it('shows error message on incorrect answer submission', async () => {
    const form = container.querySelector('.answer-form') as HTMLFormElement;
    const input = container.querySelector('#crypto-answer') as HTMLInputElement;
    const status = container.querySelector('#crypto-status') as HTMLElement;

    input.value = 'INCORRECT-GUESS';
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    // Wait for async validation
    await vi.waitFor(() => {
      expect(status.textContent).toBe('Transmission still encrypted. Check your decoding.');
    });
    expect(status.className).toContain('answer-form__status--error');
  });

  it('progressively reveals hints on button clicks', () => {
    const toggle = container.querySelector('.hints__toggle') as HTMLButtonElement;
    const list = container.querySelector('#hints-list') as HTMLOListElement;

    expect(list.hidden).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    // Click 1: Reveal hint 1
    toggle.click();
    expect(list.hidden).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(list.children.length).toBe(1);
    expect(list.children[0].textContent).toContain('The shift is 13');

    // Click 2: Reveal hint 2
    toggle.click();
    expect(list.children.length).toBe(2);
    expect(list.children[1].textContent).toContain('Decode the first word');

    // Click 3: Reveal hint 3
    toggle.click();
    expect(list.children.length).toBe(3);
    expect(list.children[2].textContent).toContain('ZLFGREL = MYSTERY');
    expect(toggle.disabled).toBe(true);
    expect(toggle.textContent).toBe('All hints revealed');
  });

  it('marks solved and updates visible feedback on correct submission', async () => {
    const form = container.querySelector('.answer-form') as HTMLFormElement;
    const input = container.querySelector('#crypto-answer') as HTMLInputElement;
    const status = container.querySelector('#crypto-status') as HTMLElement;
    const submitBtn = container.querySelector('#crypto-submit') as HTMLButtonElement;

    input.value = 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE';
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await vi.waitFor(() => {
      expect(status.textContent).toBe('Transmission decoded. Clearance granted.');
    });

    expect(status.className).toContain('answer-form__status--success');
    expect(input.disabled).toBe(true);
    expect(submitBtn.disabled).toBe(true);
    expect(submitBtn.textContent).toBe('Solved');

    const badge = container.querySelector('.layer-meta__badge');
    expect(badge?.textContent).toBe('DECODED');
    expect(badge?.className).toContain('badge--solved');
  });

  it('destroys and cleans up DOM when destroy is called', () => {
    expect(container.children.length).toBe(1);
    layer.destroy();
    expect(container.children.length).toBe(0);
  });

  it('provides feedback ("Failed") when clipboard API is missing or fails', async () => {
    const copyBtn = container.querySelector('.artifact__copy') as HTMLButtonElement;

    // Test Case A: navigator.clipboard.writeText rejects
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    });

    copyBtn.click();
    await vi.waitFor(() => {
      expect(copyBtn.textContent).toBe('Failed');
      expect(copyBtn.disabled).toBe(true);
    });

    // Test Case B: navigator.clipboard is undefined
    Object.assign(navigator, { clipboard: undefined });
    copyBtn.disabled = false;
    copyBtn.textContent = 'Copy';
    copyBtn.click();

    expect(copyBtn.textContent).toBe('Failed');
    expect(copyBtn.disabled).toBe(true);
  });

  it('provides feedback ("Copied") when clipboard API succeeds', async () => {
    const copyBtn = container.querySelector('.artifact__copy') as HTMLButtonElement;
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    copyBtn.click();
    await vi.waitFor(() => {
      expect(copyBtn.textContent).toBe('Copied');
      expect(copyBtn.disabled).toBe(true);
    });
    expect(writeTextMock).toHaveBeenCalledWith('ZLFGREL-OBK-BCRAF-JVGU-XABJYRQTR');
  });
});
