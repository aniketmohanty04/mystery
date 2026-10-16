import { describe, it, expect, beforeEach } from 'vitest';
import { stateMachine, StateMachineImpl } from '../../src/core/state-machine.js';
import type { StateStore } from '../../src/core/types.js';

// The correct answer for Layer 1.
// Known here because this is a test file — the hash is in answer-validator.ts.
const CORRECT_ANSWER = 'MYSTERY-BOX-OPENS-WITH-KNOWLEDGE';
const WRONG_ANSWER = 'WRONG-ANSWER';

describe('StateMachine', () => {
  beforeEach(() => {
    // Reset to a clean initial state before every test.
    stateMachine.reset();
  });

  // 1. Initial state
  it('starts with crypto as active and all others locked', () => {
    const prog = stateMachine.progression;
    expect(prog.find(e => e.id === 'crypto')?.status).toBe('active');
    expect(prog.find(e => e.id === 'dom-inspect')?.status).toBe('locked');
    expect(prog.find(e => e.id === 'cross-tab')?.status).toBe('locked');
    expect(prog.find(e => e.id === 'temporal')?.status).toBe('locked');
    expect(prog.find(e => e.id === 'final-reveal')?.status).toBe('locked');
    expect(stateMachine.currentLayer).toBe('crypto');
  });

  // 2. Cannot solve a non-active layer
  it('rejects solve() call for a layer that is not currently active (dom-inspect)', async () => {
    const result = await stateMachine.solve('dom-inspect', CORRECT_ANSWER);
    expect(result).toBe('incorrect');
    // State must not change
    expect(stateMachine.currentLayer).toBe('crypto');
    expect(stateMachine.progression.find(e => e.id === 'crypto')?.status).toBe('active');
  });

  // 3. Cannot solve with a locked layer
  it('rejects solve() call for a locked layer (cross-tab)', async () => {
    const result = await stateMachine.solve('cross-tab', CORRECT_ANSWER);
    expect(result).toBe('incorrect');
    expect(stateMachine.currentLayer).toBe('crypto');
  });

  // 4. Wrong answer does not advance state
  it('returns false for an incorrect answer and keeps crypto active', async () => {
    const result = await stateMachine.solve('crypto', WRONG_ANSWER);
    expect(result).toBe('incorrect');
    expect(stateMachine.currentLayer).toBe('crypto');
    expect(stateMachine.progression.find(e => e.id === 'crypto')?.status).toBe('active');
  });

  // 5. Correct answer transitions the state machine
  it('returns true for the correct answer and advances progression', async () => {
    const result = await stateMachine.solve('crypto', CORRECT_ANSWER);
    expect(result).toBe('accepted');
  });


  // 6. crypto becomes 'solved' after a correct answer
  it('marks crypto as solved after the correct answer', async () => {
    await stateMachine.solve('crypto', CORRECT_ANSWER);
    expect(stateMachine.progression.find(e => e.id === 'crypto')?.status).toBe('solved');
  });

  // 7. dom-inspect becomes 'active' after solving crypto (implemented in Phase 2)
  it('sets dom-inspect to active and currentLayer to dom-inspect after solving crypto', async () => {
    await stateMachine.solve('crypto', CORRECT_ANSWER);
    const domStatus = stateMachine.progression.find(e => e.id === 'dom-inspect')?.status;
    expect(domStatus).toBe('active');
    expect(stateMachine.currentLayer).toBe('dom-inspect');
  });

  // 8. Layers beyond dom-inspect remain locked after solving crypto
  it('leaves cross-tab, temporal, and final-reveal locked after solving crypto', async () => {
    await stateMachine.solve('crypto', CORRECT_ANSWER);
    const prog = stateMachine.progression;
    expect(prog.find(e => e.id === 'cross-tab')?.status).toBe('locked');
    expect(prog.find(e => e.id === 'temporal')?.status).toBe('locked');
    expect(prog.find(e => e.id === 'final-reveal')?.status).toBe('locked');
  });

  // 9. Solving Layer 2 (dom-inspect) transitions to solved and unlocks Layer 3 (cross-tab)
  it('solves dom-inspect, marks it solved, unlocks cross-tab, and sets currentLayer to null', async () => {
    await stateMachine.solve('crypto', CORRECT_ANSWER);
    expect(stateMachine.currentLayer).toBe('dom-inspect');

    const domResult = await stateMachine.solve('dom-inspect', 'verified');
    expect(domResult).toBe('accepted');

    const prog = stateMachine.progression;
    expect(prog.find(e => e.id === 'crypto')?.status).toBe('solved');
    expect(prog.find(e => e.id === 'dom-inspect')?.status).toBe('solved');
    // cross-tab is unlocked, but not active because Phase 3 is unimplemented
    expect(prog.find(e => e.id === 'cross-tab')?.status).toBe('unlocked');
    expect(prog.find(e => e.id === 'temporal')?.status).toBe('locked');
    expect(prog.find(e => e.id === 'final-reveal')?.status).toBe('locked');
    // When no implemented layer is playable, currentLayer must be null
    expect(stateMachine.currentLayer).toBeNull();
  });

  // 10. Cannot solve unlocked-but-unimplemented Layer 3
  it('rejects solve() call for unlocked Layer 3 (cross-tab)', async () => {
    await stateMachine.solve('crypto', CORRECT_ANSWER);
    await stateMachine.solve('dom-inspect', 'verified');
    expect(stateMachine.currentLayer).toBeNull();

    const crossTabResult = await stateMachine.solve('cross-tab', 'ANY-ANSWER');
    expect(crossTabResult).toBe('incorrect');
  });

  // 11. Idempotent: second solve on already-solved layer returns false
  it('returns false if solve() is called again on a layer already solved', async () => {
    await stateMachine.solve('crypto', CORRECT_ANSWER);
    const second = await stateMachine.solve('crypto', CORRECT_ANSWER);
    expect(second).toBe('incorrect');

    await stateMachine.solve('dom-inspect', 'verified');
    const secondDom = await stateMachine.solve('dom-inspect', 'verified');
    expect(secondDom).toBe('incorrect');
  });

  // 12. reset() restores full initial state
  it('reset() returns to initial state from any point in progression', async () => {
    await stateMachine.solve('crypto', CORRECT_ANSWER);
    await stateMachine.solve('dom-inspect', 'verified');
    expect(stateMachine.currentLayer).toBeNull();

    stateMachine.reset();
    expect(stateMachine.currentLayer).toBe('crypto');
    expect(stateMachine.progression.find(e => e.id === 'crypto')?.status).toBe('active');
    expect(stateMachine.progression.find(e => e.id === 'dom-inspect')?.status).toBe('locked');
    expect(stateMachine.progression.find(e => e.id === 'cross-tab')?.status).toBe('locked');
  });

  // 13. Transition events fire with correct payload
  it('emits transition events on successful solves across phases', async () => {
    const events: Array<{ from: string; to: string | null }> = [];
    stateMachine.on('transition', payload => {
      events.push({ from: payload.from, to: payload.to });
    });

    await stateMachine.solve('crypto', CORRECT_ANSWER);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ from: 'crypto', to: 'dom-inspect' });

    await stateMachine.solve('dom-inspect', 'verified');
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({ from: 'dom-inspect', to: null });
  });

  // 14. Concurrent submissions: only one transition occurs and exactly one call succeeds
  it('handles concurrent solve calls gracefully without duplicating transitions', async () => {
    const events: Array<{ from: string; to: string | null }> = [];
    stateMachine.on('transition', payload => {
      events.push({ from: payload.from, to: payload.to });
    });

    const [res1, res2] = await Promise.all([
      stateMachine.solve('crypto', CORRECT_ANSWER),
      stateMachine.solve('crypto', CORRECT_ANSWER),
    ]);

    // Exactly one call must succeed ('accepted'), the other must return 'busy'
    expect([res1, res2].sort()).toEqual(['accepted', 'busy']);
    // Exactly one transition event must have been emitted
    expect(events).toHaveLength(1);
    expect(events[0].from).toBe('crypto');
    expect(events[0].to).toBe('dom-inspect');
  });

  // 15. Reset race: reset() during in-flight solve() aborts and does not corrupt state
  it('reset() during in-flight solve() does not mutate state or activate extra layers', async () => {
    // Launch solve and reset before it finishes
    const solvePromise = stateMachine.solve('crypto', CORRECT_ANSWER);
    stateMachine.reset();
    const result = await solvePromise;

    // Must return 'cancelled'
    expect(result).toBe('cancelled');

    // State must remain strictly initial: crypto active, all others locked
    expect(stateMachine.currentLayer).toBe('crypto');
    const activeLayers = stateMachine.progression.filter(e => e.status === 'active');
    expect(activeLayers).toHaveLength(1);
    expect(activeLayers[0].id).toBe('crypto');
    expect(stateMachine.progression.find(e => e.id === 'dom-inspect')?.status).toBe('locked');
  });

  // 16. Injected delayed validator and reset race
  it('reset() during in-flight solve with injected delayed validator cleanly cancels solve', async () => {
    let resolveValidation!: (val: boolean) => void;
    const delayedValidator = () => new Promise<boolean>(resolve => {
      resolveValidation = resolve;
    });

    const memoryStore: StateStore = {
      data: null as unknown,
      load() { return this.data; },
      save(d) { this.data = d; },
      clear() { this.data = null; },
    };

    const sm = new StateMachineImpl({
      validateAnswer: delayedValidator,
      store: memoryStore,
    });

    const solvePromise = sm.solve('crypto', CORRECT_ANSWER);
    sm.reset();
    resolveValidation(true);
    const result = await solvePromise;

    expect(result).toBe('cancelled');
    expect(sm.currentLayer).toBe('crypto');
    expect(sm.progression[0].status).toBe('active');
    expect(sm.progression[1].status).toBe('locked');
    expect(memoryStore.load()).toBeNull();
  });


  // 17. Injected implementedLayers
  it('supports injecting implementedLayers for future phase progression', async () => {
    const memoryStore: StateStore = {
      data: null as unknown,
      load() { return this.data; },
      save(d) { this.data = d; },
      clear() { this.data = null; },
    };

    const sm = new StateMachineImpl({
      store: memoryStore,
      implementedLayers: new Set(['crypto', 'dom-inspect', 'cross-tab']),
    });

    await sm.solve('crypto', CORRECT_ANSWER);
    await sm.solve('dom-inspect', 'verified');

    // In this simulated phase with cross-tab implemented, cross-tab should become active!
    expect(sm.currentLayer).toBe('cross-tab');
    expect(sm.progression.find(e => e.id === 'cross-tab')?.status).toBe('active');
  });
});

