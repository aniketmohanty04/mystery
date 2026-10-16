import type { GameState, LayerId, LayerStatus, LayerEntry, StateStore } from './types.js';
import { LAYER_ORDER, IMPLEMENTED_LAYERS } from './constants.js';

const STORAGE_KEY = 'mystery-box-v1';

const VALID_STATUSES = new Set<string>([
  'locked', 'unlocked', 'active', 'solved',
]);

export class SessionStateStore implements StateStore {
  private key: string;

  constructor(key = STORAGE_KEY) {
    this.key = key;
  }

  load(): unknown | null {
    try {
      const raw = sessionStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  save(data: unknown): void {
    try {
      sessionStorage.setItem(this.key, JSON.stringify(data));
    } catch {
      // sessionStorage unavailable (quota, private browsing, etc.)
    }
  }

  clear(): void {
    try {
      sessionStorage.removeItem(this.key);
    } catch {
      // ignore
    }
  }
}

export const sessionStore = new SessionStateStore();

/**
 * Validate and sanitize raw parsed data into a trusted GameState.
 *
 * Rules:
 *  1. Root must be an object with schema version: 1.
 *  2. progression must contain exactly the 5 layers in LAYER_ORDER with valid statuses.
 *  3. Shape rule:
 *     - A prefix of 0 or more 'solved' layers. A layer may only be 'solved'
 *       if it is in implementedLayers.
 *     - Either all 5 layers are solved (only valid if all 5 are implemented),
 *       OR exactly ONE boundary layer stored as 'active' or 'unlocked',
 *       followed by strictly 'locked' layers.
 *  4. Boundary status is derived:
 *     - If the boundary layer is in implementedLayers -> 'active'.
 *     - If the boundary layer is not in implementedLayers -> 'unlocked'.
 *     (Demotes forged 'active' on unimplemented layers; promotes stored 'unlocked'
 *      when new layers become implemented).
 *  5. currentLayer is strictly derived from sanitized progression ('active' layer id,
 *     or null if none is active).
 */
export function validateAndSanitize(
  raw: unknown,
  implementedLayers: ReadonlySet<LayerId> = IMPLEMENTED_LAYERS,
): GameState | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const obj = raw as Record<string, unknown>;

  // Schema version must be the number 1
  if (typeof obj.version !== 'number' || obj.version !== 1) {
    return null;
  }

  if (!Array.isArray(obj.progression)) return null;
  if (obj.progression.length !== LAYER_ORDER.length) return null;

  // Validate basic shape and strict layer ordering
  const rawEntries: { id: LayerId; status: LayerStatus }[] = [];
  for (let i = 0; i < LAYER_ORDER.length; i++) {
    const entry = obj.progression[i];
    if (typeof entry !== 'object' || entry === null) return null;
    const e = entry as Record<string, unknown>;

    if (e.id !== LAYER_ORDER[i]) return null;
    if (typeof e.status !== 'string' || !VALID_STATUSES.has(e.status)) return null;
    rawEntries.push({ id: e.id as LayerId, status: e.status as LayerStatus });
  }

  // Count leading 'solved' layers
  let solvedCount = 0;
  while (solvedCount < rawEntries.length && rawEntries[solvedCount].status === 'solved') {
    // Solved layer must be currently implemented
    if (!implementedLayers.has(rawEntries[solvedCount].id)) {
      return null;
    }
    solvedCount++;
  }

  const sanitizedEntries: LayerEntry[] = [];
  for (let i = 0; i < solvedCount; i++) {
    sanitizedEntries.push({ id: rawEntries[i].id, status: 'solved' });
  }

  if (solvedCount === LAYER_ORDER.length) {
    // All five solved: only valid if all 5 layers are implemented
    return {
      currentLayer: null,
      progression: sanitizedEntries,
    };
  }

  // Next entry must be the boundary layer: must be stored as 'active' or 'unlocked'
  const boundaryRaw = rawEntries[solvedCount];
  if (boundaryRaw.status !== 'active' && boundaryRaw.status !== 'unlocked') {
    return null;
  }

  // Derive boundary status
  const boundaryStatus: LayerStatus = implementedLayers.has(boundaryRaw.id) ? 'active' : 'unlocked';
  sanitizedEntries.push({ id: boundaryRaw.id, status: boundaryStatus });

  // All remaining layers after boundary must be 'locked'
  for (let i = solvedCount + 1; i < LAYER_ORDER.length; i++) {
    if (rawEntries[i].status !== 'locked') {
      return null;
    }
    sanitizedEntries.push({ id: rawEntries[i].id, status: 'locked' });
  }

  const activeEntry = sanitizedEntries.find(e => e.status === 'active');
  const currentLayer: LayerId | null = activeEntry?.id ?? null;

  return { currentLayer, progression: sanitizedEntries };
}

export function saveState(state: GameState, store: StateStore = sessionStore): void {
  store.save({
    version: 1,
    progression: state.progression,
  });
}

export function loadState(
  store: StateStore = sessionStore,
  implementedLayers: ReadonlySet<LayerId> = IMPLEMENTED_LAYERS,
): GameState | null {
  const raw = store.load();
  if (raw === null || raw === undefined) return null;
  return validateAndSanitize(raw, implementedLayers);
}

export function clearState(store: StateStore = sessionStore): void {
  store.clear();
}

