/**
 * LayerStatus represents the state of a puzzle layer.
 *
 * - 'locked'   Prerequisite not yet met; not accessible or interactable.
 * - 'unlocked' Prerequisite met, but puzzle mechanics not yet implemented
 *              in this version. The stage is earned but not playable yet.
 * - 'active'   Prerequisite met AND puzzle is implemented; fully playable.
 * - 'solved'   Successfully completed.
 *
 * The distinction between 'unlocked' and 'active' is intentional: unlocking
 * a stage does not automatically make it playable if the implementation has
 * not been approved and built yet.
 */
export type LayerStatus = 'locked' | 'unlocked' | 'active' | 'solved';

export type LayerId =
  | 'crypto'
  | 'dom-inspect'
  | 'cross-tab'
  | 'temporal'
  | 'final-reveal';

export interface LayerEntry {
  id: LayerId;
  status: LayerStatus;
}

/**
 * GameState is the single source of truth for puzzle progression.
 *
 * currentLayer: the LayerId of the currently playable layer, or null when
 *   no layer is currently active — for example, when the next unlocked layer
 *   has not yet been implemented in the current phase.
 */
export interface GameState {
  currentLayer: LayerId | null;
  progression: LayerEntry[];
}

export type SolveResult = 'accepted' | 'incorrect' | 'busy' | 'cancelled';

/**
 * PuzzleLayer is the contract every puzzle layer module must implement.
 * Each layer is self-contained: it owns its own DOM, event listeners,
 * and answer-submission logic.
 */
export interface PuzzleLayer {
  readonly id: LayerId;
  readonly displayName: string;
  status: LayerStatus;

  /** Render the layer UI into the given container. Called once on mount. */
  mount(container: HTMLElement): void;

  /** Make the layer interactive. Called when status transitions to 'active'. */
  activate(): void;

  /** Remove DOM nodes, cancel timers, remove event listeners. */
  destroy(): void;


  /**
   * Attempt to submit an answer.
   * Returns 'accepted' if the answer is correct and the layer advances.
   * Returns 'incorrect', 'busy', or 'cancelled' on failure — never throws.
   */
  submitAnswer(answer: string): Promise<SolveResult>;
}


/**
 * Pluggable storage abstraction for game progression state.
 */
export interface StateStore {
  load(): unknown | null;
  save(data: unknown): void;
  clear(): void;
}

