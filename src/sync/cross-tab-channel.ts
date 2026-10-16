import type {
  AnySyncEnvelope,
  RawSyncEnvelope,
  SyncEnvelope,
  SyncMessageType,
  SyncMessagePayloadMap,
} from './types.js';
import {
  SYNC_PROTOCOL_VERSION,
  VALID_SYNC_MESSAGE_TYPES,
  MAX_MESSAGE_AGE_MS,
  FUTURE_DRIFT_TOLERANCE_MS,
  DEDUP_CACHE_LIMIT,
  MAX_MESSAGE_BYTES,
  PAYLOAD_KEYS,
} from './constants.js';
import type { ChannelTransport } from './transport.js';
import { generateSyncId, isValidSyncId } from './session.js';

export interface CrossTabChannelOptions {
  transport: ChannelTransport;
  tabId: string;
  getSessionId: () => string;
}

export class CrossTabChannel {
  private readonly transport: ChannelTransport;
  readonly tabId: string;
  private readonly getSessionId: () => string;
  private readonly listeners = new Set<(envelope: AnySyncEnvelope) => void>();
  private readonly seenMessageIds = new Map<string, number>();
  private unregisterTransportListener: (() => void) | null = null;
  private isClosed = false;

  constructor(options: CrossTabChannelOptions) {
    this.transport = options.transport;
    this.tabId = options.tabId;
    this.getSessionId = options.getSessionId;

    this.unregisterTransportListener = this.transport.onMessage((raw: string) => {
      this.handleIncoming(raw);
    });
  }

  get mode(): 'broadcast-channel' | 'local-storage' {
    return this.transport.mode;
  }

  /**
   * Broadcast or send an addressed typed message across tabs.
   */
  send<T extends SyncMessageType>(
    type: T,
    payload: SyncMessagePayloadMap[T],
    targetTabId: string | null = null,
  ): SyncEnvelope<T> | null {
    if (this.isClosed) return null;

    const messageId = generateSyncId('msg');
    const envelope: SyncEnvelope<T> = {
      protocolVersion: SYNC_PROTOCOL_VERSION,
      messageId,
      sessionId: this.getSessionId(),
      senderTabId: this.tabId,
      targetTabId,
      type,
      timestamp: Date.now(),
      payload,
    };

    // Mark sent message as seen to protect against local loopback reflections
    this.recordMessageId(messageId);

    try {
      const serialized = JSON.stringify(envelope);
      if (serialized.length <= MAX_MESSAGE_BYTES) {
        this.transport.postMessage(serialized);
      }
    } catch {
      return null;
    }

    return envelope;
  }

  /**
   * Subscribe to validated incoming messages from other tabs.
   */
  onMessage(handler: (envelope: AnySyncEnvelope) => void): () => void {
    if (this.isClosed) return () => {};
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  /**
   * Close the channel and release all listeners.
   */
  close(): void {
    if (this.isClosed) return;
    this.isClosed = true;

    if (this.unregisterTransportListener) {
      this.unregisterTransportListener();
      this.unregisterTransportListener = null;
    }

    this.transport.close();
    this.listeners.clear();
    this.seenMessageIds.clear();
  }

  // ---------------------------------------------------------------------------
  // Validation and deduplication
  // ---------------------------------------------------------------------------

  private handleIncoming(raw: string): void {
    if (this.isClosed) return;
    if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) return;

    const validated = this.validateRawEnvelope(raw);
    if (!validated) return;

    // Check duplicate
    if (this.seenMessageIds.has(validated.messageId)) {
      return;
    }
    this.recordMessageId(validated.messageId);

    // Validate payload shape
    const typedEnvelope = this.validatePayload(validated);
    if (!typedEnvelope) return;

    for (const listener of this.listeners) {
      try {
        listener(typedEnvelope);
      } catch {
        // Prevent listener failures from cascading
      }
    }
  }

  validateRawEnvelope(raw: string): RawSyncEnvelope | null {
    let obj: unknown;
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }

    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
    const msg = obj as Record<string, unknown>;

    // 1. Protocol version
    if (msg.protocolVersion !== SYNC_PROTOCOL_VERSION) return null;

    // 2. Message ID
    if (!isValidSyncId(msg.messageId)) return null;

    // 3. Sender Tab ID (must be valid, and must not be our own tab)
    if (!isValidSyncId(msg.senderTabId)) return null;
    if (msg.senderTabId === this.tabId) return null;

    // 4. Target Tab ID (null for broadcast, or must match our tabId if addressed)
    if (msg.targetTabId !== null) {
      if (typeof msg.targetTabId !== 'string' || !isValidSyncId(msg.targetTabId)) {
        return null;
      }
      if (msg.targetTabId !== this.tabId) {
        return null; // Addressed to a different tab, safely ignore
      }
    }

    // 5. Session ID
    if (!isValidSyncId(msg.sessionId)) return null;
    const currentSessionId = this.getSessionId();
    // Allow SESSION_RESET to arrive even if sessionId is transitioning
    if (msg.type !== 'SESSION_RESET' && msg.sessionId !== currentSessionId) {
      return null;
    }

    // 6. Message Type
    if (typeof msg.type !== 'string' || !VALID_SYNC_MESSAGE_TYPES.has(msg.type)) {
      return null;
    }

    // 7. Timestamp validation (within clock skew tolerance, not stale)
    if (typeof msg.timestamp !== 'number' || !Number.isFinite(msg.timestamp)) return null;
    const now = Date.now();
    if (msg.timestamp > now + FUTURE_DRIFT_TOLERANCE_MS) return null;
    if (now - msg.timestamp > MAX_MESSAGE_AGE_MS) return null;

    return msg as unknown as RawSyncEnvelope;
  }

  private validatePayload(envelope: RawSyncEnvelope): AnySyncEnvelope | null {
    const payload = envelope.payload;
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      return null;
    }
    const p = payload as Record<string, unknown>;
    const expectedKeys = PAYLOAD_KEYS[envelope.type];

    for (const key of expectedKeys) {
      if (!(key in p) || p[key] === undefined) {
        return null;
      }
    }

    // Specific structural checks per message type
    switch (envelope.type) {
      case 'PEER_ANNOUNCE':
      case 'PEER_ACK': {
        if (!isValidSyncId(p.tabId)) return null;
        if (typeof p.protocolVersion !== 'number') return null;
        if (envelope.type === 'PEER_ACK' && !isValidSyncId(p.inReplyTo)) return null;
        break;
      }
      case 'PEER_LEAVE': {
        if (!isValidSyncId(p.tabId)) return null;
        break;
      }
      case 'STATE_REQUEST': {
        if (!isValidSyncId(p.requestId)) return null;
        break;
      }
      case 'STATE_SNAPSHOT': {
        if (!isValidSyncId(p.requestId)) return null;
        if (typeof p.snapshot !== 'object' || p.snapshot === null) return null;
        const snap = p.snapshot as Record<string, unknown>;
        if (!Array.isArray(snap.signals)) return null;
        break;
      }
      case 'SIGNAL_DISPATCH': {
        if (!isValidSyncId(p.signalId)) return null;
        if (!isValidSyncId(p.fragmentId)) return null;
        if (typeof p.fragmentValue !== 'string') return null;
        break;
      }
      case 'SESSION_RESET': {
        if (!isValidSyncId(p.resetId)) return null;
        if (typeof p.resetGeneration !== 'number' || !Number.isFinite(p.resetGeneration)) return null;
        break;
      }
    }

    return envelope as AnySyncEnvelope;
  }

  private recordMessageId(id: string): void {
    const now = Date.now();
    this.seenMessageIds.set(id, now);

    if (this.seenMessageIds.size > DEDUP_CACHE_LIMIT) {
      for (const [key, timestamp] of this.seenMessageIds.entries()) {
        if (now - timestamp > MAX_MESSAGE_AGE_MS) {
          this.seenMessageIds.delete(key);
        }
      }
      if (this.seenMessageIds.size > DEDUP_CACHE_LIMIT) {
        const oldest = this.seenMessageIds.keys().next().value;
        if (oldest) this.seenMessageIds.delete(oldest);
      }
    }
  }
}
