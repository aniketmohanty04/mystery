import type { GameState, LayerId, LayerStatus, LayerEntry } from './types.js';
import type { TransitionPayload } from './event-bus.js';
import { validateAnswer } from './answer-validator.js';
import { saveState, loadState, clearState } from './storage.js';
import { eventBus } from './event-bus.js';
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

/**
 * Determine the correct status for a newly-unlocked layer.
 * 'active'   → layer is in IMPLEMENTED_LAYERS (playable now)
 * 'unlocked' → prerequisite met but implementation is pending
 */
function statusForNextLayer(id: LayerId): LayerStatus {
  return IMPLEMENTED_LAYERS.has(id) ? 'active' : 'unlocked';
}

// ---------------------------------------------------------------------------
// State machine class
// ---------------------------------------------------------------------------

class StateMachineImpl {
  private state: GameState;
  private isSolving = false;

  constructor() {
    // Attempt to restore a previous session. Falls back to a fresh start.
    this.state = loadState() ?? buildInitialState();
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
   * Returns true if:
   *   - layerId matches the currently active layer
   *   - the layer's status is 'active' (not already solved or locked)
   *   - the answer hash matches the expected hash
   *
   * Returns false in all other cases — no state change occurs on failure.
   * Safe to call repeatedly and concurrently; will not duplicate transitions.
   */
  async solve(layerId: LayerId, answer: string): Promise<boolean> {
    if (this.isSolving) return false;
    if (this.state.currentLayer === null) return false;
    if (layerId !== this.state.currentLayer) return false;

    const entry = this.state.progression.find(e => e.id === layerId);
    if (!entry || entry.status !== 'active') return false;

    this.isSolving = true;
    try {
      const correct = await validateAnswer(layerId, answer);
      if (!correct) return false;

      // Re-check conditions after async validation
      if (this.state.currentLayer !== layerId || entry.status !== 'active') {
        return false;
      }

      // Mark current layer solved.
      entry.status = 'solved';

      // Advance to the next layer.
      const nextId = nextLayerId(layerId);
      if (nextId !== undefined) {
        const nextEntry = this.state.progression.find(e => e.id === nextId);
        if (nextEntry) {
          const nextStatus = statusForNextLayer(nextId);
          nextEntry.status = nextStatus;
          // currentLayer is only non-null when a layer is actively playable.
          this.state.currentLayer = nextStatus === 'active' ? nextId : null;
        }
      } else {
        // All layers complete.
        this.state.currentLayer = null;
      }

      saveState(this.state);
      eventBus.emit('transition', { from: layerId, to: this.state.currentLayer });
      return true;
    } finally {
      this.isSolving = false;
    }
  }

  // -- Events ---------------------------------------------------------------

  on(
    event: 'transition',
    handler: (payload: TransitionPayload) => void,
  ): () => void {
    return eventBus.on(event, handler);
  }

  // -- Reset ----------------------------------------------------------------

  /**
   * Clear all progress and return to the initial state.
   * Clears sessionStorage and emits a reset event.
   */
  reset(): void {
    this.isSolving = false;
    this.state = buildInitialState();
    clearState();
    eventBus.emit('reset', undefined);
  }
}

// Singleton — one instance for the lifetime of the page.
export const stateMachine = new StateMachineImpl();
