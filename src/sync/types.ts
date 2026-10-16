import type {
  ENVELOPE_KEYS,
  FRAGMENT_KEYS,
  PAYLOAD_KEYS,
  SNAPSHOT_KEYS,
  SYNC_MESSAGE_TYPES,
  SYNC_PROTOCOL_VERSION,
} from './constants.js';

/** Protocol version literal, derived from constants.ts. */
export type SyncProtocolVersion = typeof SYNC_PROTOCOL_VERSION;

/** Canonical union of supported message types, derived from SYNC_MESSAGE_TYPES in constants.ts. */
export type SyncMessageType = (typeof SYNC_MESSAGE_TYPES)[number];

// ---------------------------------------------------------------------------
// Domain data
// ---------------------------------------------------------------------------

/**
 * An immutable puzzle signal fragment shared across tabs.
 *
 * - `signalId`:      logical channel / puzzle node (for example 'carrier-alpha').
 * - `fragmentId`:    slot within that channel (for example 'chunk-1').
 * - `fragmentValue`: opaque string, decoupled from puzzle-solving logic.
 * - `timestamp`:     epoch ms the fragment was captured. Receivers stamp it
 *                    from the carrying envelope's timestamp.
 *
 * Merge rule (idempotent): key = (signalId, fragmentId); the greater
 * `timestamp` wins; on a tie the lexicographically greater messageId wins.
 * Fragment timestamps are NEVER subject to MAX_MESSAGE_AGE_MS.
 */
export interface SignalFragment {
  readonly signalId: string;
  readonly fragmentId: string;
  readonly fragmentValue: string;
  readonly timestamp: number;
}

/**
 * A known peer tab. `lastSeen` is the LOCAL receive time (Date.now() on this
 * tab when the message arrived), never the sender's clock.
 */
export interface PeerInfo {
  readonly tabId: string;
  readonly protocolVersion: number;
  readonly lastSeen: number;
}

/**
 * Safe snapshot for late-joining tabs.
 *
 * Scope boundary: contains ONLY signal fragments. It deliberately excludes
 * GameState, layer progression, and answer hashes, so a remote message can
 * never mark a layer solved or bypass local validation. Session ID, protocol
 * version, and timestamp come from the envelope and are not repeated here.
 */
export interface Phase3SyncSnapshot {
  readonly signals: readonly SignalFragment[];
}

// ---------------------------------------------------------------------------
// Payloads
// ---------------------------------------------------------------------------

/** A tab announces itself. Broadcast (envelope.targetTabId is null). */
export interface PeerAnnouncePayload {
  readonly tabId: string;
  readonly protocolVersion: number;
}

/** Reply to one PEER_ANNOUNCE. Addressed (targetTabId = the announcer). */
export interface PeerAckPayload {
  readonly tabId: string;
  readonly protocolVersion: number;
  /** messageId of the PEER_ANNOUNCE being acknowledged. */
  readonly inReplyTo: string;
}

/** A tab is closing; peers prune it immediately. */
export interface PeerLeavePayload {
  readonly tabId: string;
}

/** Ask peers for a snapshot. Broadcast; `requestId` correlates replies. */
export interface StateRequestPayload {
  readonly requestId: string;
}

/**
 * Snapshot reply. Addressed to the requester (targetTabId), so N tabs do not
 * flood each other. Receivers ignore a requestId they did not issue.
 */
export interface StateSnapshotPayload {
  readonly requestId: string;
  readonly snapshot: Phase3SyncSnapshot;
}

/** One new or updated fragment. */
export interface SignalDispatchPayload {
  readonly signalId: string;
  readonly fragmentId: string;
  readonly fragmentValue: string;
}

/**
 * Clears synced signal data ONLY. It never touches any tab's GameState or
 * layer progression.
 *
 * Ordering semantics:
 * Includes a monotonically increasing `resetGeneration`. Receivers track the
 * highest applied generation and ignore any reset message with
 * `resetGeneration <= lastAppliedResetGeneration` so delayed, reordered, or
 * replayed reset messages cannot undo or disrupt a newer reset session.
 */
export interface SessionResetPayload {
  readonly resetId: string;
  readonly resetGeneration: number;
}

/** Maps each message type to its payload contract. */
export interface SyncMessagePayloadMap {
  readonly PEER_ANNOUNCE: PeerAnnouncePayload;
  readonly PEER_ACK: PeerAckPayload;
  readonly PEER_LEAVE: PeerLeavePayload;
  readonly STATE_REQUEST: StateRequestPayload;
  readonly STATE_SNAPSHOT: StateSnapshotPayload;
  readonly SIGNAL_DISPATCH: SignalDispatchPayload;
  readonly SESSION_RESET: SessionResetPayload;
}

// ---------------------------------------------------------------------------
// Envelopes: Untrusted -> Raw (headers validated) -> typed
// ---------------------------------------------------------------------------

/**
 * What arrives from BroadcastChannel / storage events after a plain-object
 * check (Object.getPrototypeOf === Object.prototype, not an array) and the
 * size check. Every value is still unknown until runtime validation runs.
 */
export type UntrustedSyncEnvelope = Readonly<Record<string, unknown>>;

/**
 * Header fields validated (id pattern, version, age, own-property key set);
 * `payload` is still untrusted until its per-type validator runs.
 */
export interface RawSyncEnvelope {
  readonly protocolVersion: number;
  readonly messageId: string;
  readonly sessionId: string;
  readonly senderTabId: string;
  /** Intended recipient, or null for a broadcast. Others must ignore it. */
  readonly targetTabId: string | null;
  readonly type: SyncMessageType;
  readonly timestamp: number;
  readonly payload: unknown;
}

/**
 * Fully typed envelope defined as a mapped discriminated union over SyncMessageType.
 * When parameterized with a specific type T (for example SyncEnvelope<'SIGNAL_DISPATCH'>),
 * payload narrows to SyncMessagePayloadMap[T]. When T is omitted, it evaluates to
 * the discriminated union of all valid envelopes.
 */
export type SyncEnvelope<T extends SyncMessageType = SyncMessageType> = {
  [K in T]: Omit<RawSyncEnvelope, 'type' | 'payload'> & {
    readonly type: K;
    readonly payload: SyncMessagePayloadMap[K];
  };
}[T];

/** Discriminated union of every typed envelope, equivalent to SyncEnvelope. */
export type AnySyncEnvelope = SyncEnvelope;

/** Guard: candidate is a RawSyncEnvelope (headers valid, payload unknown). */
export type RawEnvelopeTypeGuard = (candidate: unknown) => candidate is RawSyncEnvelope;

/** Guard: candidate is a fully validated SyncEnvelope<T>. */
export type SyncEnvelopeTypeGuard<T extends SyncMessageType = SyncMessageType> = (
  candidate: unknown,
) => candidate is SyncEnvelope<T>;

// ---------------------------------------------------------------------------
// Compile-time guarantee that the runtime key lists in constants.ts match the
// interfaces exactly. Adding or removing a field in one place without the
// other fails `tsc`.
// ---------------------------------------------------------------------------

type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type KeyListsMatchInterfaces = [
  Assert<Equals<keyof RawSyncEnvelope, (typeof ENVELOPE_KEYS)[number]>>,
  Assert<Equals<keyof SignalFragment, (typeof FRAGMENT_KEYS)[number]>>,
  Assert<Equals<keyof Phase3SyncSnapshot, (typeof SNAPSHOT_KEYS)[number]>>,
  Assert<Equals<keyof PeerAnnouncePayload, (typeof PAYLOAD_KEYS.PEER_ANNOUNCE)[number]>>,
  Assert<Equals<keyof PeerAckPayload, (typeof PAYLOAD_KEYS.PEER_ACK)[number]>>,
  Assert<Equals<keyof PeerLeavePayload, (typeof PAYLOAD_KEYS.PEER_LEAVE)[number]>>,
  Assert<Equals<keyof StateRequestPayload, (typeof PAYLOAD_KEYS.STATE_REQUEST)[number]>>,
  Assert<Equals<keyof StateSnapshotPayload, (typeof PAYLOAD_KEYS.STATE_SNAPSHOT)[number]>>,
  Assert<Equals<keyof SignalDispatchPayload, (typeof PAYLOAD_KEYS.SIGNAL_DISPATCH)[number]>>,
  Assert<Equals<keyof SessionResetPayload, (typeof PAYLOAD_KEYS.SESSION_RESET)[number]>>,
];
