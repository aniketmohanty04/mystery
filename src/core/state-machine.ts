import type { GameState, LayerId, LayerEntry, StateStore, SolveResult } from './types.js';
import { TypedEventBus, type TransitionPayload } from './event-bus.js';
import { validateAnswer as defaultValidateAnswer } from './answer-validator.js';
import { saveState, loadState, clearState, sessionStore } from './storage.js';
import { LAYER_ORDER, IMPLEMENTED_LAYERS } from './constants.js';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildInitialState(): GameState {
  return {
    currentLayer: 'crypto', // Layer 1 is always the starting active layer.
    progression: LAYER_ORDER.map((id, i): LayerEntry => ({
      id,
      status: i === 0 ? 'active' : 'locked',
    })),
  };
}

function nextLayerId(current: LayerId): LayerId | undefined {
  const idx = LAYER_ORDER.indexOf(current);
  return idx >= 0 ? LAYER_ORDER[idx + 1] : undefined;
}

// ---------------------------------------------------------------------------
// State machine options & class
// ---------------------------------------------------------------------------

export interface StateMachineOptions {
  store?: StateStore;
  validateAnswer?: (layerId: LayerId, answer: string) => Promise<boolean>;
  implementedLayers?: ReadonlySet<LayerId>;
}

export class StateMachineImpl {
  private state: GameState;
  private isSolving = false;
  private generation = 0;
  private readonly bus = new TypedEventBus();
  private readonly store: StateStore;
  private readonly validateAnswerFn: (layerId: LayerId, answer: string) => Promise<boolean>;
  private readonly implementedLayers: ReadonlySet<LayerId>;

  constructor(options: StateMachineOptions = {}) {
    this.store = options.store ?? sessionStore;
    this.validateAnswerFn = options.validateAnswer ?? defaultValidateAnswer;
    this.implementedLayers = options.implementedLayers ?? IMPLEMENTED_LAYERS;

    // Attempt to restore a previous session. Falls back to a fresh start.
    this.state = loadState(this.store, this.implementedLayers) ?? buildInitialState();
  }

  // -- Public read-only properties ------------------------------------------

  /**
   * The ID of the currently playable layer, or null when no layer is
   * active (e.g., the next unlocked layer is not yet implemented).
   */
  get currentLayer(): LayerId | null {
    return this.state.currentLayer;
  }

  get progression(): ReadonlyArray<LayerEntry> {
    return this.state.progression;
  }

  // -- Core operation -------------------------------------------------------

  /**
   * Attempt to solve the given layer with the provided answer.
   *
   * Returns:
   *   - 'accepted'   if answer matches and progression advances
   *   - 'incorrect'  if answer is wrong or layer is not active
   *   - 'busy'       if another solve operation is currently in flight
   *   - 'cancelled'  if reset() was called while validation was hashing
   *   - 'error'      if validation itself failed to run (state is untouched)
   *
   * Safe to call repeatedly and concurrently; will not duplicate transitions.
   */
  async solve(layerId: LayerId, answer: string): Promise<SolveResult> {
    if (this.isSolving) return 'busy';
    if (this.state.currentLayer === null) return 'incorrect';
    if (layerId !== this.state.currentLayer) return 'incorrect';

    const entry = this.state.progression.find(e => e.id === layerId);
    if (!entry || entry.status !== 'active') return 'incorrect';

    const currentGen = this.generation;
    this.isSolving = true;
    try {
      let correct: boolean;
      try {
        correct = await this.validateAnswerFn(layerId, answer);
      } catch {
        // Validation could not run (for example crypto.subtle is missing on a
        // non-secure origin). Report it; never leave callers with a rejection.
        return this.generation !== currentGen ? 'cancelled' : 'error';
      }

      // Abort if reset() was called while hashing
      if (this.generation !== currentGen) {
        return 'cancelled';
      }
      if (!correct) return 'incorrect';

      // Re-find entry in the CURRENT state; never reuse a stale reference.
      const freshEntry = this.state.progression.find(e => e.id === layerId);
      if (!freshEntry || freshEntry.status !== 'active' || this.state.currentLayer !== layerId) {
        return 'cancelled';
      }

      // Mark current layer solved.
      freshEntry.status = 'solved';

      // Advance to the next layer.
      const nextId = nextLayerId(layerId);
      if (nextId !== undefined) {
        const nextEntry = this.state.progression.find(e => e.id === nextId);
        if (nextEntry) {
          const nextStatus = this.implementedLayers.has(nextId) ? 'active' : 'unlocked';
          nextEntry.status = nextStatus;
          // currentLayer is only non-null when a layer is actively playable.
          this.state.currentLayer = nextStatus === 'active' ? nextId : null;
        }
      } else {
        // All layers complete.
        this.state.currentLayer = null;
      }

      saveState(this.state, this.store);
      this.bus.emit('transition', { from: layerId, to: this.state.currentLayer });
      return 'accepted';
    } finally {
      if (this.generation === currentGen) {
        this.isSolving = false;
      }
    }
  }


  // -- Events ---------------------------------------------------------------

  on(
    event: 'transition',
    handler: (payload: TransitionPayload) => void,
  ): () => void {
    return this.bus.on(event, handler);
  }

  // -- Reset ----------------------------------------------------------------

  /**
   * Clear all progress and return to the initial state.
   * Clears storage and aborts any in-flight solve.
   */
  reset(): void {
    this.generation++;
    this.isSolving = false;
    this.state = buildInitialState();
    clearState(this.store);
  }
}


// Singleton — one instance for the lifetime of the page.
export const stateMachine = new StateMachineImpl();

