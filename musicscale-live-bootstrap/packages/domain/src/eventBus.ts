import type { LiveEvent } from './types';

export type LiveEventHandler<TPayload = Record<string, unknown>> = (
  event: LiveEvent<TPayload>
) => void | Promise<void>;

export class LiveEventBus {
  private readonly handlers = new Map<string, Set<LiveEventHandler>>();

  on<TPayload = Record<string, unknown>>(
    type: string,
    handler: LiveEventHandler<TPayload>
  ): () => void {
    const group = this.handlers.get(type) ?? new Set<LiveEventHandler>();
    group.add(handler as LiveEventHandler);
    this.handlers.set(type, group);

    return () => {
      group.delete(handler as LiveEventHandler);
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
