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

  // 9. Solving Layer 2 (dom-inspect) transitions to solved and activates Layer 3 (cross-tab)
  it('solves dom-inspect, marks it solved, activates cross-tab, and advances currentLayer', async () => {
    await stateMachine.solve('crypto', CORRECT_ANSWER);
    expect(stateMachine.currentLayer).toBe('dom-inspect');

    const domResult = await stateMachine.solve('dom-inspect', 'verified');
    expect(domResult).toBe('accepted');

    const prog = stateMachine.progression;
    expect(prog.find(e => e.id === 'crypto')?.status).toBe('solved');
    expect(prog.find(e => e.id === 'dom-inspect')?.status).toBe('solved');
    // cross-tab is active in Phase 3
    expect(prog.find(e => e.id === 'cross-tab')?.status).toBe('active');
    expect(prog.find(e => e.id === 'temporal')?.status).toBe('locked');
    expect(prog.find(e => e.id === 'final-reveal')?.status).toBe('locked');
    expect(stateMachine.currentLayer).toBe('cross-tab');
  });

  // 10. Solves Layer 4 (temporal) activating Layer 5 (final-reveal) and completes Layer 5
  it('solves Layer 3 (cross-tab) activating temporal, solves Layer 4 (temporal) activating final-reveal, and completes Layer 5', async () => {
    await stateMachine.solve('crypto', CORRECT_ANSWER);
    await stateMachine.solve('dom-inspect', 'verified');
    expect(stateMachine.currentLayer).toBe('cross-tab');

    const crossTabResult = await stateMachine.solve('cross-tab', 'SIGNAL-SYNCHRONIZED');
    expect(crossTabResult).toBe('accepted');
    expect(stateMachine.progression.find(e => e.id === 'cross-tab')?.status).toBe('solved');
    // temporal is active in Phase 4/5
    expect(stateMachine.progression.find(e => e.id === 'temporal')?.status).toBe('active');
    expect(stateMachine.currentLayer).toBe('temporal');

    // Solve Layer 4 (temporal)
    const temporalResult = await stateMachine.solve('temporal', 'EV-302-EV-814-EV-409-EV-127-EV-955');
    expect(temporalResult).toBe('accepted');
    expect(stateMachine.progression.find(e => e.id === 'temporal')?.status).toBe('solved');

    // Layer 5 (final-reveal) is active in Phase 5
    expect(stateMachine.progression.find(e => e.id === 'final-reveal')?.status).toBe('active');
    expect(stateMachine.currentLayer).toBe('final-reveal');

    // Wrong answer on Layer 5 rejected
    const wrongResult = await stateMachine.solve('final-reveal', 'WRONG-VAULT-KEY');
    expect(wrongResult).toBe('incorrect');
    expect(stateMachine.currentLayer).toBe('final-reveal');

    // Correct answer on Layer 5 accepted and completes all layers
    const finalResult = await stateMachine.solve('final-reveal', 'KNOWLEDGE-VERIFIED-SYNCHRONIZED-EV-955');
    expect(finalResult).toBe('accepted');
    expect(stateMachine.progression.find(e => e.id === 'final-reveal')?.status).toBe('solved');
    expect(stateMachine.currentLayer).toBeNull();
    expect(stateMachine.progression.every(e => e.status === 'solved')).toBe(true);
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
    expect(stateMachine.currentLayer).toBe('cross-tab');

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
    expect(events[1]).toEqual({ from: 'dom-inspect', to: 'cross-tab' });

    await stateMachine.solve('cross-tab', 'SIGNAL-SYNCHRONIZED');
    expect(events).toHaveLength(3);
    expect(events[2]).toEqual({ from: 'cross-tab', to: 'temporal' });

    await stateMachine.solve('temporal', 'EV-302-EV-814-EV-409-EV-127-EV-955');
    expect(events).toHaveLength(4);
    expect(events[3]).toEqual({ from: 'temporal', to: 'final-reveal' });

    await stateMachine.solve('final-reveal', 'KNOWLEDGE-VERIFIED-SYNCHRONIZED-EV-955');
    expect(events).toHaveLength(5);
    expect(events[4]).toEqual({ from: 'final-reveal', to: null });
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

    function createMemoryStore(): StateStore {
      let memoryData: unknown = null;
      return {
        load: () => memoryData,
        save: (d: unknown) => { memoryData = d; },
        clear: () => { memoryData = null; },
      };
    }

    const memoryStore = createMemoryStore();

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
    let memoryData: unknown = null;
    const memoryStore: StateStore = {
      load: () => memoryData,
      save: (d: unknown) => { memoryData = d; },
      clear: () => { memoryData = null; },
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

  // 18. Validator failure
  it("returns 'error' (never rejects) when the validator throws, leaves state untouched and releases the lock", async () => {
    let memoryData: unknown = null;
    const memoryStore: StateStore = {
      load: () => memoryData,
      save: (d: unknown) => { memoryData = d; },
      clear: () => { memoryData = null; },
    };
    let calls = 0;
    const sm = new StateMachineImpl({
      store: memoryStore,
      validateAnswer: async () => {
        calls++;
        if (calls === 1) throw new TypeError('crypto.subtle is undefined');
        return true;
      },
    });

    await expect(sm.solve('crypto', CORRECT_ANSWER)).resolves.toBe('error');
    expect(sm.currentLayer).toBe('crypto');
    expect(sm.progression[0].status).toBe('active');
    expect(memoryData).toBeNull();

    // The in-flight lock was released: a retry is not 'busy' and succeeds.
    await expect(sm.solve('crypto', CORRECT_ANSWER)).resolves.toBe('accepted');
    expect(sm.currentLayer).toBe('dom-inspect');
  });

  // 19. Validator failure racing a reset
  it("returns 'cancelled' when the validator throws after reset() was called", async () => {
    let rejectValidation!: (e: Error) => void;
    const sm = new StateMachineImpl({
      store: { load: () => null, save: () => {}, clear: () => {} },
      validateAnswer: () => new Promise<boolean>((_, reject) => { rejectValidation = reject; }),
    });
    const pending = sm.solve('crypto', CORRECT_ANSWER);
    sm.reset();
    rejectValidation(new Error('boom'));
    await expect(pending).resolves.toBe('cancelled');
  });

  // 20. Event isolation
  it('keeps transition events isolated per state machine instance', async () => {
    const quietStore = (): StateStore => ({ load: () => null, save: () => {}, clear: () => {} });
    const a = new StateMachineImpl({ store: quietStore(), validateAnswer: async () => true });
    const b = new StateMachineImpl({ store: quietStore(), validateAnswer: async () => true });
    const heardByA: unknown[] = [];
    const heardByB: unknown[] = [];
    a.on('transition', p => heardByA.push(p));
    b.on('transition', p => heardByB.push(p));

    await a.solve('crypto', CORRECT_ANSWER);

    expect(heardByA).toHaveLength(1);
    expect(heardByB).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Regression Suite: Startup and Sequential Progression Safeguards
  // -------------------------------------------------------------------------
  describe('Regression: Layer 1 Startup & Sequential Progression Gate', () => {
    // 1. Fresh initialization starts at Layer 1
    it('Fresh initialization starts at Layer 1 with status active and all subsequent layers locked', () => {
      let saved: unknown = null;
      const freshStore: StateStore = {
        load: () => saved,
        save: (d: unknown) => { saved = d; },
        clear: () => { saved = null; },
      };

      const freshSm = new StateMachineImpl({
        store: freshStore,
      });

      expect(freshSm.currentLayer).toBe('crypto');
      const prog = freshSm.progression;
      expect(prog[0]).toEqual({ id: 'crypto', status: 'active' });
      expect(prog[1]).toEqual({ id: 'dom-inspect', status: 'locked' });
      expect(prog[2]).toEqual({ id: 'cross-tab', status: 'locked' });
      expect(prog[3]).toEqual({ id: 'temporal', status: 'locked' });
      expect(prog[4]).toEqual({ id: 'final-reveal', status: 'locked' });
      // Ensure no layer is marked solved
      expect(prog.every(e => e.status !== 'solved')).toBe(true);
    });

    // 2. Completing Layer 1 unlocks Layer 2 according to the existing rules
    it('Completing Layer 1 unlocks Layer 2 according to the existing rules', async () => {
      let saved: unknown = null;
      const store: StateStore = {
        load: () => saved,
        save: (d: unknown) => { saved = d; },
        clear: () => { saved = null; },
      };

      const sm = new StateMachineImpl({ store });
      expect(sm.currentLayer).toBe('crypto');

      const solveResult = await sm.solve('crypto', CORRECT_ANSWER);
      expect(solveResult).toBe('accepted');

      expect(sm.currentLayer).toBe('dom-inspect');
      expect(sm.progression.find(e => e.id === 'crypto')?.status).toBe('solved');
      expect(sm.progression.find(e => e.id === 'dom-inspect')?.status).toBe('active');
      expect(sm.progression.find(e => e.id === 'cross-tab')?.status).toBe('locked');
      expect(sm.progression.find(e => e.id === 'temporal')?.status).toBe('locked');
      expect(sm.progression.find(e => e.id === 'final-reveal')?.status).toBe('locked');
    });

    // 3. Completing Layer 2 unlocks Layer 3 according to the existing rules
    it('Completing Layer 2 unlocks Layer 3 according to the existing rules', async () => {
      let saved: unknown = null;
      const store: StateStore = {
        load: () => saved,
        save: (d: unknown) => { saved = d; },
        clear: () => { saved = null; },
      };

      const sm = new StateMachineImpl({ store });
      await sm.solve('crypto', CORRECT_ANSWER);
      expect(sm.currentLayer).toBe('dom-inspect');

      const solveResult = await sm.solve('dom-inspect', 'verified');
      expect(solveResult).toBe('accepted');

      expect(sm.currentLayer).toBe('cross-tab');
      expect(sm.progression.find(e => e.id === 'crypto')?.status).toBe('solved');
      expect(sm.progression.find(e => e.id === 'dom-inspect')?.status).toBe('solved');
      expect(sm.progression.find(e => e.id === 'cross-tab')?.status).toBe('active');
      expect(sm.progression.find(e => e.id === 'temporal')?.status).toBe('locked');
      expect(sm.progression.find(e => e.id === 'final-reveal')?.status).toBe('locked');
    });

    // 4. Implementing Layer 3 does not automatically activate it
    it('Implementing Layer 3 does not automatically activate it prematurely', async () => {
      let saved: unknown = null;
      const store: StateStore = {
        load: () => saved,
        save: (d: unknown) => { saved = d; },
        clear: () => { saved = null; },
      };

      // Even when 'cross-tab' is present in implementedLayers:
      const sm = new StateMachineImpl({
        store,
        implementedLayers: new Set(['crypto', 'dom-inspect', 'cross-tab']),
      });

      // It MUST still start at Layer 1 (crypto), NOT cross-tab
      expect(sm.currentLayer).toBe('crypto');
      expect(sm.progression.find(e => e.id === 'cross-tab')?.status).toBe('locked');

      // Direct solve attempts on cross-tab must be rejected
      const directSolveResult = await sm.solve('cross-tab', 'SIGNAL-SYNCHRONIZED');
      expect(directSolveResult).toBe('incorrect');
      expect(sm.currentLayer).toBe('crypto');
      expect(sm.progression.find(e => e.id === 'cross-tab')?.status).toBe('locked');
    });

    // 5. Reset returns to Layer 1
    it('Reset returns to Layer 1 and clears persisted state after reaching Layer 3', async () => {
      let saved: unknown = null;
      const store: StateStore = {
        load: () => saved,
        save: (d: unknown) => { saved = d; },
        clear: () => { saved = null; },
      };

      const sm = new StateMachineImpl({ store });
      await sm.solve('crypto', CORRECT_ANSWER);
      await sm.solve('dom-inspect', 'verified');
      expect(sm.currentLayer).toBe('cross-tab');
      expect(saved).not.toBeNull();

      // Trigger reset
      sm.reset();

      expect(sm.currentLayer).toBe('crypto');
      expect(sm.progression[0]).toEqual({ id: 'crypto', status: 'active' });
      expect(sm.progression.find(e => e.id === 'dom-inspect')?.status).toBe('locked');
      expect(sm.progression.find(e => e.id === 'cross-tab')?.status).toBe('locked');
      expect(store.load()).toBeNull();
    });
  });
});
