import {
  MAX_ID_LENGTH,
  SYNC_ID_PATTERN,
  SYNC_SESSION_ID_KEY,
} from './constants.js';

/**
 * Validates whether a candidate identifier satisfies SYNC_ID_PATTERN and MAX_ID_LENGTH.
 */
export function isValidSyncId(id: unknown): id is string {
  return typeof id === 'string' && SYNC_ID_PATTERN.test(id);
}

/**
 * Generates an in-memory random identifier conforming to SYNC_ID_PATTERN.
 * Uses Web Crypto (crypto.getRandomValues) when available, falling back to Math.random
 * if crypto is missing or if getRandomValues throws.
 * Does not rely on crypto.randomUUID(), which is restricted to secure contexts.
 */
export function generateSyncId(prefix = 'id'): string {
  const randomBytes = new Uint8Array(8);
  let filledWithCrypto = false;

  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      crypto.getRandomValues(randomBytes);
      filledWithCrypto = true;
    }
  } catch {
    // Web Crypto threw or is restricted; fall back gracefully to Math.random
  }

  if (!filledWithCrypto) {
    for (let i = 0; i < randomBytes.length; i++) {
      randomBytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const hex = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
  const timestamp = Date.now().toString(36);
  const rawId = `${prefix}_${timestamp}_${hex}`;

  // Sanitize characters and constrain to MAX_ID_LENGTH
  return rawId.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, MAX_ID_LENGTH);
}

/**
 * Safely accesses browser localStorage without throwing SecurityError or ReferenceError.
 */
function getBrowserLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Access denied (restricted iframe, disabled cookies, private browsing)
  }
  return null;
}

/**
 * Safely reads and validates the shared session ID from storage.
 */
function readStoredSessionId(storage: Storage | null, key: string): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const trimmed = raw.trim();
    if (isValidSyncId(trimmed)) {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Safely writes the shared session ID to storage, handling quota/security exceptions.
 */
function writeStoredSessionId(storage: Storage | null, key: string, id: string): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, id);
    return true;
  } catch {
    return false;
  }
}

export interface SyncSessionOptions {
  /** Custom tab ID for testing. Defaults to a freshly generated in-memory ID. */
  tabId?: string;
  /** Storage provider. Pass null to simulate completely unavailable storage. */
  storage?: Storage | null;
  /** Storage key holding the shared session ID. Defaults to SYNC_SESSION_ID_KEY. */
  storageKey?: string;
  /** Custom ID generator for deterministic test execution. */
  generateId?: (prefix: string) => string;
}

/**
 * Manages tab identity and shared puzzle-session identity for Phase 3 cross-tab sync.
 *
 * Invariants & Concurrency Notice:
 * - `tabId`: Unique per page load, held strictly IN MEMORY, never written to sessionStorage or localStorage.
 * - `sessionId`: Shared across live tabs, loaded from storage or freshly established.
 * - Concurrency limitation: localStorage read-then-write is NOT atomic across browser processes.
 *   If two tabs start simultaneously, both may read null and generate distinct session IDs.
 *   This class does not attempt cross-process locks; instead, it provides `reconcileSessionId()`
 *   and `syncSessionId()` so the cross-tab channel/manager can achieve consensus during handshake.
 * - Storage failures: Read/write errors fail gracefully without crashing the application.
 * - No side effects: Importing this module performs zero I/O or browser mutations.
 */
export class SyncSession {
  readonly tabId: string;
  private currentSessionId: string;
  private readonly storage: Storage | null;
  private readonly storageKey: string;
  private readonly generateIdFn: (prefix: string) => string;

  constructor(options: SyncSessionOptions = {}) {
    this.generateIdFn = options.generateId ?? generateSyncId;
    this.storageKey = options.storageKey ?? SYNC_SESSION_ID_KEY;
    this.storage = options.storage !== undefined ? options.storage : getBrowserLocalStorage();

    // 1. Establish unique in-memory tabId (never persisted in sessionStorage or localStorage)
    if (options.tabId && isValidSyncId(options.tabId)) {
      this.tabId = options.tabId;
    } else {
      this.tabId = this.safeGenerateId('tab');
    }

    // 2. Establish shared sessionId
    const stored = readStoredSessionId(this.storage, this.storageKey);
    if (stored) {
      this.currentSessionId = stored;
    } else {
      const created = this.safeGenerateId('sess');
      this.currentSessionId = created;
      writeStoredSessionId(this.storage, this.storageKey, created);
    }
  }

  /**
   * The shared puzzle session ID across all participating tabs.
   */
  get sessionId(): string {
    return this.currentSessionId;
  }

  /**
   * Synchronizes the in-memory sessionId with storage if another tab has updated it.
   */
  syncSessionId(): string {
    const stored = readStoredSessionId(this.storage, this.storageKey);
    if (stored && stored !== this.currentSessionId) {
      this.currentSessionId = stored;
    }
    return this.currentSessionId;
  }

  /**
   * Reconciles the local session ID with an authoritative candidate ID (e.g. from storage
   * or received from a peer during channel handshake).
   *
   * Used by higher-level synchronization managers to resolve split-session startup races.
   *
   * @param candidateSessionId The candidate session ID to reconcile with.
   * @param persist Whether to write the reconciled ID to storage (defaults to true).
   * @returns true if the session ID was updated, false if candidate was invalid or unchanged.
   */
  reconcileSessionId(candidateSessionId: string, persist = true): boolean {
    if (!isValidSyncId(candidateSessionId)) {
      return false;
    }
    if (candidateSessionId === this.currentSessionId) {
      return false;
    }
    this.currentSessionId = candidateSessionId;
    if (persist) {
      writeStoredSessionId(this.storage, this.storageKey, candidateSessionId);
    }
    return true;
  }

  /**
   * Establishes a new shared session ID (e.g., when a puzzle session reset occurs).
   */
  renewSessionId(customId?: string): string {
    const newId = customId && isValidSyncId(customId) ? customId : this.safeGenerateId('sess');
    this.currentSessionId = newId;
    writeStoredSessionId(this.storage, this.storageKey, newId);
    return newId;
  }

  /**
   * Safely invokes the configured ID generator, falling back to generateSyncId
   * if the custom generator throws, returns non-string, or returns an ID that
   * violates SYNC_ID_PATTERN. Never loops recursively.
   */
  private safeGenerateId(prefix: string): string {
    try {
      const candidate = this.generateIdFn(prefix);
      if (isValidSyncId(candidate)) {
        return candidate;
      }
    } catch {
      // Injected generator threw; fall back to internal default
    }
    return generateSyncId(prefix);
  }

  /**
   * Disposes of any resources held by this session instance.
   */
  dispose(): void {
    // Contract placeholder for deterministic lifecycle cleanup
  }
}

/**
 * Factory helper to construct a new SyncSession instance.
 */
export function createSyncSession(options?: SyncSessionOptions): SyncSession {
  return new SyncSession(options);
}
