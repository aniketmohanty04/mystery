import { CROSS_TAB_CHANNEL_NAME, CROSS_TAB_STORAGE_KEY } from './constants.js';

export interface ChannelTransport {
  readonly mode: 'broadcast-channel' | 'local-storage';
  postMessage(raw: string): void;
  onMessage(handler: (raw: string) => void): () => void;
  close(): void;
}

export class BroadcastChannelTransport implements ChannelTransport {
  readonly mode = 'broadcast-channel' as const;
  private channel: BroadcastChannel | null = null;
  private readonly listeners = new Set<(raw: string) => void>();
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  constructor(channelName: string = CROSS_TAB_CHANNEL_NAME) {
    if (typeof BroadcastChannel === 'undefined') {
      throw new Error('BroadcastChannel is not supported in this environment');
    }
    this.channel = new BroadcastChannel(channelName);
    this.messageHandler = (event: MessageEvent) => {
      const raw = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
      for (const listener of this.listeners) {
        try {
          listener(raw);
        } catch {
          // Ignore subscriber failures
        }
      }
    };
    this.channel.addEventListener('message', this.messageHandler);
  }

  postMessage(raw: string): void {
    if (!this.channel) return;
    this.channel.postMessage(raw);
  }

  onMessage(handler: (raw: string) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  close(): void {
    if (!this.channel) return;
    if (this.messageHandler) {
      this.channel.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    this.channel.close();
    this.channel = null;
    this.listeners.clear();
  }
}

export class LocalStorageTransport implements ChannelTransport {
  readonly mode = 'local-storage' as const;
  private readonly storageKey: string;
  private readonly listeners = new Set<(raw: string) => void>();
  private storageHandler: ((event: StorageEvent) => void) | null = null;

  constructor(storageKey: string = CROSS_TAB_STORAGE_KEY) {
    this.storageKey = storageKey;
    if (typeof window !== 'undefined') {
      this.storageHandler = (event: StorageEvent) => {
        if (event.key !== this.storageKey || !event.newValue) return;
        try {
          const parsed = JSON.parse(event.newValue);
          const raw = typeof parsed.raw === 'string' ? parsed.raw : JSON.stringify(parsed.raw);
          for (const listener of this.listeners) {
            try {
              listener(raw);
            } catch {
              // Ignore subscriber failures
            }
          }
        } catch {
          // Ignore malformed storage entries
        }
      };
      window.addEventListener('storage', this.storageHandler);
    }
  }

  postMessage(raw: string): void {
    try {
      const envelope = JSON.stringify({
        raw,
        nonce: Math.random().toString(36).substring(2, 9),
        t: Date.now(),
      });
      localStorage.setItem(this.storageKey, envelope);
    } catch {
      // Storage quota or private browsing restriction
    }
  }

  onMessage(handler: (raw: string) => void): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  close(): void {
    if (typeof window !== 'undefined' && this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
      this.storageHandler = null;
    }
    this.listeners.clear();
  }
}

export interface TransportOptions {
  forceMode?: 'broadcast-channel' | 'local-storage';
  channelName?: string;
  storageKey?: string;
}

/**
 * Creates the appropriate transport: uses BroadcastChannel if available,
 * falling back to LocalStorageTransport.
 */
export function createDefaultTransport(options: TransportOptions = {}): ChannelTransport {
  if (options.forceMode === 'local-storage') {
    return new LocalStorageTransport(options.storageKey ?? CROSS_TAB_STORAGE_KEY);
  }
  if (options.forceMode === 'broadcast-channel') {
    return new BroadcastChannelTransport(options.channelName ?? CROSS_TAB_CHANNEL_NAME);
  }

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      return new BroadcastChannelTransport(options.channelName ?? CROSS_TAB_CHANNEL_NAME);
    } catch {
      // Fallback if constructor fails
    }
  }

  return new LocalStorageTransport(options.storageKey ?? CROSS_TAB_STORAGE_KEY);
}
