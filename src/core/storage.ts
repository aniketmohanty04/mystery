import type { GameState, LayerId, LayerStatus, LayerEntry } from './types.js';
import { LAYER_ORDER, IMPLEMENTED_LAYERS } from './constants.js';

const STORAGE_KEY = 'mystery-box-v1';

const VALID_STATUSES = new Set<string>([
  'locked', 'unlocked', 'active', 'solved',
]);

/**
 * Validate and sanitize raw parsed JSON into a trusted GameState.
 *
 * Sanitization rules:
 *  1. All LayerIds and LayerStatuses must be known values.
 *  2. Any layer with status 'active' that is NOT in IMPLEMENTED_LAYERS
 *     is demoted to 'unlocked'. This prevents session restoration from
 *     accidentally activating an unimplemented layer.
 *  3. currentLayer is derived from the progression array — it is never
 *     trusted from storage directly.
 */
function validateAndSanitize(raw: unknown): GameState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.progression)) return null;
  if (obj.progression.length !== LAYER_ORDER.length) return null;

  const entries: LayerEntry[] = [];
  for (let i = 0; i < LAYER_ORDER.length; i++) {
    const entry = obj.progression[i];
    if (typeof entry !== 'object' || entry === null) return null;
    const e = entry as Record<string, unknown>;

    // Strict layer order: index i must correspond exactly to LAYER_ORDER[i]
    if (e.id !== LAYER_ORDER[i]) return null;
    if (typeof e.status !== 'string' || !VALID_STATUSES.has(e.status)) return null;

    let status = e.status as LayerStatus;
    // Demote 'active' to 'unlocked' for unimplemented layers.
    if (status === 'active' && !IMPLEMENTED_LAYERS.has(e.id as LayerId)) {
      status = 'unlocked';
    }
    entries.push({ id: e.id as LayerId, status });
  }

  // Validate linear progression integrity:
  // - A prefix of 0 or more layers with status 'solved'
  // - Optionally one boundary layer with status 'active' or 'unlocked'
  // - All subsequent layers must have status 'locked'
  let foundIncomplete = false;
  for (const entry of entries) {
    if (!foundIncomplete) {
      if (entry.status === 'solved') {
        continue;
      }
      foundIncomplete = true;
      if (entry.status === 'active' || entry.status === 'unlocked' || entry.status === 'locked') {
        continue;
      }
      return null;
    } else {
      // Once past the active/unlocked transition point, all remaining layers must be locked
      if (entry.status !== 'locked') {
        return null;
      }
    }
  }

  // Derive currentLayer from the sanitized progression.
  const activeEntry = entries.find(e => e.status === 'active');
  const currentLayer: LayerId | null = activeEntry?.id ?? null;

  return { currentLayer, progression: entries };
}

export function saveState(state: GameState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage unavailable (private mode, quota exceeded, test env).
  }
}

export function loadState(): GameState | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return validateAndSanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearState(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
