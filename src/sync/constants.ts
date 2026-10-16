/**
 * Phase 3 cross-tab sync: runtime constants.
 *
 * Single source of truth for every runtime value used by the sync layer.
 * types.ts derives its types from these; do not repeat any literal there.
 *
 * Tab identity: a tab's ID is generated IN MEMORY on every page load and is
 * never persisted. sessionStorage is copied by "Duplicate tab" and by session
 * restore, so a persisted ID could be shared by two live tabs. Do not use
 * crypto.randomUUID() (secure contexts only): use crypto.getRandomValues when
 * present, with a Math.random fallback. The ID is not a secret.
 */

// ---------------------------------------------------------------------------
// Protocol and storage identifiers
// ---------------------------------------------------------------------------

/** Canonical protocol version for Phase 3 cross-tab messages. */
export const SYNC_PROTOCOL_VERSION = 1;

/** BroadcastChannel topic. */
export const CROSS_TAB_CHANNEL_NAME = 'mystery-box-signal-v1';

/**
 * localStorage key used by the storage-event fallback. Writes can throw
 * (quota, private mode) and `storage` events only fire when the value
 * CHANGES, so the written value must embed the unique messageId.
 */
export const CROSS_TAB_STORAGE_KEY = 'mystery-box-sync-event-v1';

/** localStorage key holding the puzzle session ID shared by all tabs. */
export const SYNC_SESSION_ID_KEY = 'mystery-box-sync-session-id';

// ---------------------------------------------------------------------------
// Timing (milliseconds). Keep injectable in the sync service so tests can use
// fake timers and a fake clock.
// ---------------------------------------------------------------------------

/** Heartbeat broadcast interval. */
export const HEARTBEAT_INTERVAL_MS = 4000;

/** A peer not heard from for this long is pruned. Keep >= 2x the heartbeat. */
export const PEER_TIMEOUT_MS = 12000;

/**
 * Maximum age of an ENVELOPE (envelope.timestamp vs the local clock).
 * Never apply this to SignalFragment.timestamp: a late-joining tab's snapshot
 * legitimately contains old fragments.
 */
export const MAX_MESSAGE_AGE_MS = 30000;

/** Tolerated envelope timestamp drift into the future (clock skew). */
export const FUTURE_DRIFT_TOLERANCE_MS = 5000;

// ---------------------------------------------------------------------------
// Resource limits. Any same-origin script can post to the channel, so every
// inbound message is size- and shape-bounded BEFORE it is processed.
// ---------------------------------------------------------------------------

/** Capacity of the messageId de-duplication cache. */
export const DEDUP_CACHE_LIMIT = 200;

/** Maximum number of fragments in a snapshot or in local signal storage. */
export const MAX_SIGNALS = 64;

/** Maximum length of any identifier field. */
export const MAX_ID_LENGTH = 64;

/** Maximum length of SignalFragment.fragmentValue. */
export const MAX_FRAGMENT_VALUE_LENGTH = 256;

/** Maximum serialized (JSON) size of one message. Reject larger ones unparsed. */
export const MAX_MESSAGE_BYTES = 16384;

/**
 * Pattern every identifier must match (tabId, messageId, sessionId, requestId,
 * resetId, inReplyTo, signalId, fragmentId). Conservative on purpose.
 */
export const SYNC_ID_PATTERN = new RegExp(`^[A-Za-z0-9_-]{1,${MAX_ID_LENGTH}}$`);

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/**
 * Canonical list of message types. Single source of truth for validation
 * and for the SyncMessageType union in types.ts.
 */
export const SYNC_MESSAGE_TYPES = [
  'PEER_ANNOUNCE',
  'PEER_ACK',
  'PEER_LEAVE',
  'STATE_REQUEST',
  'STATE_SNAPSHOT',
  'SIGNAL_DISPATCH',
  'SESSION_RESET',
] as const;

/** Constant-time membership check for untrusted `type` strings. */
export const VALID_SYNC_MESSAGE_TYPES: ReadonlySet<string> = new Set<string>(SYNC_MESSAGE_TYPES);

// ---------------------------------------------------------------------------
// Exact key lists: validators reject objects with missing OR unknown keys.
// types.ts asserts at compile time that these match the interfaces exactly.
// ---------------------------------------------------------------------------

/** Exact own-property set of every envelope header. */
export const ENVELOPE_KEYS = [
  'protocolVersion',
  'messageId',
  'sessionId',
  'senderTabId',
  'targetTabId',
  'type',
  'timestamp',
  'payload',
] as const;

/** Exact own-property set of each payload type. */
export const PAYLOAD_KEYS = {
  PEER_ANNOUNCE: ['tabId', 'protocolVersion'],
  PEER_ACK: ['tabId', 'protocolVersion', 'inReplyTo'],
  PEER_LEAVE: ['tabId'],
  STATE_REQUEST: ['requestId'],
  STATE_SNAPSHOT: ['requestId', 'snapshot'],
  SIGNAL_DISPATCH: ['signalId', 'fragmentId', 'fragmentValue'],
  SESSION_RESET: ['resetId', 'resetGeneration'],
} as const;

/** Exact own-property set of SignalFragment and Phase3SyncSnapshot. */
export const FRAGMENT_KEYS = ['signalId', 'fragmentId', 'fragmentValue', 'timestamp'] as const;
export const SNAPSHOT_KEYS = ['signals'] as const;
