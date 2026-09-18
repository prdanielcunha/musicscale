import type {
  Capability,
  LiveCommand,
  CommandResult,
  ProviderDescriptor,
  ProviderState
} from './types';

export interface ProviderProbeResult {
  reachable: boolean;
  version?: string;
  capabilities: Capability[];
  reason?: string;
}

export interface ProviderAdapter {
  readonly descriptor: ProviderDescriptor;

  probe(): Promise<ProviderProbeResult>;
  capabilities(): ReadonlySet<Capability>;
  getState(): Promise<ProviderState>;
  execute(command: LiveCommand): Promise<CommandResult>;
  dispose?(): Promise<void>;
}
