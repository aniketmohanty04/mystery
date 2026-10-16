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
    expect(dossiers.length).toBe(4);

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

  it('assembles all 4 discovered tokens with assembleAllTokens button', () => {
    const assembleBtn = container.querySelector<HTMLButtonElement>('#btn-assemble-all');
    expect(assembleBtn).not.toBeNull();
    assembleBtn?.click();

    for (let i = 0; i < 4; i++) {
      const slot = container.querySelector(`#slot-quadrant-${i}`);
      expect(slot?.classList.contains('is-filled')).toBe(true);
      expect(slot?.textContent).toContain(EVIDENCE_DOSSIERS[i].token);
    }

    const input = container.querySelector<HTMLInputElement>('#vault-key-input');
    expect(input?.value).toBe(FINAL_VAULT_KEY);
  });

  it('clears assembled quadrants when Clear Key button is clicked', () => {
    layer.assembleAllTokens();
    const input = container.querySelector<HTMLInputElement>('#vault-key-input');
    expect(input?.value).toBe(FINAL_VAULT_KEY);

    const clearBtn = container.querySelector<HTMLButtonElement>('#btn-clear-key');
    clearBtn?.click();

    const slot0 = container.querySelector('#slot-quadrant-0');
    expect(slot0?.classList.contains('is-filled')).toBe(false);
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

  it('destroy unmounts DOM and removes event listeners cleanly', () => {
    expect(container.children.length).toBe(1);
    layer.destroy();
    expect(container.children.length).toBe(0);
  });
});
