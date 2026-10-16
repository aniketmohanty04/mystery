// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DomLayer } from '../../src/layers/dom-layer.js';
import { stateMachine } from '../../src/core/state-machine.js';

describe('DomLayer — Live DOM Mutation Puzzle', () => {
  let container: HTMLElement;
  let layer: DomLayer;

  beforeEach(async () => {
    stateMachine.reset();
    // First solve Layer 1 to advance stateMachine to Layer 2 (dom-inspect)
    await stateMachine.solve('crypto', 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE');
    expect(stateMachine.currentLayer).toBe('dom-inspect');

    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.appendChild(container);

    layer = new DomLayer();
    layer.mount(container);
    layer.activate();
  });

  afterEach(() => {
    layer.destroy();
  });

  /** Rendered status of the layer card (the layer keeps no duplicate status field). */
  const cardStatus = () => container.querySelector('.layer-card')?.getAttribute('data-status');

  it('renders the initial DOM structure with data-seal="intact"', () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;
    expect(sealEl).not.toBeNull();
    expect(sealEl.getAttribute('data-seal')).toBe('intact');

    const badge = container.querySelector('#seal-status-badge');
    expect(badge?.textContent).toBe('SEAL: INTACT');

    const displayValue = container.querySelector('#seal-display-value');
    expect(displayValue?.textContent).toBe('intact');

    const guide = container.querySelector('.devtools-guide');
    expect(guide).not.toBeNull();
  });

  it('solves Layer 2 when data-seal attribute is mutated to "verified"', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;
    const badge = container.querySelector('#seal-status-badge');
    const msg = container.querySelector('#seal-feedback-message');

    // Simulate user editing the attribute in DevTools Elements panel
    sealEl.setAttribute('data-seal', 'verified');

    await vi.waitFor(() => {
      expect(sealEl.getAttribute('data-seal')).toBe('verified');
      expect(badge?.textContent).toBe('SEAL: VERIFIED');
      expect(msg?.textContent).toContain('Seal integrity verified');
    });

    // Check layer and state machine progression
    expect(cardStatus()).toBe('solved');
    expect(stateMachine.progression.find(e => e.id === 'dom-inspect')?.status).toBe('solved');
    // Layer 3 (cross-tab) is unlocked
    expect(stateMachine.progression.find(e => e.id === 'cross-tab')?.status).toBe('unlocked');
    // currentLayer is null because Phase 3 is not implemented
    expect(stateMachine.currentLayer).toBeNull();
  });

  it('handles case-insensitive and trimmed values such as "  VERIFIED  "', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;
    sealEl.setAttribute('data-seal', '  VERIFIED  ');

    await vi.waitFor(() => {
      expect(cardStatus()).toBe('solved');
    });
    expect(stateMachine.progression.find(e => e.id === 'dom-inspect')?.status).toBe('solved');
  });

  it('does NOT solve Layer 2 when data-seal is changed to an incorrect value', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;
    const badge = container.querySelector('#seal-status-badge');
    const msg = container.querySelector('#seal-feedback-message');

    sealEl.setAttribute('data-seal', 'unlocked');

    await vi.waitFor(() => {
      expect(badge?.textContent).toBe('SEAL: INVALID');
      expect(msg?.textContent).toContain('Tamper-evident seal rejected');
    });

    expect(cardStatus()).toBe('active');
    expect(stateMachine.progression.find(e => e.id === 'dom-inspect')?.status).toBe('active');
  });

  it('does NOT solve Layer 2 when mutating a different attribute on the target element', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;

    // Mutate a different attribute like 'data-other' or 'title'
    sealEl.setAttribute('data-other', 'verified');
    sealEl.setAttribute('title', 'verified');

    // Wait microtask tick
    await new Promise(r => setTimeout(r, 20));

    expect(cardStatus()).toBe('active');
    expect(stateMachine.progression.find(e => e.id === 'dom-inspect')?.status).toBe('active');
  });

  it('does NOT solve Layer 2 when mutating a different element in the DOM', async () => {
    // Create an unrelated element and mutate its data-seal
    const otherEl = document.createElement('div');
    otherEl.id = 'other-element';
    container.appendChild(otherEl);

    otherEl.setAttribute('data-seal', 'verified');

    await new Promise(r => setTimeout(r, 20));

    expect(cardStatus()).toBe('active');
    expect(stateMachine.progression.find(e => e.id === 'dom-inspect')?.status).toBe('active');
  });

  it('does NOT solve Layer 2 on unrelated DOM child changes or text content changes', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;

    // Append child or change text
    const extraChild = document.createElement('span');
    extraChild.textContent = 'verified';
    sealEl.appendChild(extraChild);

    await new Promise(r => setTimeout(r, 20));

    expect(cardStatus()).toBe('active');
    expect(stateMachine.progression.find(e => e.id === 'dom-inspect')?.status).toBe('active');
  });

  it('disconnects MutationObserver on solve and does not emit duplicate transitions on subsequent mutations', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;

    const transitionEvents: unknown[] = [];
    stateMachine.on('transition', payload => {
      transitionEvents.push(payload);
    });

    // Mutate to verified -> solves
    sealEl.setAttribute('data-seal', 'verified');

    await vi.waitFor(() => {
      expect(cardStatus()).toBe('solved');
    });

    expect(transitionEvents).toHaveLength(1);

    // Subsequent mutations on the element must NOT trigger anything
    sealEl.setAttribute('data-seal', 'intact');
    sealEl.setAttribute('data-seal', 'verified');

    await new Promise(r => setTimeout(r, 20));

    expect(transitionEvents).toHaveLength(1);
  });

  it('disconnects observer on destroy', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;
    layer.destroy();

    // Mutating target element after destroy must not cause any state changes or errors
    sealEl.setAttribute('data-seal', 'verified');
    await new Promise(r => setTimeout(r, 20));

    expect(stateMachine.progression.find(e => e.id === 'dom-inspect')?.status).toBe('active');
  });

  it('progressively reveals hints for Layer 2', () => {
    const hintsToggle = container.querySelector('.hints__toggle') as HTMLButtonElement;
    const hintsList = container.querySelector('#hints-list-dom') as HTMLOListElement;

    expect(hintsList.hidden).toBe(true);

    // Reveal 1
    hintsToggle.click();
    expect(hintsList.hidden).toBe(false);
    expect(hintsList.children.length).toBe(1);
    expect(hintsList.children[0].textContent).toContain('Developer Tools');

    // Reveal 2
    hintsToggle.click();
    expect(hintsList.children.length).toBe(2);
    expect(hintsList.children[1].textContent).toContain('id="evidence-seal"');

    // Reveal 3
    hintsToggle.click();
    expect(hintsList.children.length).toBe(3);
    expect(hintsList.children[2].textContent).toContain('verified');
    expect(hintsToggle.disabled).toBe(true);
    expect(hintsToggle.textContent).toBe('All hints revealed');
  });

  it('does NOT show VERIFIED when the state machine rejects (e.g. stateMachine not on Layer 2)', async () => {
    // Reset state machine back to initial Layer 1 (crypto)
    stateMachine.reset();
    expect(stateMachine.currentLayer).toBe('crypto');

    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;
    const badge = container.querySelector('#seal-status-badge');
    const msg = container.querySelector('#seal-feedback-message');

    // Mutate to verified while stateMachine is on crypto
    sealEl.setAttribute('data-seal', 'verified');

    await vi.waitFor(() => {
      // Must show SEAL: REJECTED, NOT SEAL: VERIFIED
      expect(badge?.textContent).toBe('SEAL: REJECTED');
      expect(msg?.textContent).toContain('Seal override rejected');
    });

    // Layer must not be solved
    expect(cardStatus()).toBe('active');
    expect(container.querySelector('#dom-continue')).toBeNull();
  });

  it('shows Continue button on solve and dispatches layer:continue on click', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;
    let continueFired = false;
    container.addEventListener('layer:continue', () => {
      continueFired = true;
    });

    sealEl.setAttribute('data-seal', 'verified');

    await vi.waitFor(() => {
      expect(cardStatus()).toBe('solved');
    });

    const continueBtn = container.querySelector('#dom-continue') as HTMLButtonElement;
    expect(continueBtn).not.toBeNull();
    continueBtn.click();
    expect(continueFired).toBe(true);
  });

  it('wrong-value feedback message does not print the expected value "verified"', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;
    const msg = container.querySelector('#seal-feedback-message');

    sealEl.setAttribute('data-seal', 'wrong-seal');

    await vi.waitFor(() => {
      expect(msg?.textContent).toContain('Attribute set to "wrong-seal"');
    });

    expect(msg?.textContent).not.toContain('Expected attribute value');
    expect(msg?.textContent).not.toContain('verified');
  });

  it('removing data-seal attribute does not crash or solve', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;
    expect(() => {
      sealEl.removeAttribute('data-seal');
    }).not.toThrow();

    await new Promise(r => setTimeout(r, 20));
    expect(cardStatus()).toBe('active');
  });

  it('shows an unavailable message when validation errors, and a retry still solves', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;
    const badge = container.querySelector('#seal-status-badge');
    const msg = container.querySelector('#seal-feedback-message');

    const spy = vi.spyOn(stateMachine, 'solve').mockResolvedValueOnce('error');
    sealEl.setAttribute('data-seal', 'verified');

    await vi.waitFor(() => {
      expect(badge?.textContent).toBe('SEAL: UNAVAILABLE');
    });
    expect(msg?.textContent).toContain('HTTPS or on localhost');
    expect(cardStatus()).toBe('active');
    expect(container.querySelector('#dom-continue')).toBeNull();
    spy.mockRestore();

    // Observer is still live: touching the attribute again retries and succeeds.
    sealEl.setAttribute('data-seal', 'verified');
    await vi.waitFor(() => {
      expect(cardStatus()).toBe('solved');
    });
    expect(badge?.textContent).toBe('SEAL: VERIFIED');
  });

  it('moves focus to the Continue button once solved', async () => {
    const sealEl = container.querySelector('#evidence-seal') as HTMLElement;
    sealEl.setAttribute('data-seal', 'verified');
    await vi.waitFor(() => {
      expect(container.querySelector('#dom-continue')).not.toBeNull();
    });
    expect(document.activeElement?.id).toBe('dom-continue');
  });
});
