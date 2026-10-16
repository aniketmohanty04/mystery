// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { saveState, loadState, clearState } from '../../src/core/storage.js';
import type { GameState } from '../../src/core/types.js';

describe('storage module', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('saves and restores a valid GameState', () => {
    const state: GameState = {
      currentLayer: 'crypto',
      progression: [
        { id: 'crypto', status: 'active' },
        { id: 'dom-inspect', status: 'locked' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    };

    saveState(state);
    const loaded = loadState();
    expect(loaded).toEqual(state);
  });

  it('restores state when crypto is solved and dom-inspect is active', () => {
    const state: GameState = {
      currentLayer: 'dom-inspect',
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'active' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    };

    saveState(state);
    const loaded = loadState();
    expect(loaded).toEqual(state);
    expect(loaded?.currentLayer).toBe('dom-inspect');
  });

  it('restores state when crypto and dom-inspect are solved and cross-tab is unlocked (currentLayer null)', () => {
    const state: GameState = {
      currentLayer: null,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'solved' },
        { id: 'cross-tab', status: 'unlocked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    };

    saveState(state);
    const loaded = loadState();
    expect(loaded).toEqual(state);
    expect(loaded?.currentLayer).toBeNull();
  });

  it('sanitizes and demotes forged "active" status for unimplemented layers (e.g. cross-tab)', () => {
    // Forged state attempting to activate cross-tab directly in sessionStorage
    const forgedState = {
      version: 1,
      currentLayer: 'cross-tab',
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'solved' },
        { id: 'cross-tab', status: 'active' }, // Forged active on unimplemented layer!
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    };

    sessionStorage.setItem('mystery-box-v1', JSON.stringify(forgedState));
    const loaded = loadState();

    expect(loaded).not.toBeNull();
    // cross-tab must be demoted to 'unlocked'
    expect(loaded?.progression.find(e => e.id === 'cross-tab')?.status).toBe('unlocked');
    // currentLayer must be null because no implemented layer is active
    expect(loaded?.currentLayer).toBeNull();
  });

  it('returns null if stored data is corrupted or invalid JSON', () => {
    sessionStorage.setItem('mystery-box-v1', '{ invalid json ...');
    expect(loadState()).toBeNull();
  });

  it('returns null if progression has missing or invalid layer IDs', () => {
    const invalidState = {
      version: 1,
      currentLayer: 'crypto',
      progression: [
        { id: 'crypto', status: 'active' },
        { id: 'invalid-id', status: 'locked' },
      ],
    };
    sessionStorage.setItem('mystery-box-v1', JSON.stringify(invalidState));
    expect(loadState()).toBeNull();
  });

  it('returns null if progression has incorrect layer ordering', () => {
    const scrambledState = {
      version: 1,
      currentLayer: 'crypto',
      progression: [
        { id: 'dom-inspect', status: 'locked' },
        { id: 'crypto', status: 'active' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    };
    sessionStorage.setItem('mystery-box-v1', JSON.stringify(scrambledState));
    expect(loadState()).toBeNull();
  });

  it('returns null if progression has duplicate layer IDs', () => {
    const duplicateState = {
      version: 1,
      currentLayer: 'crypto',
      progression: [
        { id: 'crypto', status: 'active' },
        { id: 'crypto', status: 'locked' },
        { id: 'crypto', status: 'locked' },
        { id: 'crypto', status: 'locked' },
        { id: 'crypto', status: 'locked' },
      ],
    };
    sessionStorage.setItem('mystery-box-v1', JSON.stringify(duplicateState));
    expect(loadState()).toBeNull();
  });

  it('returns null if progression has impossible out-of-order solved status', () => {
    const outOfOrderState = {
      version: 1,
      currentLayer: 'crypto',
      progression: [
        { id: 'crypto', status: 'locked' },
        { id: 'dom-inspect', status: 'locked' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'solved' },
      ],
    };
    sessionStorage.setItem('mystery-box-v1', JSON.stringify(outOfOrderState));
    expect(loadState()).toBeNull();
  });

  it('returns null if progression has broken sequence with non-locked trailing layers', () => {
    const brokenSequenceState = {
      version: 1,
      currentLayer: null,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'locked' },
        { id: 'cross-tab', status: 'unlocked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    };
    sessionStorage.setItem('mystery-box-v1', JSON.stringify(brokenSequenceState));
    expect(loadState()).toBeNull();
  });


  it('clearState removes the stored state from sessionStorage', () => {
    const state: GameState = {
      currentLayer: 'crypto',
      progression: [
        { id: 'crypto', status: 'active' },
        { id: 'dom-inspect', status: 'locked' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    };
    saveState(state);
    expect(loadState()).not.toBeNull();

    clearState();
    expect(loadState()).toBeNull();
  });

  // Regression tests for Step 2 schema version and valid-state rules:
  it('returns null if version is missing, non-numeric, or unsupported', () => {
    // Missing version
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      progression: [
        { id: 'crypto', status: 'active' },
        { id: 'dom-inspect', status: 'locked' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));
    expect(loadState()).toBeNull();

    // Non-numeric version
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: '1',
      progression: [
        { id: 'crypto', status: 'active' },
        { id: 'dom-inspect', status: 'locked' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));
    expect(loadState()).toBeNull();

    // Unsupported version
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 999,
      progression: [
        { id: 'crypto', status: 'active' },
        { id: 'dom-inspect', status: 'locked' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));
    expect(loadState()).toBeNull();
  });

  it('rejects all five locked (no boundary layer)', () => {
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 1,
      progression: [
        { id: 'crypto', status: 'locked' },
        { id: 'dom-inspect', status: 'locked' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));
    expect(loadState()).toBeNull();
  });

  it('rejects solved followed only by locked (no boundary layer)', () => {
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 1,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'locked' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));
    expect(loadState()).toBeNull();
  });

  it('rejects all five solved when not all layers are implemented', () => {
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 1,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'solved' },
        { id: 'cross-tab', status: 'solved' },
        { id: 'temporal', status: 'solved' },
        { id: 'final-reveal', status: 'solved' },
      ],
    }));
    expect(loadState()).toBeNull();
  });

  it('rejects state where an unimplemented layer is marked solved', () => {
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 1,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'solved' },
        { id: 'cross-tab', status: 'solved' }, // cross-tab not implemented in this phase
        { id: 'temporal', status: 'unlocked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));
    expect(loadState()).toBeNull();
  });

  it('simulates a future phase where cross-tab is implemented and stored unlocked is promoted to active', () => {
    // Player saved state at milestone 2 (cross-tab unlocked)
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 1,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'solved' },
        { id: 'cross-tab', status: 'unlocked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));

    // In a future phase where cross-tab is added to implemented layers:
    const phase3Implemented = new Set<import('../../src/core/types.js').LayerId>([
      'crypto', 'dom-inspect', 'cross-tab',
    ]);

    const loaded = loadState(undefined, phase3Implemented);
    expect(loaded).not.toBeNull();
    expect(loaded?.progression.find(e => e.id === 'cross-tab')?.status).toBe('active');
    expect(loaded?.currentLayer).toBe('cross-tab');
  });

  it('verifies the three progression milestones load cleanly', () => {
    // Milestone 0: Initial
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 1,
      progression: [
        { id: 'crypto', status: 'active' },
        { id: 'dom-inspect', status: 'locked' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));
    const m0 = loadState();
    expect(m0?.currentLayer).toBe('crypto');
    expect(m0?.progression[0].status).toBe('active');

    // Milestone 1: After Layer 1 solved
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 1,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'active' },
        { id: 'cross-tab', status: 'locked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));
    const m1 = loadState();
    expect(m1?.currentLayer).toBe('dom-inspect');
    expect(m1?.progression[0].status).toBe('solved');
    expect(m1?.progression[1].status).toBe('active');

    // Milestone 2: After Layer 2 solved
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 1,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'solved' },
        { id: 'cross-tab', status: 'unlocked' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));
    const m2 = loadState();
    expect(m2?.currentLayer).toBeNull();
    expect(m2?.progression[0].status).toBe('solved');
    expect(m2?.progression[1].status).toBe('solved');
    expect(m2?.progression[2].status).toBe('unlocked');
  });
});

