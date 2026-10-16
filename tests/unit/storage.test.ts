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
});
