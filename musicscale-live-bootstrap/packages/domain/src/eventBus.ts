import type { LiveEvent } from './types';

export type LiveEventHandler<TPayload = Record<string, unknown>> = (
  event: LiveEvent<TPayload>
) => void | Promise<void>;

type AnyHandler = LiveEventHandler<any>;

export class LiveEventBus {
  private readonly handlers = new Map<string, Set<AnyHandler>>();

  on<TPayload = Record<string, unknown>>(
    type: string,
    handler: LiveEventHandler<TPayload>
  ): () => void {
    const group = this.handlers.get(type) ?? new Set<AnyHandler>();
    group.add(handler as AnyHandler);
    this.handlers.set(type, group);

    return () => {
      group.delete(handler as AnyHandler);
      if (group.size === 0) this.handlers.delete(type);
    };
  }

  async emit<TPayload = Record<string, unknown>>(
    event: LiveEvent<TPayload>
  ): Promise<void> {
    const direct = [...(this.handlers.get(event.type) ?? [])];
    const wildcard = [...(this.handlers.get('*') ?? [])];
    await Promise.all([...direct, ...wildcard].map(handler => handler(event)));
  }
}
