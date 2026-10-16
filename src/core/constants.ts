import type { LayerId } from './types.js';

/**
 * Shared runtime constants referenced by both state-machine.ts and storage.ts.
 * Keep IMPLEMENTED_LAYERS in one place — expand it phase by phase.
 */

/** The ordered sequence of all puzzle layers, first to last. */
export const LAYER_ORDER: readonly LayerId[] = [
  'crypto',
  'dom-inspect',
  'cross-tab',
  'temporal',
  'final-reveal',
] as const;

/**
 * Layers with fully implemented puzzle mechanics in this build.
 *
 * A layer can only reach 'active' status if it is in this set.
 * Layers that have earned access but are NOT in this set are set to
 * 'unlocked' — indicating the user has progressed but the next challenge
 * has not yet been built.
 *
 * Phase 5: 'crypto', 'dom-inspect', 'cross-tab', 'temporal', and 'final-reveal' are implemented.
 */
export const IMPLEMENTED_LAYERS = new Set<LayerId>([
  'crypto',
  'dom-inspect',
  'cross-tab',
  'temporal',
  'final-reveal',
]);

/** Display metadata for each layer. */
export const LAYER_META: Record<LayerId, { displayName: string; index: string }> = {
  'crypto':       { displayName: 'Cryptography',  index: '01' },
  'dom-inspect':  { displayName: 'DOM Inspection', index: '02' },
  'cross-tab':    { displayName: 'Cross-Tab Sync', index: '03' },
  'temporal':     { displayName: 'Temporal Logic', index: '04' },
  'final-reveal': { displayName: 'Final Reveal',   index: '05' },
};

/** Shown when answer validation cannot run (Web Crypto needs HTTPS or localhost). */
export const VALIDATION_UNAVAILABLE_MESSAGE =
  'Answer validation is unavailable in this browser context. Open the puzzle over HTTPS or on localhost, then try again.';
