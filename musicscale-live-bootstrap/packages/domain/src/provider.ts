import type {
  Capability,
  LiveCommand,
  CommandResult,
  ProviderDescriptor,
  ProviderState
} from './types';

export interface ProviderAssetRequest {
  kind: 'output.snapshot';
  targetId: string;
  format?: 'jpeg' | 'png';
}

export interface ProviderAsset {
  contentType: string;
  body: Uint8Array;
  cacheControl?: string;
}

export interface ProviderProbeResult {
  reachable: boolean;
  version?: string;
  capabilities: Capability[];
  reason?: string;
}

export interface ProviderAdapter {
  readonly descriptor: ProviderDescriptor;
  readonly observationIntervalMs?: number;

  probe(): Promise<ProviderProbeResult>;
  capabilities(): ReadonlySet<Capability>;
  getState(): Promise<ProviderState>;
  peekState?(): ProviderState;
  execute(command: LiveCommand): Promise<CommandResult>;
  fetchAsset?(request: ProviderAssetRequest): Promise<ProviderAsset>;
  dispose?(): Promise<void>;
}
