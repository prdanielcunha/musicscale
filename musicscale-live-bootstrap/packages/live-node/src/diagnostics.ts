import type {
  CapabilitySnapshot,
  LiveNodeRuntimeState
} from '@musicscale-live/domain';

export interface LiveNodeDiagnosticInput {
  nodeId: string;
  version: string;
  hostname: string;
  platform: NodeJS.Platform;
  arch: string;
  nodeVersion: string;
  port: number;
  lanAddresses: string[];
  webAppPresent: boolean;
  pairingEnabled: boolean;
  pairedDevices: number;
  runtime: LiveNodeRuntimeState;
  providers: CapabilitySnapshot[];
  holyrics: {
    configured: boolean;
    source: 'environment' | 'local' | 'none';
    baseUrl: string;
  };
}

export function buildLiveNodeDiagnostics(input: LiveNodeDiagnosticInput) {
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    product: 'MusicScale Live Node',
    node: {
      id: input.nodeId,
      version: input.version,
      hostname: input.hostname,
      platform: input.platform,
      arch: input.arch,
      nodeVersion: input.nodeVersion,
      port: input.port,
      lanAddresses: input.lanAddresses,
      webAppPresent: input.webAppPresent
    },
    pairing: {
      enabled: input.pairingEnabled,
      pairedDevices: input.pairedDevices
    },
    runtime: {
      revision: input.runtime.revision,
      updatedAt: input.runtime.updatedAt,
      activeLiveSessionId: input.runtime.activeLiveSessionId,
      activeServiceItemId: input.runtime.activeServiceItemId,
      servicePlanId: input.runtime.servicePlan?.id || null,
      servicePlanItems: input.runtime.servicePlan?.items.length || 0,
      providerLinks: input.runtime.providerLinks.length
    },
    providers: input.providers.map(provider => ({
      providerId: provider.providerId,
      health: provider.health,
      capabilities: provider.capabilities
    })),
    holyrics: {
      configured: input.holyrics.configured,
      source: input.holyrics.source,
      baseUrl: input.holyrics.baseUrl
    },
    security: {
      providerSecretsIncluded: false,
      cloudRelayEnabled: false
    }
  };
}
