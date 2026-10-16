// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { saveState, loadState, clearState } from '../../src/core/storage.js';
import type { GameState, LayerId } from '../../src/core/types.js';

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

  it('restores state when crypto, dom-inspect, cross-tab, and temporal are solved and final-reveal is promoted to active', () => {
    const state: GameState = {
      currentLayer: null,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'solved' },
        { id: 'cross-tab', status: 'solved' },
        { id: 'temporal', status: 'solved' },
        { id: 'final-reveal', status: 'unlocked' },
      ],
    };

    saveState(state);
    const loaded = loadState();
    expect(loaded?.progression.find(e => e.id === 'final-reveal')?.status).toBe('active');
    expect(loaded?.currentLayer).toBe('final-reveal');
  });

  it('sanitizes and demotes forged "active" status for unimplemented layers (e.g. final-reveal in partial set)', () => {
    // Forged state attempting to activate final-reveal directly in sessionStorage
    const forgedState = {
      version: 1,
      currentLayer: 'final-reveal',
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'solved' },
        { id: 'cross-tab', status: 'solved' },
        { id: 'temporal', status: 'solved' },
        { id: 'final-reveal', status: 'active' }, // Forged active on unimplemented layer!
      ],
    };

    sessionStorage.setItem('mystery-box-v1', JSON.stringify(forgedState));
    const partialImplemented = new Set<LayerId>(['crypto', 'dom-inspect', 'cross-tab', 'temporal']);
    const loaded = loadState(undefined, partialImplemented);

    expect(loaded).not.toBeNull();
    // final-reveal must be demoted to 'unlocked'
    expect(loaded?.progression.find(e => e.id === 'final-reveal')?.status).toBe('unlocked');
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
    const partialImplemented = new Set<LayerId>(['crypto', 'dom-inspect', 'cross-tab', 'temporal']);
    expect(loadState(undefined, partialImplemented)).toBeNull();
  });

  it('rejects state where an unimplemented layer is marked solved', () => {
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
    const partialImplemented = new Set<LayerId>(['crypto', 'dom-inspect', 'cross-tab', 'temporal']);
    expect(loadState(undefined, partialImplemented)).toBeNull();
  });

  it('accepts all five solved when all layers are implemented in Phase 5', () => {
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
    const loaded = loadState();
    expect(loaded).not.toBeNull();
    expect(loaded?.progression.every(e => e.status === 'solved')).toBe(true);
    expect(loaded?.currentLayer).toBeNull();
  });

  it('simulates a future phase where final-reveal is implemented and stored unlocked is promoted to active', () => {
    // Player saved state at milestone 4 (final-reveal unlocked)
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 1,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'solved' },
        { id: 'cross-tab', status: 'solved' },
        { id: 'temporal', status: 'solved' },
        { id: 'final-reveal', status: 'unlocked' },
      ],
    }));

    // In a future phase where final-reveal is added to implemented layers:
    const phase5Implemented = new Set<import('../../src/core/types.js').LayerId>([
      'crypto', 'dom-inspect', 'cross-tab', 'temporal', 'final-reveal',
    ]);

    const loaded = loadState(undefined, phase5Implemented);
    expect(loaded).not.toBeNull();
    expect(loaded?.progression.find(e => e.id === 'final-reveal')?.status).toBe('active');
    expect(loaded?.currentLayer).toBe('final-reveal');
  });

  it('verifies the four progression milestones load cleanly', () => {
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

    // Milestone 2: After Layer 2 solved (cross-tab is active)
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 1,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'solved' },
        { id: 'cross-tab', status: 'active' },
        { id: 'temporal', status: 'locked' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));
    const m2 = loadState();
    expect(m2?.currentLayer).toBe('cross-tab');
    expect(m2?.progression[0].status).toBe('solved');
    expect(m2?.progression[1].status).toBe('solved');
    expect(m2?.progression[2].status).toBe('active');

    // Milestone 3: After Layer 3 solved (temporal is active in Phase 4)
    sessionStorage.setItem('mystery-box-v1', JSON.stringify({
      version: 1,
      progression: [
        { id: 'crypto', status: 'solved' },
        { id: 'dom-inspect', status: 'solved' },
        { id: 'cross-tab', status: 'solved' },
        { id: 'temporal', status: 'active' },
        { id: 'final-reveal', status: 'locked' },
      ],
    }));
    const m3 = loadState();
    expect(m3?.currentLayer).toBe('temporal');
    expect(m3?.progression[2].status).toBe('solved');
    expect(m3?.progression[3].status).toBe('active');
  });
});

