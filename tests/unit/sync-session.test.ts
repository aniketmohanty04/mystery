import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  SyncSession,
  createSyncSession,
  generateSyncId,
  isValidSyncId,
} from '../../src/sync/session.js';
import {
  SYNC_ID_PATTERN,
  SYNC_SESSION_ID_KEY,
  MAX_ID_LENGTH,
} from '../../src/sync/constants.js';

function createMockStorage(initialData: Record<string, string> = {}): Storage {
  const map = new Map<string, string>(Object.entries(initialData));
  return {
    getItem: vi.fn((key: string) => map.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      map.set(key, String(value));
    }),
    removeItem: vi.fn((key: string) => {
      map.delete(key);
    }),
    clear: vi.fn(() => {
      map.clear();
    }),
    key: vi.fn((idx: number) => Array.from(map.keys())[idx] ?? null),
    get length() {
      return map.size;
    },
  };
}

describe('SyncSession & Session Identity', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('generates unique tab IDs across separate session instances', () => {
    const session1 = new SyncSession({ storage: null });
    const session2 = new SyncSession({ storage: null });
    const session3 = new SyncSession({ storage: null });

    expect(session1.tabId).not.toBe(session2.tabId);
    expect(session2.tabId).not.toBe(session3.tabId);
    expect(session1.tabId).toMatch(SYNC_ID_PATTERN);
    expect(session2.tabId).toMatch(SYNC_ID_PATTERN);
    expect(session3.tabId).toMatch(SYNC_ID_PATTERN);
  });

  it('keeps tab ID strictly in-memory and never writes it to sessionStorage or localStorage', () => {
    const storage = createMockStorage();
    const session = new SyncSession({ storage });

    expect(session.tabId).toBeDefined();
    // Only the session ID should be written to storage, never the tab ID
    expect(storage.getItem('mystery-box-tab-id')).toBeNull();
    expect(storage.setItem).toHaveBeenCalledWith(SYNC_SESSION_ID_KEY, session.sessionId);
    expect(storage.setItem).not.toHaveBeenCalledWith(
      expect.stringMatching(/tab/i),
      session.tabId,
    );
  });

  it('reuses existing valid session ID from storage across instances', () => {
    const storage = createMockStorage();

    const sessionA = new SyncSession({ storage });
    const initialSessionId = sessionA.sessionId;
    expect(initialSessionId).toMatch(SYNC_ID_PATTERN);
    expect(storage.getItem(SYNC_SESSION_ID_KEY)).toBe(initialSessionId);

    // Second session in another simulated tab connecting to same storage
    const sessionB = new SyncSession({ storage });
    expect(sessionB.sessionId).toBe(initialSessionId);
    expect(sessionB.tabId).not.toBe(sessionA.tabId); // Distinct tab IDs, shared session ID
  });

  it('handles completely missing / unavailable storage (null storage) gracefully', () => {
    expect(() => {
      const session = new SyncSession({ storage: null });
      expect(session.tabId).toMatch(SYNC_ID_PATTERN);
      expect(session.sessionId).toMatch(SYNC_ID_PATTERN);
      expect(session.syncSessionId()).toBe(session.sessionId);
    }).not.toThrow();
  });

  it('detects and recovers from malformed data in storage', () => {
    const malformedValues = [
      '',                                // Empty string
      '   ',                             // Whitespace only
      'invalid$chars#here!',             // Prohibited characters
      'a'.repeat(MAX_ID_LENGTH + 10),    // Exceeds max length limit
      'tab id with spaces',              // Unsafe spaces
    ];

    for (const badValue of malformedValues) {
      const storage = createMockStorage({ [SYNC_SESSION_ID_KEY]: badValue });
      const session = new SyncSession({ storage });

      // Malformed value must be rejected and replaced with a valid generated session ID
      expect(session.sessionId).not.toBe(badValue);
      expect(session.sessionId).toMatch(SYNC_ID_PATTERN);
      expect(storage.setItem).toHaveBeenCalledWith(SYNC_SESSION_ID_KEY, session.sessionId);
    }
  });

  it('handles storage.getItem throwing an exception gracefully', () => {
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new DOMException('Access denied by security policy', 'SecurityError');
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    };

    expect(() => {
      const session = new SyncSession({ storage: throwingStorage });
      expect(session.tabId).toMatch(SYNC_ID_PATTERN);
      expect(session.sessionId).toMatch(SYNC_ID_PATTERN);
    }).not.toThrow();
  });

  it('handles storage.setItem throwing (e.g. QuotaExceededError or private browsing)', () => {
    const throwingStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException('Storage quota exceeded', 'QuotaExceededError');
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    };

    expect(() => {
      const session = new SyncSession({ storage: throwingStorage });
      expect(session.tabId).toMatch(SYNC_ID_PATTERN);
      expect(session.sessionId).toMatch(SYNC_ID_PATTERN);
    }).not.toThrow();
  });

  it('allows renewing session ID and updates storage', () => {
    const storage = createMockStorage();
    const session = new SyncSession({ storage });
    const originalSessionId = session.sessionId;

    const renewedId = session.renewSessionId();
    expect(renewedId).not.toBe(originalSessionId);
    expect(renewedId).toMatch(SYNC_ID_PATTERN);
    expect(session.sessionId).toBe(renewedId);
    expect(storage.getItem(SYNC_SESSION_ID_KEY)).toBe(renewedId);
  });

  it('syncSessionId updates local session ID when another tab updates storage', () => {
    const storage = createMockStorage();
    const session = new SyncSession({ storage });

    const newRemoteSessionId = 'sess_remote_updated_987654';
    storage.setItem(SYNC_SESSION_ID_KEY, newRemoteSessionId);

    const synced = session.syncSessionId();
    expect(synced).toBe(newRemoteSessionId);
    expect(session.sessionId).toBe(newRemoteSessionId);
  });

  it('ignores malformed remote session IDs during syncSessionId', () => {
    const storage = createMockStorage();
    const session = new SyncSession({ storage });
    const originalId = session.sessionId;

    storage.setItem(SYNC_SESSION_ID_KEY, 'corrupted@@@value');
    const synced = session.syncSessionId();
    expect(synced).toBe(originalId);
    expect(session.sessionId).toBe(originalId);
  });

  it('supports custom ID generators for deterministic testing', () => {
    let count = 0;
    const deterministicGen = (prefix: string) => `${prefix}_test_${++count}`;
    const session = new SyncSession({
      storage: null,
      generateId: deterministicGen,
    });

    expect(session.tabId).toBe('tab_test_1');
    expect(session.sessionId).toBe('sess_test_2');
  });

  it('createSyncSession factory helper produces configured instances', () => {
    const session = createSyncSession({ storage: null });
    expect(session).toBeInstanceOf(SyncSession);
    expect(session.tabId).toMatch(SYNC_ID_PATTERN);
  });

  it('dispose executes cleanly without error', () => {
    const session = new SyncSession({ storage: null });
    expect(() => session.dispose()).not.toThrow();
  });

  it('validateSyncId validates correct identifiers and rejects invalid ones', () => {
    expect(isValidSyncId('valid_id_123')).toBe(true);
    expect(isValidSyncId('tab-01_a-b')).toBe(true);
    expect(isValidSyncId('')).toBe(false);
    expect(isValidSyncId(null)).toBe(false);
    expect(isValidSyncId(undefined)).toBe(false);
    expect(isValidSyncId(12345)).toBe(false);
    expect(isValidSyncId('invalid id with spaces')).toBe(false);
    expect(isValidSyncId('id_with_special!@#')).toBe(false);
    expect(isValidSyncId('a'.repeat(MAX_ID_LENGTH + 1))).toBe(false);
    expect(isValidSyncId('a'.repeat(MAX_ID_LENGTH))).toBe(true);
  });

  it('generateSyncId generates unique IDs satisfying SYNC_ID_PATTERN and MAX_ID_LENGTH', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const id = generateSyncId('sig');
      expect(id).toMatch(SYNC_ID_PATTERN);
      expect(id.length).toBeLessThanOrEqual(MAX_ID_LENGTH);
      ids.add(id);
    }
    expect(ids.size).toBe(50);
  });

  // ---------------------------------------------------------------------------
  // Hardening tests: crypto.getRandomValues throwing fallback
  // ---------------------------------------------------------------------------

  it('falls back to Math.random gracefully when crypto.getRandomValues throws', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: () => {
        throw new Error('Simulated crypto quota or security failure');
      },
    });

    const generated = generateSyncId('safe');
    expect(generated).toMatch(SYNC_ID_PATTERN);
    expect(generated.startsWith('safe_')).toBe(true);
    expect(generated.length).toBeLessThanOrEqual(MAX_ID_LENGTH);
  });

  it('falls back to Math.random gracefully when global crypto is undefined', () => {
    vi.stubGlobal('crypto', undefined);

    const generated = generateSyncId('nocrypto');
    expect(generated).toMatch(SYNC_ID_PATTERN);
    expect(generated.startsWith('nocrypto_')).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Hardening tests: custom generator failure and invalid output recovery
  // ---------------------------------------------------------------------------

  it('recovers when custom generator returns invalid characters without crashing or infinite loop', () => {
    const badGenerator = vi.fn(() => 'illegal!@#characters');
    const session = new SyncSession({
      storage: null,
      generateId: badGenerator as any,
    });

    // Custom generator was called, but invalid result was discarded and replaced by valid internal ID
    expect(badGenerator).toHaveBeenCalled();
    expect(session.tabId).toMatch(SYNC_ID_PATTERN);
    expect(session.sessionId).toMatch(SYNC_ID_PATTERN);
    expect(session.tabId).not.toBe('illegal!@#characters');
    expect(session.sessionId).not.toBe('illegal!@#characters');
  });

  it('recovers when custom generator returns oversized strings', () => {
    const oversizedGenerator = vi.fn(() => 'x'.repeat(MAX_ID_LENGTH + 50));
    const session = new SyncSession({
      storage: null,
      generateId: oversizedGenerator as any,
    });

    expect(session.tabId).toMatch(SYNC_ID_PATTERN);
    expect(session.sessionId).toMatch(SYNC_ID_PATTERN);
    expect(session.tabId.length).toBeLessThanOrEqual(MAX_ID_LENGTH);
  });

  it('recovers when custom generator throws an exception', () => {
    const crashingGenerator = vi.fn(() => {
      throw new Error('Custom generator runtime crash');
    });

    expect(() => {
      const session = new SyncSession({
        storage: null,
        generateId: crashingGenerator as any,
      });
      expect(session.tabId).toMatch(SYNC_ID_PATTERN);
      expect(session.sessionId).toMatch(SYNC_ID_PATTERN);
    }).not.toThrow();
  });

  it('recovers when custom generator returns non-string values', () => {
    const nullGenerator = vi.fn(() => null as unknown as string);
    const session = new SyncSession({
      storage: null,
      generateId: nullGenerator,
    });

    expect(session.tabId).toMatch(SYNC_ID_PATTERN);
    expect(session.sessionId).toMatch(SYNC_ID_PATTERN);
  });

  // ---------------------------------------------------------------------------
  // Hardening tests: concurrent initialization and reconciliation contract
  // ---------------------------------------------------------------------------

  it('documents and models non-atomic concurrent startup, resolving via reconcileSessionId', () => {
    // Simulating two tabs reading storage before either has written
    const storage = createMockStorage();

    // Tab 1 starts with storage empty
    const tab1 = new SyncSession({ storage });
    const tab1InitialId = tab1.sessionId;

    // Tab 2 started at the exact same instant with custom generated ID (simulating a race condition)
    const tab2 = new SyncSession({
      storage: null, // tab 2 had race condition before reading tab 1's write
      generateId: () => 'sess_tab2_divergent',
    });
    expect(tab2.sessionId).toBe('sess_tab2_divergent');
    expect(tab1.sessionId).not.toBe(tab2.sessionId);

    // Later, during cross-tab channel handshake, Tab 2 reconciles to Tab 1's authoritative session ID:
    const reconciled = tab2.reconcileSessionId(tab1InitialId, true);
    expect(reconciled).toBe(true);
    expect(tab2.sessionId).toBe(tab1InitialId);

    // Calling reconcileSessionId with the same ID returns false (no-op)
    expect(tab2.reconcileSessionId(tab1InitialId)).toBe(false);

    // Calling reconcileSessionId with an invalid ID is rejected
    expect(tab2.reconcileSessionId('invalid$candidate#id')).toBe(false);
    expect(tab2.sessionId).toBe(tab1InitialId); // unchanged
  });
});
