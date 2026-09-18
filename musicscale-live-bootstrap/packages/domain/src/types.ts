export const CAPABILITIES = [
  'presentation.slides.read',
  'presentation.navigation',
  'presentation.preview',
  'presentation.take',
  'presentation.clear',
  'bible.search',
  'bible.present',
  'songs.search',
  'playlist.write',
  'media.search',
  'media.open',
  'preview.snapshot',
  'stage.message',
  'audio.route.read',
  'audio.route.write',
  'automation.trigger'
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export type ProviderKind =
  | 'presentation'
  | 'bible'
  | 'visual'
  | 'broadcast'
  | 'stage'
  | 'audio'
  | 'control';

export type ProviderHealth = 'online' | 'degraded' | 'reconnecting' | 'offline' | 'manual';

export type SafetyLevel = 'normal' | 'guarded' | 'critical';

export type CommandOrigin =
  | 'live-ui'
  | 'pastor'
  | 'conductor'
  | 'automation'
  | 'api';

export interface ProviderDescriptor {
  id: string;
  nodeId: string;
  kind: ProviderKind;
  displayName: string;
  providerKey: string;
  version?: string;
}

export interface ProviderState {
  health: ProviderHealth;
  updatedAt: string;
  observed: Record<string, unknown>;
}

export interface LiveCommand<TPayload = Record<string, unknown>> {
  id: string;
  correlationId: string;
  liveSessionId: string;
  actorId: string;
  origin: CommandOrigin;
  capability: Capability;
  targetProviderIds: string[];
  outputTargets: string[];
  payload: TPayload;
  idempotencyKey: string;
  createdAt: string;
  safetyLevel: SafetyLevel;
}

export interface CommandResult {
  commandId: string;
  providerInstanceId: string;
  accepted: boolean;
  observedState?: Record<string, unknown>;
  latencyMs: number;
  errorCode?: string;
  recoverable?: boolean;
}

export interface LiveEvent<TPayload = Record<string, unknown>> {
  id: string;
  correlationId: string;
  type: string;
  occurredAt: string;
  source: string;
  payload: TPayload;
}

export interface CapabilitySnapshot {
  providerId: string;
  capabilities: Capability[];
  health: ProviderHealth;
}
