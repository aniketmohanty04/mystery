// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  TemporalLayer,
  CORRECT_CHRONOLOGY,
  INITIAL_SCRAMBLE,
  TOTAL_DURATION_MS,
  getEntropyTier,
  formatRemainingTime,
} from '../../src/layers/temporal-layer.js';
import { stateMachine } from '../../src/core/state-machine.js';

describe('TemporalLayer (Challenge 3 / Layer 4 — Temporal State Scrubber)', () => {
  let container: HTMLElement;
  let layer: TemporalLayer;

  beforeEach(async () => {
    vi.useFakeTimers();
    stateMachine.reset();
    // Advance state machine to Layer 4 (temporal)
    await stateMachine.solve('crypto', 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE');
    await stateMachine.solve('dom-inspect', 'verified');
    await stateMachine.solve('cross-tab', 'SIGNAL-SYNCHRONIZED');
    expect(stateMachine.currentLayer).toBe('temporal');

    container = document.createElement('div');
    document.body.appendChild(container);
    layer = new TemporalLayer();
    layer.mount(container);
    layer.activate();
  });

  afterEach(() => {
    layer.destroy();
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('mounts with the expected header, badge, scrubber axis, 5 evidence event cards, and preview', () => {
    const title = container.querySelector('.layer-card__title');
    expect(title?.textContent).toBe('Temporal Logic');

    const badge = container.querySelector('#temporal-badge');
    expect(badge?.textContent).toBe('CHRONOLOGY PENDING');

    const scrubber = container.querySelector('.scrubber-panel');
    expect(scrubber).not.toBeNull();

    const slider = container.querySelector('#temporal-scrubber-slider') as HTMLInputElement;
    expect(slider).not.toBeNull();
    expect(slider.value).toBe('1');

    const scrubberNodes = container.querySelectorAll('.scrubber-node');
    expect(scrubberNodes.length).toBe(5);

    const eventCards = container.querySelectorAll('.timeline-event-card');
    expect(eventCards.length).toBe(5);

    // Initial sequence preview matches INITIAL_SCRAMBLE
    const preview = container.querySelector('#timeline-sequence-preview');
    expect(preview?.textContent).toBe(INITIAL_SCRAMBLE.join(' \u2192 '));

    const input = container.querySelector('#temporal-answer') as HTMLInputElement;
    expect(input.value).toBe(INITIAL_SCRAMBLE.join('-'));
  });

  it('scrubber slider and slot buttons update active inspection slot and highlight corresponding card', () => {
    const slider = container.querySelector('#temporal-scrubber-slider') as HTMLInputElement;
    const nodes = container.querySelectorAll<HTMLButtonElement>('.scrubber-node');

    // Initially slot 1 is active
    expect(nodes[0].classList.contains('is-active')).toBe(true);
    expect(container.querySelectorAll('.timeline-event-card')[0].classList.contains('is-inspected')).toBe(true);

    // Click slot node 3 (index 2: EV-955)
    nodes[2].click();
    expect(layer['currentScrubberIndex']).toBe(2);
    const updatedSlider = container.querySelector<HTMLInputElement>('#temporal-scrubber-slider');
    expect(updatedSlider?.value).toBe('3');
    const updatedNodes = container.querySelectorAll<HTMLButtonElement>('.scrubber-node');
    expect(updatedNodes[2].classList.contains('is-active')).toBe(true);
    expect(updatedNodes[0].classList.contains('is-active')).toBe(false);
    expect(container.querySelectorAll('.timeline-event-card')[2].classList.contains('is-inspected')).toBe(true);

    // Inspector reflects the selected event details
    const inspId = container.querySelector('.scrubber-inspector strong');
    expect(inspId?.textContent?.trim()).toBe('EV-955');

    // Clicking an event card in the list directly updates scrubber
    const firstCard = container.querySelectorAll<HTMLElement>('.timeline-event-card')[0];
    firstCard.click();
    expect(layer['currentScrubberIndex']).toBe(0);
    expect(slider.value).toBe('1');
    expect(nodes[0].classList.contains('is-active')).toBe(true);
  });

  it('inspector shift earlier and shift later buttons reorder events and follow the moved event', () => {
    // Initially index 0 is EV-127, index 1 is EV-814
    layer.setScrubberIndex(1); // Inspect EV-814 at index 1
    expect(layer['currentOrder'][1]).toBe('EV-814');

    const inspUpBtn = container.querySelector<HTMLButtonElement>('#inspector-move-up-btn');
    expect(inspUpBtn).not.toBeNull();
    inspUpBtn?.click();

    // EV-814 shifted to index 0, scrubber follows to index 0
    expect(layer['currentOrder'][0]).toBe('EV-814');
    expect(layer['currentOrder'][1]).toBe('EV-127');
    expect(layer['currentScrubberIndex']).toBe(0);

    // Now index 0 shift earlier is disabled
    const updatedUpBtn = container.querySelector<HTMLButtonElement>('#inspector-move-up-btn');
    expect(updatedUpBtn?.disabled).toBe(true);

    // Shift later moves EV-814 back to index 1
    const inspDownBtn = container.querySelector<HTMLButtonElement>('#inspector-move-down-btn');
    inspDownBtn?.click();
    expect(layer['currentOrder'][0]).toBe('EV-127');
    expect(layer['currentOrder'][1]).toBe('EV-814');
    expect(layer['currentScrubberIndex']).toBe(1);
  });

  it('reorders events upward using moveUp on card and updates sequence preview', () => {
    // Initially index 0 is EV-127, index 1 is EV-814
    expect(layer['currentOrder'][0]).toBe('EV-127');
    expect(layer['currentOrder'][1]).toBe('EV-814');

    // Move index 1 (EV-814) up to index 0
    const upBtn = container.querySelectorAll<HTMLButtonElement>('.btn-move-up')[1];
    upBtn.click();

    expect(layer['currentOrder'][0]).toBe('EV-814');
    expect(layer['currentOrder'][1]).toBe('EV-127');

    const preview = container.querySelector('#timeline-sequence-preview');
    expect(preview?.textContent).toContain('EV-814 \u2192 EV-127');
  });

  it('reorders events downward using moveDown on card and updates sequence preview', () => {
    // Initially index 0 is EV-127, index 1 is EV-814
    expect(layer['currentOrder'][0]).toBe('EV-127');

    // Move index 0 down to index 1
    const downBtn = container.querySelectorAll<HTMLButtonElement>('.btn-move-down')[0];
    downBtn.click();

    expect(layer['currentOrder'][0]).toBe('EV-814');
    expect(layer['currentOrder'][1]).toBe('EV-127');
  });

  it('disables Move Up on first item and Move Down on last item', () => {
    const upButtons = container.querySelectorAll<HTMLButtonElement>('.btn-move-up');
    const downButtons = container.querySelectorAll<HTMLButtonElement>('.btn-move-down');

    expect(upButtons[0].disabled).toBe(true);
    expect(downButtons[4].disabled).toBe(true);
  });

  it('reorders events via drag and drop on timeline cards', () => {
    const cards = container.querySelectorAll<HTMLElement>('.timeline-event-card');
    const sourceCard = cards[0]; // EV-127
    const targetCard = cards[2]; // EV-955

    // Simulate drag start on index 0
    sourceCard.dispatchEvent(new Event('dragstart'));
    expect(sourceCard.classList.contains('is-dragging')).toBe(true);

    // Simulate drag over and drop on index 2
    targetCard.dispatchEvent(new Event('dragover'));
    targetCard.dispatchEvent(new Event('drop'));

    // EV-127 moved to index 2
    expect(layer['currentOrder'][2]).toBe('EV-127');
  });

  it('resets event ordering when Reset Order button is clicked', () => {
    // Move first item down
    layer.moveDown(0);
    expect(layer['currentOrder'][0]).not.toBe(INITIAL_SCRAMBLE[0]);

    const resetBtn = container.querySelector<HTMLButtonElement>('#reset-order-btn')!;
    resetBtn.click();

    expect(layer['currentOrder']).toEqual(INITIAL_SCRAMBLE);
    const input = container.querySelector<HTMLInputElement>('#temporal-answer')!;
    expect(input.value).toBe(INITIAL_SCRAMBLE.join('-'));
  });

  it('submits correct chronological order, marks layer solved, and renders continue button', async () => {
    const correctStr = CORRECT_CHRONOLOGY.join('-');
    const result = await layer.submitAnswer(correctStr);

    expect(result).toBe('accepted');

    // Badge updates to CHRONOLOGY VERIFIED
    const badge = container.querySelector('#temporal-badge');
    expect(badge?.textContent).toBe('CHRONOLOGY VERIFIED');

    // Status message displays success
    const statusEl = container.querySelector('#temporal-status');
    expect(statusEl?.textContent).toContain('Temporal sequence verified');

    // Reordering buttons disabled and submit button hidden
    const moveButtons = container.querySelectorAll<HTMLButtonElement>('.btn-move-up, .btn-move-down');
    moveButtons.forEach(btn => expect(btn.disabled).toBe(true));

    const submitBtn = container.querySelector<HTMLButtonElement>('#temporal-submit');
    expect(submitBtn?.style.display).toBe('none');

    // Continue button appears
    const continueBtn = container.querySelector<HTMLButtonElement>('#temporal-continue');
    expect(continueBtn).not.toBeNull();
    expect(continueBtn?.textContent).toBe('Continue to Final Stage');
  });

  it('provides diagnostic feedback indicating positional match count on incorrect order', async () => {
    const testOrder = 'EV-127-EV-955-EV-409-EV-302-EV-814';
    const result = await layer.submitAnswer(testOrder);

    expect(result).toBe('incorrect');

    const statusEl = container.querySelector('#temporal-status');
    expect(statusEl?.textContent).toContain('1 of 5 events in correct position');

    const submitBtn = container.querySelector<HTMLButtonElement>('#temporal-submit');
    expect(submitBtn?.disabled).toBe(false);
  });

  it('detects raw timestamp ordering and warns of timezone and clock drift paradox', async () => {
    const rawSorted = 'EV-814-EV-302-EV-409-EV-955-EV-127';
    const result = await layer.submitAnswer(rawSorted);

    expect(result).toBe('incorrect');

    const statusEl = container.querySelector('#temporal-status');
    expect(statusEl?.textContent).toContain('Temporal paradox detected');
    expect(statusEl?.textContent).toContain('hardware clock drift and timezone skew');
  });

  it('rejects malformed or incomplete sequence input with helpful feedback', async () => {
    const result1 = await layer.submitAnswer('EV-302-EV-814');
    expect(result1).toBe('incorrect');
    const statusEl = container.querySelector('#temporal-status');
    expect(statusEl?.textContent).toContain('Incomplete sequence');

    const result2 = await layer.submitAnswer('EV-302-EV-302-EV-409-EV-127-EV-955');
    expect(result2).toBe('incorrect');
    expect(statusEl?.textContent).toContain('Duplicate events detected');
  });

  it('progressively reveals hints up to 3 clues and disables button', () => {
    const hintBtn = container.querySelector<HTMLButtonElement>('#temporal-hint-btn')!;
    const hintsList = container.querySelector('#temporal-hints-list')!;

    expect(hintBtn.textContent).toContain('(0/3)');
    expect(hintsList.children.length).toBe(0);

    hintBtn.click();
    expect(hintBtn.textContent).toContain('(1/3)');
    expect(hintsList.children.length).toBe(1);
    expect(hintsList.children[0].textContent).toContain('CLUE 1');

    hintBtn.click();
    expect(hintBtn.textContent).toContain('(2/3)');
    expect(hintsList.children.length).toBe(2);

    hintBtn.click();
    expect(hintBtn.textContent).toContain('All Clues Revealed');
    expect(hintBtn.disabled).toBe(true);
    expect(hintsList.children.length).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // 90-Second Entropy Timer & Degradation Stages
  // ---------------------------------------------------------------------------

  it('initializes countdown timer at 90 seconds in Tier 1 (Coherent)', () => {
    const timerDisplay = container.querySelector('#entropy-timer-display');
    expect(timerDisplay?.textContent).toBe('01:30.00');

    const card = container.querySelector('.layer-card') as HTMLElement;
    expect(card.dataset.entropyTier).toBe('1');

    const tierBadge = container.querySelector('#entropy-tier-badge');
    expect(tierBadge?.textContent).toContain('TIER 1');
  });

  it('calculates deadline accurately and updates visual countdown and progress fill', () => {
    // Advance by 15.5 seconds
    vi.advanceTimersByTime(15500);

    const timerDisplay = container.querySelector('#entropy-timer-display');
    expect(timerDisplay?.textContent).toBe('01:14.50');

    const fillEl = container.querySelector('#entropy-meter-fill') as HTMLElement;
    const expectedWidth = ((90000 - 15500) / 90000) * 100;
    expect(parseFloat(fillEl.style.width)).toBeCloseTo(expectedWidth, 0);
  });

  it('progresses deterministically through 5 entropy stages as time elapses', () => {
    const card = container.querySelector('.layer-card') as HTMLElement;
    const tierBadge = container.querySelector('#entropy-tier-badge');

    // Tier 1: 90s - 61s (>60s remaining)
    expect(card.dataset.entropyTier).toBe('1');
    expect(tierBadge?.textContent).toContain('TIER 1');

    // Tier 2: 60s - 31s (advance 30s -> 60s remaining)
    vi.advanceTimersByTime(30000);
    expect(card.dataset.entropyTier).toBe('2');
    expect(tierBadge?.textContent).toContain('TIER 2');

    // Tier 3: 30s - 11s (advance another 35s -> 25s remaining)
    vi.advanceTimersByTime(35000);
    expect(card.dataset.entropyTier).toBe('3');
    expect(tierBadge?.textContent).toContain('TIER 3');

    // Tier 4: 10s - 1s (advance another 20s -> 5s remaining)
    vi.advanceTimersByTime(20000);
    expect(card.dataset.entropyTier).toBe('4');
    expect(tierBadge?.textContent).toContain('TIER 4');

    // Expired: 0s (advance 5s -> 0s remaining)
    vi.advanceTimersByTime(5000);
    expect(card.dataset.entropyTier).toBe('expired');
    expect(tierBadge?.textContent).toContain('COLLAPSE // TIMEOUT');
  });

  it('expires at zero seconds, entering timeout state and disabling puzzle controls', () => {
    vi.advanceTimersByTime(TOTAL_DURATION_MS);

    // Timeout panel appears
    const timeoutBanner = container.querySelector('#temporal-timeout-banner');
    expect(timeoutBanner).not.toBeNull();
    expect(timeoutBanner?.textContent).toContain('TEMPORAL COHERENCE COLLAPSED');

    // Status message displays failure
    const statusEl = container.querySelector('#temporal-status');
    expect(statusEl?.textContent).toContain('TEMPORAL COHERENCE COLLAPSED');

    // Submit button and inputs are disabled
    const submitBtn = container.querySelector<HTMLButtonElement>('#temporal-submit');
    expect(submitBtn?.disabled).toBe(true);

    const input = container.querySelector<HTMLInputElement>('#temporal-answer');
    expect(input?.disabled).toBe(true);

    const slider = container.querySelector<HTMLInputElement>('#temporal-scrubber-slider');
    expect(slider?.disabled).toBe(true);
  });

  it('rejects answer submissions attempted after expiration', async () => {
    vi.advanceTimersByTime(TOTAL_DURATION_MS);

    const correctStr = CORRECT_CHRONOLOGY.join('-');
    const result = await layer.submitAnswer(correctStr);

    expect(result).toBe('incorrect');
    expect(stateMachine.currentLayer).toBe('temporal'); // not advanced

    const statusEl = container.querySelector('#temporal-status');
    expect(statusEl?.textContent).toContain('TEMPORAL COHERENCE COLLAPSED');
  });

  it('accepts correct answer submitted immediately before expiration', async () => {
    // Advance to 89.5 seconds (500ms before expiration)
    vi.advanceTimersByTime(89500);

    const correctStr = CORRECT_CHRONOLOGY.join('-');
    const result = await layer.submitAnswer(correctStr);

    expect(result).toBe('accepted');
    expect(stateMachine.progression.find(e => e.id === 'temporal')?.status).toBe('solved');
    expect(stateMachine.progression.find(e => e.id === 'final-reveal')?.status).toBe('active');
    expect(stateMachine.currentLayer).toBe('final-reveal');
  });

  it('restarting the challenge clears timeout, creates fresh 90s deadline, and resets puzzle state', async () => {
    // Advance to timeout
    vi.advanceTimersByTime(TOTAL_DURATION_MS);
    expect(layer['isExpired']).toBe(true);

    // Click Reboot button
    const rebootBtn = container.querySelector<HTMLButtonElement>('#temporal-restart-btn');
    expect(rebootBtn).not.toBeNull();
    rebootBtn?.click();

    expect(layer['isExpired']).toBe(false);
    expect(layer.getRemainingTime()).toBe(TOTAL_DURATION_MS);
    expect(layer['currentOrder']).toEqual(INITIAL_SCRAMBLE);

    // Timeout banner removed
    expect(container.querySelector('#temporal-timeout-banner')).toBeNull();

    // Controls re-enabled
    const submitBtn = container.querySelector<HTMLButtonElement>('#temporal-submit');
    expect(submitBtn?.disabled).toBe(false);

    const input = container.querySelector<HTMLInputElement>('#temporal-answer');
    expect(input?.disabled).toBe(false);

    // Submitting correct sequence now succeeds
    const result = await layer.submitAnswer(CORRECT_CHRONOLOGY.join('-'));
    expect(result).toBe('accepted');
  });

  it('solving the puzzle stops the countdown timer and prevents expiration', async () => {
    const correctStr = CORRECT_CHRONOLOGY.join('-');
    await layer.submitAnswer(correctStr);

    expect(layer['timerInterval']).toBeNull();

    // Advancing past 90s does not cause timeout
    vi.advanceTimersByTime(TOTAL_DURATION_MS * 2);
    expect(container.querySelector('#temporal-timeout-banner')).toBeNull();
    expect(container.querySelector('#temporal-badge')?.textContent).toBe('CHRONOLOGY VERIFIED');
  });

  it('recalculates remaining time from deadline on tab visibilitychange', () => {
    const initialTime = layer.getRemainingTime();
    expect(initialTime).toBe(TOTAL_DURATION_MS);

    // Simulate time elapsed while tab was throttled in background
    vi.advanceTimersByTime(40000);

    // Dispatch visibilitychange
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));

    const timerDisplay = container.querySelector('#entropy-timer-display');
    expect(timerDisplay?.textContent).toBe('00:50.00');
  });

  it('destroy cleans up timers, listeners, and DOM elements', () => {
    expect(container.children.length).toBe(1);
    expect(layer['timerInterval']).not.toBeNull();

    layer.destroy();

    expect(container.children.length).toBe(0);
    expect(layer['timerInterval']).toBeNull();
  });

  it('re-entering the challenge creates a fresh deadline without accumulating duplicate timers', () => {
    layer.destroy();

    const layer2 = new TemporalLayer();
    layer2.mount(container);
    layer2.activate();

    expect(layer2.getRemainingTime()).toBe(TOTAL_DURATION_MS);
    expect(layer2['timerInterval']).not.toBeNull();

    layer2.destroy();
    expect(layer2['timerInterval']).toBeNull();
  });

  it('helper functions getEntropyTier and formatRemainingTime behave deterministically', () => {
    expect(getEntropyTier(90000)).toBe('1');
    expect(getEntropyTier(60001)).toBe('1');
    expect(getEntropyTier(60000)).toBe('2');
    expect(getEntropyTier(30001)).toBe('2');
    expect(getEntropyTier(30000)).toBe('3');
    expect(getEntropyTier(10001)).toBe('3');
    expect(getEntropyTier(10000)).toBe('4');
    expect(getEntropyTier(1)).toBe('4');
    expect(getEntropyTier(0)).toBe('expired');
    expect(getEntropyTier(-500)).toBe('expired');

    expect(formatRemainingTime(90000)).toBe('01:30.00');
    expect(formatRemainingTime(65430)).toBe('01:05.43');
    expect(formatRemainingTime(5000)).toBe('00:05.00');
    expect(formatRemainingTime(0)).toBe('00:00.00');
    expect(formatRemainingTime(-100)).toBe('00:00.00');
  });
});
