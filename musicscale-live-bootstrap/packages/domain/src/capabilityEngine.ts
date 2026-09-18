import type { Capability, CapabilitySnapshot } from './types';
import type { ProviderAdapter } from './provider';

export class CapabilityEngine {
  private readonly providers = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    if (this.providers.has(adapter.descriptor.id)) {
      throw new Error(`provider_already_registered:${adapter.descriptor.id}`);
    }
    this.providers.set(adapter.descriptor.id, adapter);
  }

  unregister(providerId: string): void {
    this.providers.delete(providerId);
  }

  get(providerId: string): ProviderAdapter | undefined {
    return this.providers.get(providerId);
  }

  can(providerId: string, capability: Capability): boolean {
    return this.providers.get(providerId)?.capabilities().has(capability) ?? false;
  }

  targetsFor(capability: Capability): ProviderAdapter[] {
    return [...this.providers.values()].filter(provider =>
      provider.capabilities().has(capability)
    );
  }

  async snapshot(): Promise<CapabilitySnapshot[]> {
    return Promise.all(
      [...this.providers.values()].map(async provider => {
        const state = await provider.getState();
        return {
          providerId: provider.descriptor.id,
          capabilities: [...provider.capabilities()],
          health: state.health,
          observed: state.observed
        };
      })
    );
  }
}
