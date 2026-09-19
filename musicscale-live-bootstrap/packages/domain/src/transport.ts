import type { ProviderLink, Scene, ServicePlan } from './types';

export type LiveNodeTransportKind = 'direct-lan' | 'local-console' | 'cloud-relay';

export type LiveNodeConnectionState =
  | 'unconfigured'
  | 'probing'
  | 'pairing'
  | 'connected'
  | 'degraded'
  | 'reconnecting'
  | 'offline'
  | 'blocked';

export interface LiveNodeHealth {
  product: 'MusicScale Live Node';
  version: string;
  nodeId: string;
  hostname: string;
  health: 'online' | 'degraded';
  lanAddresses: string[];
  providers: number;
  providersOnline: number;
  now: string;
  pairing: {
    pairedDevices: number;
    pairingEnabled: boolean;
  };
}

export interface PairingScope {
  organizationId: string;
  venueId: string;
  liveSystemId: string;
}

export interface PairingDevice {
  deviceId: string;
  deviceName: string;
}

export interface PairingRequest extends PairingDevice {
  organizationId?: string;
  venueId?: string;
  liveSystemId?: string;
}

export interface PairingChallenge {
  challengeId: string;
  nodeId: string;
  expiresAt: string;
  method: 'pin';
  displayedOnNode: true;
}

export interface PairingCompleteRequest {
  challengeId: string;
  pin: string;
  deviceId: string;
  deviceName: string;
}

export interface PairingBinding extends PairingScope, PairingDevice {
  nodeId: string;
  pairedAt: string;
  lastSeenAt: string;
}

export interface PairingCompleteResponse {
  nodeId: string;
  token: string;
  binding: PairingBinding;
}

export interface LiveNodeRuntimeState {
  revision: number;
  nodeId: string;
  updatedAt: string;
  activeLiveSessionId: string | null;
  activeServiceItemId: string | null;
  providerObservedState: Record<string, Record<string, unknown>>;
  servicePlan: ServicePlan | null;
  providerLinks: ProviderLink[];
  requests: import('./types').LiveRequest[];
  scenes: Scene[];
}
