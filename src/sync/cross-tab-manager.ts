import type {
  AnySyncEnvelope,
  PeerInfo,
  SignalFragment,
  SyncEnvelope,
} from './types.js';
import {
  HEARTBEAT_INTERVAL_MS,
  PEER_TIMEOUT_MS,
  SYNC_PROTOCOL_VERSION,
} from './constants.js';
import { SyncSession, type SyncSessionOptions, generateSyncId } from './session.js';
import { createDefaultTransport, type ChannelTransport } from './transport.js';
import { CrossTabChannel } from './cross-tab-channel.js';

export interface CrossTabManagerOptions {
  session?: SyncSession;
  sessionOptions?: SyncSessionOptions;
  transport?: ChannelTransport;
  enableHeartbeat?: boolean;
  heartbeatIntervalMs?: number;
  peerTimeoutMs?: number;
}

type CrossTabManagerEvent = 'peer-change' | 'signals-updated' | 'session-reset';

export class CrossTabManager {
  readonly session: SyncSession;
  private readonly channel: CrossTabChannel;
  private readonly activePeers = new Map<string, PeerInfo>();
  private readonly signals = new Map<string, SignalFragment>();
  private readonly eventListeners = new Map<CrossTabManagerEvent, Set<(...args: any[]) => void>>();

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly heartbeatIntervalMs: number;
  private readonly peerTimeoutMs: number;
  private pageHideHandler: (() => void) | null = null;
  private isDisposed = false;
  private currentResetGeneration = 0;
  private lastAppliedResetGeneration = 0;

  constructor(options: CrossTabManagerOptions = {}) {
    this.session = options.session ?? new SyncSession(options.sessionOptions);
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
    this.peerTimeoutMs = options.peerTimeoutMs ?? PEER_TIMEOUT_MS;

    const transport = options.transport ?? createDefaultTransport();
    this.channel = new CrossTabChannel({
      transport,
      tabId: this.session.tabId,
      getSessionId: () => this.session.sessionId,
    });

    this.channel.onMessage((envelope) => {
      this.handleEnvelope(envelope);
    });

    // Window exit hook for graceful departure
    if (typeof window !== 'undefined') {
      this.pageHideHandler = () => {
        this.sendLeave();
      };
      window.addEventListener('pagehide', this.pageHideHandler);
      window.addEventListener('beforeunload', this.pageHideHandler);
    }

    if (options.enableHeartbeat !== false) {
      this.startHeartbeat();
    }

    // Announce presence and request state snapshot from peers
    this.announcePresence();
    this.requestSnapshot();
  }

  get tabId(): string {
    return this.session.tabId;
  }

  get sessionId(): string {
    return this.session.sessionId;
  }

  get mode(): 'broadcast-channel' | 'local-storage' {
    return this.channel.mode;
  }

  get peers(): PeerInfo[] {
    return Array.from(this.activePeers.values());
  }

  get knownSignals(): SignalFragment[] {
    return Array.from(this.signals.values());
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  announcePresence(): void {
    if (this.isDisposed) return;
    this.channel.send('PEER_ANNOUNCE', {
      tabId: this.tabId,
      protocolVersion: SYNC_PROTOCOL_VERSION,
    });
  }

  requestSnapshot(): void {
    if (this.isDisposed) return;
    this.channel.send('STATE_REQUEST', {
      requestId: generateSyncId('req'),
    });
  }

  dispatchSignal(signalId: string, fragmentId: string, fragmentValue: string): SignalFragment | null {
    if (this.isDisposed) return null;

    const fragment: SignalFragment = {
      signalId,
      fragmentId,
      fragmentValue,
      timestamp: Date.now(),
    };

    const key = `${signalId}::${fragmentId}`;
    this.signals.set(key, fragment);

    this.channel.send('SIGNAL_DISPATCH', {
      signalId,
      fragmentId,
      fragmentValue,
    });

    this.emit('signals-updated', this.knownSignals);
    return fragment;
  }

  resetSession(): void {
    if (this.isDisposed) return;

    this.currentResetGeneration++;
    this.lastAppliedResetGeneration = this.currentResetGeneration;
    const newSessionId = this.session.renewSessionId();

    this.signals.clear();
    this.activePeers.clear();

    this.channel.send('SESSION_RESET', {
      resetId: generateSyncId('rst'),
      resetGeneration: this.currentResetGeneration,
    });

    this.emit('session-reset', { newSessionId });
    this.emit('signals-updated', []);
    this.emit('peer-change', []);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  on(event: 'peer-change', handler: (peers: PeerInfo[]) => void): () => void;
  on(event: 'signals-updated', handler: (signals: SignalFragment[]) => void): () => void;
  on(event: 'session-reset', handler: (payload: { newSessionId: string }) => void): () => void;
  on(event: CrossTabManagerEvent, handler: (...args: any[]) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);
    return () => {
      this.eventListeners.get(event)?.delete(handler);
    };
  }

  private emit(event: CrossTabManagerEvent, ...args: any[]): void {
    const handlers = this.eventListeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch {
        // Suppress listener errors
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle & Cleanup
  // ---------------------------------------------------------------------------

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;

    this.sendLeave();

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (typeof window !== 'undefined' && this.pageHideHandler) {
      window.removeEventListener('pagehide', this.pageHideHandler);
      window.removeEventListener('beforeunload', this.pageHideHandler);
      this.pageHideHandler = null;
    }

    this.channel.close();
    this.session.dispose();
    this.activePeers.clear();
    this.signals.clear();
    this.eventListeners.clear();
  }

  private sendLeave(): void {
    try {
      this.channel.send('PEER_LEAVE', { tabId: this.tabId });
    } catch {
      // Ignored during page unload
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.announcePresence();
      this.pruneStalePeers();
    }, this.heartbeatIntervalMs);
  }

  pruneStalePeers(): void {
    const now = Date.now();
    let changed = false;

    for (const [peerId, peer] of this.activePeers.entries()) {
      if (now - peer.lastSeen > this.peerTimeoutMs) {
        this.activePeers.delete(peerId);
        changed = true;
      }
    }

    if (changed) {
      this.emit('peer-change', this.peers);
    }
  }

  // ---------------------------------------------------------------------------
  // Message Handling
  // ---------------------------------------------------------------------------

  private handleEnvelope(envelope: AnySyncEnvelope): void {
    switch (envelope.type) {
      case 'PEER_ANNOUNCE': {
        const { tabId, protocolVersion } = (envelope as SyncEnvelope<'PEER_ANNOUNCE'>).payload;
        if (!tabId || tabId === this.tabId) return;

        const isNew = !this.activePeers.has(tabId);
        const existing = this.activePeers.get(tabId);
        if (existing) {
          (existing as any).lastSeen = Date.now();
        } else {
          this.activePeers.set(tabId, {
            tabId,
            protocolVersion,
            lastSeen: Date.now(),
          });
        }

        // Send addressed ACK back to announcer
        this.channel.send(
          'PEER_ACK',
          {
            tabId: this.tabId,
            protocolVersion: SYNC_PROTOCOL_VERSION,
            inReplyTo: envelope.messageId,
          },
          tabId,
        );

        if (isNew) {
          this.emit('peer-change', this.peers);
        }
        break;
      }

      case 'PEER_ACK': {
        const { tabId, protocolVersion } = (envelope as SyncEnvelope<'PEER_ACK'>).payload;
        if (!tabId || tabId === this.tabId) return;

        const isNew = !this.activePeers.has(tabId);
        const existing = this.activePeers.get(tabId);
        if (existing) {
          (existing as any).lastSeen = Date.now();
        } else {
          this.activePeers.set(tabId, {
            tabId,
            protocolVersion,
            lastSeen: Date.now(),
          });
        }

        if (isNew) {
          this.emit('peer-change', this.peers);
        }
        break;
      }

      case 'PEER_LEAVE': {
        const { tabId } = (envelope as SyncEnvelope<'PEER_LEAVE'>).payload;
        if (tabId && this.activePeers.has(tabId)) {
          this.activePeers.delete(tabId);
          this.emit('peer-change', this.peers);
        }
        break;
      }

      case 'STATE_REQUEST': {
        const { requestId } = (envelope as SyncEnvelope<'STATE_REQUEST'>).payload;
        // Reply with snapshot addressed directly to the requester
        if (this.signals.size > 0) {
          this.channel.send(
            'STATE_SNAPSHOT',
            {
              requestId,
              snapshot: { signals: this.knownSignals },
            },
            envelope.senderTabId,
          );
        }
        break;
      }

      case 'STATE_SNAPSHOT': {
        const { snapshot } = (envelope as SyncEnvelope<'STATE_SNAPSHOT'>).payload;
        if (Array.isArray(snapshot?.signals)) {
          let updated = false;
          for (const s of snapshot.signals) {
            const key = `${s.signalId}::${s.fragmentId}`;
            const existing = this.signals.get(key);
            if (!existing || s.timestamp > existing.timestamp) {
              this.signals.set(key, s);
              updated = true;
            }
          }
          if (updated) {
            this.emit('signals-updated', this.knownSignals);
          }
        }
        break;
      }

      case 'SIGNAL_DISPATCH': {
        const { signalId, fragmentId, fragmentValue } = (envelope as SyncEnvelope<'SIGNAL_DISPATCH'>).payload;
        const key = `${signalId}::${fragmentId}`;
        const fragment: SignalFragment = {
          signalId,
          fragmentId,
          fragmentValue,
          timestamp: envelope.timestamp,
        };

        const existing = this.signals.get(key);
        if (!existing || envelope.timestamp > existing.timestamp) {
          this.signals.set(key, fragment);
          this.emit('signals-updated', this.knownSignals);
        }
        break;
      }

      case 'SESSION_RESET': {
        const { resetGeneration } = (envelope as SyncEnvelope<'SESSION_RESET'>).payload;
        if (resetGeneration > this.lastAppliedResetGeneration) {
          this.lastAppliedResetGeneration = resetGeneration;
          this.session.syncSessionId();
          this.signals.clear();
          this.activePeers.clear();
          this.emit('session-reset', { newSessionId: this.session.sessionId });
          this.emit('signals-updated', []);
          this.emit('peer-change', []);
        }
        break;
      }
    }
  }
}
