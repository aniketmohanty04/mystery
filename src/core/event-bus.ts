import type { LayerId } from './types.js';

export interface TransitionPayload {
  from: LayerId;
  to: LayerId | null;
}

interface EventMap {
  transition: TransitionPayload;
}


type EventHandler<T> = (payload: T) => void;

/**
 * Lightweight typed pub/sub event bus. Each StateMachineImpl owns its own
 * instance, so separate machines (for example in tests) never hear each
 * other's events.
 */
export class TypedEventBus {
  private readonly listeners = new Map<string, Set<EventHandler<unknown>>>();

  on<K extends keyof EventMap>(
    event: K,
    handler: EventHandler<EventMap[K]>,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const handlers = this.listeners.get(event)!;
    handlers.add(handler as EventHandler<unknown>);
    // Return an unsubscribe function so callers can clean up.
    return () => handlers.delete(handler as EventHandler<unknown>);
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
    this.listeners.get(event)?.forEach(handler => {
      (handler as EventHandler<EventMap[K]>)(payload);
    });
  }
}

