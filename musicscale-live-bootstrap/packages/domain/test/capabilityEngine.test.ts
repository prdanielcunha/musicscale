import { describe, expect, it } from 'vitest';
import { CapabilityEngine } from '../src/capabilityEngine';
import type { ProviderAdapter } from '../src/provider';

const adapter: ProviderAdapter = {
  descriptor: {
    id: 'provider-1',
    nodeId: 'node-1',
    kind: 'presentation',
    displayName: 'Test Presentation',
    providerKey: 'test'
  },
  async probe() {
    return {
      reachable: true,
      capabilities: ['presentation.navigation']
    };
  },
  capabilities() {
    return new Set(['presentation.navigation']);
  },
  async getState() {
    return { health: 'online', updatedAt: new Date(0).toISOString(), observed: {} };
  },
  async execute(command) {
    return {
      commandId: command.id,
      providerInstanceId: 'provider-1',
      accepted: true,
      latencyMs: 1
    };
  }
};

describe('CapabilityEngine', () => {
  it('only exposes capabilities declared by the adapter', () => {
    const engine = new CapabilityEngine();
    engine.register(adapter);
    expect(engine.can('provider-1', 'presentation.navigation')).toBe(true);
    expect(engine.can('provider-1', 'bible.search')).toBe(false);
  });

  it('returns cached provider health without awaiting getState', () => {
    const engine = new CapabilityEngine();
    const cachedAdapter: ProviderAdapter = {
      ...adapter,
      descriptor: { ...adapter.descriptor, id: 'provider-cached' },
      peekState() {
        return {
          health: 'degraded',
          updatedAt: new Date(0).toISOString(),
          observed: { reason: 'provider_offline' }
        };
      },
      async getState() {
        throw new Error('network_should_not_be_called');
      }
    };

    engine.register(cachedAdapter);
    const snapshot = engine.quickSnapshot();

    expect(snapshot[0]?.health).toBe('degraded');
    expect(snapshot[0]?.observed?.reason).toBe('provider_offline');
  });

  it('prevents duplicate provider ids', () => {
    const engine = new CapabilityEngine();
    engine.register(adapter);
    expect(() => engine.register(adapter)).toThrow('provider_already_registered');
  });
});
