// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  FinalVaultLayer,
  FINAL_VAULT_KEY,
  EVIDENCE_DOSSIERS,
} from '../../src/layers/final-vault-layer.js';
import { stateMachine } from '../../src/core/state-machine.js';

describe('FinalVaultLayer (Phase 5 — The Final Vault)', () => {
  let container: HTMLElement;
  let layer: FinalVaultLayer;

  beforeEach(async () => {
    stateMachine.reset();
    // Advance state machine through all prerequisite layers: 1 -> 2 -> 3 -> 4 -> 5
    await stateMachine.solve('crypto', 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE');
    await stateMachine.solve('dom-inspect', 'verified');
    await stateMachine.solve('cross-tab', 'SIGNAL-SYNCHRONIZED');
    await stateMachine.solve('temporal', 'EV-302-EV-814-EV-409-EV-127-EV-955');
    expect(stateMachine.currentLayer).toBe('final-reveal');

    container = document.createElement('div');
    document.body.appendChild(container);
    layer = new FinalVaultLayer();
    layer.mount(container);
    layer.activate();
  });

  afterEach(() => {
    layer.destroy();
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
  });

  it('mounts with the expected header, badge, blast door graphic, 4 evidence dossiers, and synthesis bar', () => {
    const title = container.querySelector('.layer-card__title');
    expect(title?.textContent).toBe('Final Reveal');

    const badge = container.querySelector('#vault-badge');
    expect(badge?.textContent).toContain('VAULT SEALED');

    const blastDoor = container.querySelector('#vault-blast-door');
    expect(blastDoor).not.toBeNull();

    const dossiers = container.querySelectorAll('.dossier-card');
    expect(dossiers.length).toBe(EVIDENCE_DOSSIERS.length);

    const input = container.querySelector('#vault-key-input') as HTMLInputElement;
    expect(input).not.toBeNull();
  });

  it('extracts tokens into corresponding quadrants when dossier buttons are clicked', () => {
    const extractButtons = container.querySelectorAll<HTMLButtonElement>('.btn-extract-token');
    expect(extractButtons.length).toBe(4);

    // Extract Quadrant 1: KNOWLEDGE
    extractButtons[0].click();
    const slot0 = container.querySelector('#slot-quadrant-0');
    expect(slot0?.classList.contains('is-filled')).toBe(true);
    expect(slot0?.textContent).toContain('KNOWLEDGE');

    // Extract Quadrant 2: VERIFIED
    extractButtons[1].click();
    const slot1 = container.querySelector('#slot-quadrant-1');
    expect(slot1?.classList.contains('is-filled')).toBe(true);
    expect(slot1?.textContent).toContain('VERIFIED');

    // Bolt indicator updates
    const bolt0 = container.querySelector('.vault-bolt[data-bolt="0"]');
    expect(bolt0?.classList.contains('is-ready')).toBe(true);
  });

  it('clicking Assemble alone reveals/assembles dossiers but does NOT complete the challenge or populate quadrants', () => {
    const assembleBtn = container.querySelector<HTMLButtonElement>('#btn-assemble-all');
    expect(assembleBtn).not.toBeNull();
    assembleBtn?.click();

    // Challenge is NOT complete
    expect(stateMachine.currentLayer).toBe('final-reveal');
    expect(layer.isSolved).toBe(false);

    // Quadrants are NOT populated
    for (let i = 0; i < 4; i++) {
      const slot = container.querySelector(`#slot-quadrant-${i}`);
      expect(slot?.classList.contains('is-filled')).toBe(false);
    }

    // Input is NOT auto-filled with the solved key
    const input = container.querySelector<HTMLInputElement>('#vault-key-input');
    expect(input?.value).not.toBe(FINAL_VAULT_KEY);

    // Vault blast door remains locked
    const blastDoor = container.querySelector('#vault-blast-door');
    expect(blastDoor?.classList.contains('is-open')).toBe(false);
    expect(container.querySelector('.vault-completion-panel')).toBeNull();

    // Button updates state to disabled
    expect(assembleBtn?.disabled).toBe(true);
    expect(assembleBtn?.textContent).toContain('Dossiers Assembled');
  });

  it('validates each quadrant independently from 0/4 to 4/4 and rejects invalid tokens from counting', () => {
    const lockStatus = container.querySelector('#vault-lock-status');
    const progressLabel = container.querySelector('#quadrant-progress-label');
    expect(lockStatus?.textContent).toContain('0 OF 4 QUADRANTS ALIGNED');
    expect(progressLabel?.textContent).toContain('(0/4)');

    // Extract Quadrant 0: KNOWLEDGE (1/4)
    layer.extractToken(0, 'KNOWLEDGE');
    expect(layer.getValidQuadrantCount()).toBe(1);
    expect(lockStatus?.textContent).toContain('1 OF 4 QUADRANTS ALIGNED');
    expect(progressLabel?.textContent).toContain('(1/4)');

    // Extract Quadrant 1: VERIFIED (2/4)
    layer.extractToken(1, 'VERIFIED');
    expect(layer.getValidQuadrantCount()).toBe(2);
    expect(lockStatus?.textContent).toContain('2 OF 4 QUADRANTS ALIGNED');
    expect(progressLabel?.textContent).toContain('(2/4)');

    // Extract invalid token into Quadrant 2: should NOT count towards progress!
    layer.extractToken(2, 'INVALID_TOKEN');
    expect(layer.getValidQuadrantCount()).toBe(2);
    expect(lockStatus?.textContent).toContain('2 OF 4 QUADRANTS ALIGNED');
    expect(progressLabel?.textContent).toContain('(2/4)');
    const slot2 = container.querySelector('#slot-quadrant-2');
    expect(slot2?.classList.contains('is-invalid')).toBe(true);
    expect(slot2?.classList.contains('is-filled')).toBe(false);

    // Replace with correct token: SYNCHRONIZED (3/4)
    layer.extractToken(2, 'SYNCHRONIZED');
    expect(layer.getValidQuadrantCount()).toBe(3);
    expect(lockStatus?.textContent).toContain('3 OF 4 QUADRANTS ALIGNED');
    expect(progressLabel?.textContent).toContain('(3/4)');
    expect(slot2?.classList.contains('is-filled')).toBe(true);
    expect(slot2?.classList.contains('is-invalid')).toBe(false);

    // Extract Quadrant 3: EV-955 (4/4)
    layer.extractToken(3, 'EV-955');
    expect(layer.getValidQuadrantCount()).toBe(4);
    expect(lockStatus?.textContent).toContain('4 OF 4 QUADRANTS ALIGNED');
    expect(progressLabel?.textContent).toContain('(4/4)');
  });

  it('clears assembled quadrants when Clear Key button is clicked', () => {
    layer.extractToken(0, 'KNOWLEDGE');
    layer.extractToken(1, 'VERIFIED');
    layer.extractToken(2, 'SYNCHRONIZED');
    layer.extractToken(3, 'EV-955');

    const input = container.querySelector<HTMLInputElement>('#vault-key-input');
    expect(input?.value).toBe(FINAL_VAULT_KEY);

    const clearBtn = container.querySelector<HTMLButtonElement>('#btn-clear-key');
    clearBtn?.click();

    for (let i = 0; i < 4; i++) {
      const slot = container.querySelector(`#slot-quadrant-${i}`);
      expect(slot?.classList.contains('is-filled')).toBe(false);
    }
    expect(input?.value).toBe('');
    const label = container.querySelector('#quadrant-progress-label');
    expect(label?.textContent).toContain('(0/4)');
  });

  it('rejects partial submissions (1, 2, or 3 tokens) without completing the challenge', async () => {
    // 1 token
    const res1 = await layer.submitAnswer('KNOWLEDGE');
    expect(res1).toBe('incorrect');
    expect(stateMachine.currentLayer).toBe('final-reveal');
    expect(layer.isSolved).toBe(false);

    // 2 tokens
    const res2 = await layer.submitAnswer('KNOWLEDGE-VERIFIED');
    expect(res2).toBe('incorrect');
    expect(stateMachine.currentLayer).toBe('final-reveal');

    // 3 tokens
    const res3 = await layer.submitAnswer('KNOWLEDGE-VERIFIED-SYNCHRONIZED');
    expect(res3).toBe('incorrect');
    expect(stateMachine.currentLayer).toBe('final-reveal');

    // Vault remains locked
    const blastDoor = container.querySelector('#vault-blast-door');
    expect(blastDoor?.classList.contains('is-open')).toBe(false);
  });

  it('rejects empty or whitespace-only submissions', async () => {
    const res1 = await layer.submitAnswer('');
    expect(res1).toBe('incorrect');
    expect(stateMachine.currentLayer).toBe('final-reveal');
    const statusEl = container.querySelector('#vault-status');
    expect(statusEl?.textContent).toContain('Invalid key format');

    const res2 = await layer.submitAnswer('    ');
    expect(res2).toBe('incorrect');
    expect(stateMachine.currentLayer).toBe('final-reveal');
    expect(statusEl?.textContent).toContain('Invalid key format');
  });

  it('rejects submission if prerequisite layers are not solved', async () => {
    stateMachine.reset(); // Returns to Layer 1 (crypto)
    expect(stateMachine.currentLayer).toBe('crypto');

    // Attempt direct solve on final-reveal
    const result = await layer.submitAnswer(FINAL_VAULT_KEY);
    expect(result).toBe('incorrect');
    expect(stateMachine.currentLayer).toBe('crypto');
  });

  it('submits correct synthesized master key, opens vault doors, and renders completion screen', async () => {
    const result = await layer.submitAnswer(FINAL_VAULT_KEY);
    expect(result).toBe('accepted');

    // State machine reflects complete
    expect(stateMachine.currentLayer).toBeNull();
    expect(stateMachine.progression.every(e => e.status === 'solved')).toBe(true);

    // Vault door graphic displays opened state
    const blastDoor = container.querySelector('#vault-blast-door');
    expect(blastDoor?.classList.contains('is-open')).toBe(true);

    const dial = container.querySelector('#vault-dial');
    expect(dial?.classList.contains('is-unlocked')).toBe(true);

    // Badge reflects ACCESS GRANTED
    const badge = container.querySelector('#vault-badge');
    expect(badge?.textContent).toContain('VAULT UNLOCKED');

    // Completion panel is rendered
    const completionPanel = container.querySelector('.vault-completion-panel');
    expect(completionPanel).not.toBeNull();
    expect(completionPanel?.textContent).toContain('OPERATION OMEGA');
    expect(completionPanel?.textContent).toContain('Case File 409-B');

    // Form is hidden
    const form = container.querySelector('#vault-form') as HTMLFormElement;
    expect(form.style.display).toBe('none');
  });

  it('provides diagnostic feedback indicating number of correctly aligned quadrants for incorrect key', async () => {
    // 2 correct: KNOWLEDGE and VERIFIED; 2 wrong: WRONG and WRONG2
    const testKey = 'KNOWLEDGE-VERIFIED-WRONG-WRONG2';
    const result = await layer.submitAnswer(testKey);

    expect(result).toBe('incorrect');
    const statusEl = container.querySelector('#vault-status');
    expect(statusEl?.textContent).toContain('2 of 4 quadrant tokens correctly aligned');
  });

  it('detects single-stage keys pasted alone and warns player to synthesize all four files', async () => {
    const single1 = await layer.submitAnswer('MYSTERY-BOX-OPENS-WITH-KNOWLEDGE');
    expect(single1).toBe('incorrect');
    let statusEl = container.querySelector('#vault-status');
    expect(statusEl?.textContent).toContain('Single-stage transmission key detected');

    const single2 = await layer.submitAnswer('VERIFIED');
    expect(single2).toBe('incorrect');
    statusEl = container.querySelector('#vault-status');
    expect(statusEl?.textContent).toContain('Single-stage seal status detected');

    const single3 = await layer.submitAnswer('SIGNAL-SYNCHRONIZED');
    expect(single3).toBe('incorrect');
    statusEl = container.querySelector('#vault-status');
    expect(statusEl?.textContent).toContain('Single-stage carrier signal detected');

    const single4 = await layer.submitAnswer('EV-302-EV-814-EV-409-EV-127-EV-955');
    expect(single4).toBe('incorrect');
    statusEl = container.querySelector('#vault-status');
    expect(statusEl?.textContent).toContain('Single-stage chronology sequence detected');
  });

  it('rejects malformed or incomplete keys with helpful format feedback', async () => {
    const result1 = await layer.submitAnswer('KNOWLEDGE-VERIFIED');
    expect(result1).toBe('incorrect');
    const statusEl = container.querySelector('#vault-status');
    expect(statusEl?.textContent).toContain('Synthesis incomplete');

    const result2 = await layer.submitAnswer('   ');
    expect(result2).toBe('incorrect');
    expect(statusEl?.textContent).toContain('Invalid key format');
  });

  it('progressively reveals hints up to 4 clues and disables button', () => {
    const hintBtn = container.querySelector<HTMLButtonElement>('#vault-hint-btn')!;
    const hintsList = container.querySelector('#vault-hints-list')!;

    expect(hintBtn.textContent).toContain('(0/4)');
    expect(hintsList.children.length).toBe(0);

    hintBtn.click();
    expect(hintBtn.textContent).toContain('(1/4)');
    expect(hintsList.children.length).toBe(1);
    expect(hintsList.children[0].textContent).toContain('CLUE 1');

    hintBtn.click();
    hintBtn.click();
    hintBtn.click();

    expect(hintBtn.textContent).toContain('All Clues Revealed');
    expect(hintBtn.disabled).toBe(true);
    expect(hintsList.children.length).toBe(4);
  });

  it('reset button on completion screen resets state machine and returns to Layer 1', async () => {
    await layer.submitAnswer(FINAL_VAULT_KEY);
    expect(stateMachine.currentLayer).toBeNull();

    const resetBtn = container.querySelector<HTMLButtonElement>('#vault-reset-btn');
    expect(resetBtn).not.toBeNull();
    resetBtn?.click();

    expect(stateMachine.currentLayer).toBe('crypto');
    expect(stateMachine.progression[0].status).toBe('active');
    expect(stateMachine.progression[1].status).toBe('locked');
  });

  it('succeeds when all four correct tokens are extracted via buttons and submitted via form', async () => {
    const extractButtons = container.querySelectorAll<HTMLButtonElement>('.btn-extract-token');
    expect(extractButtons.length).toBe(4);

    extractButtons[0].click(); // KNOWLEDGE
    extractButtons[1].click(); // VERIFIED
    extractButtons[2].click(); // SYNCHRONIZED
    extractButtons[3].click(); // EV-955

    const input = container.querySelector<HTMLInputElement>('#vault-key-input');
    expect(input?.value).toBe(FINAL_VAULT_KEY);

    const form = container.querySelector<HTMLFormElement>('#vault-form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    // Wait for async solve
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(layer.isSolved).toBe(true);
    expect(stateMachine.currentLayer).toBeNull();
    const blastDoor = container.querySelector('#vault-blast-door');
    expect(blastDoor?.classList.contains('is-open')).toBe(true);
  });

  it('prevents concurrent submissions and returns busy when submission is in flight', async () => {
    const p1 = layer.submitAnswer(FINAL_VAULT_KEY);
    const p2 = layer.submitAnswer(FINAL_VAULT_KEY);

    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1).toBe('accepted');
    expect(res2).toBe('busy');
  });

  it('destroy unmounts DOM and removes event listeners cleanly', () => {
    expect(container.children.length).toBe(1);
    layer.destroy();
    expect(container.children.length).toBe(0);
  });
});
