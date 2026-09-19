export const CAPABILITIES = [
  'presentation.slides.read',
  'presentation.navigation',
  'presentation.preview',
  'presentation.take',
  'presentation.clear',
  'presentation.screen.mode',
  'bible.search',
  'bible.present',
  'songs.search',
  'songs.present',
  'playlist.write',
  'playlist.sync',
  'media.search',
  'media.open',
  'preview.snapshot',
  'stage.message',
  'visual.composition.read',
  'visual.clip.trigger',
  'visual.layer.clear',
  'visual.composition.clear',
  'visual.outputs.read',
  'visual.output.snapshot',
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
  organizationId: string;
  venueId: string;
  liveSystemId: string;
  liveSessionId: string;
  serviceItemId?: string;
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
  observed?: Record<string, unknown>;
}


export type EntityId = string;

export interface Venue {
  id: EntityId;
  organizationId: EntityId;
  name: string;
  timeZone: string;
  active: boolean;
}

export interface LiveSystem {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  name: string;
  activeProfileId?: EntityId | null;
}

export interface LiveNodeRecord {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  liveSystemId: EntityId;
  displayName: string;
  platform: 'windows' | 'macos' | 'linux' | 'unknown';
  status: ProviderHealth;
  lastSeenAt?: string | null;
  pairedAt?: string | null;
}

export interface ProviderInstance {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  liveSystemId: EntityId;
  nodeId: EntityId;
  providerKey: string;
  displayName: string;
  kinds: ProviderKind[];
  version?: string;
  capabilities: Capability[];
  health: ProviderHealth;
}

export type OutputTargetKind =
  | 'main'
  | 'stage'
  | 'confidence'
  | 'broadcast'
  | 'foyer'
  | 'side_left'
  | 'side_right'
  | 'recording'
  | 'custom';

export interface OutputTarget {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  liveSystemId: EntityId;
  kind: OutputTargetKind;
  name: string;
  active: boolean;
}

export type RouteContentType =
  | 'lyrics'
  | 'bible'
  | 'announcements'
  | 'media'
  | 'stage'
  | 'broadcast'
  | 'custom';

export interface Route {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  liveSystemId: EntityId;
  name: string;
  contentTypes: RouteContentType[];
  sourceProviderIds: EntityId[];
  processorProviderIds: EntityId[];
  outputTargetIds: EntityId[];
  enabled: boolean;
}

export interface LiveProfile {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  liveSystemId: EntityId;
  name: string;
  routeIds: EntityId[];
  outputTargetIds: EntityId[];
  providerInstanceIds: EntityId[];
}

export type ServiceItemType =
  | 'song'
  | 'bible'
  | 'video'
  | 'image'
  | 'audio'
  | 'text'
  | 'announcement'
  | 'presentation'
  | 'action'
  | 'macro'
  | 'scene'
  | 'custom';

export type ServiceItemState =
  | 'planned'
  | 'prepared'
  | 'live'
  | 'completed'
  | 'skipped'
  | 'warning'
  | 'error';

export interface ServiceItem {
  id: EntityId;
  type: ServiceItemType;
  title: string;
  plannedDurationSeconds?: number;
  plannedStartAt?: string;
  responsibleUserId?: EntityId;
  sourceEntityId?: EntityId;
  providerLinkId?: EntityId;
  state: ServiceItemState;
  payload?: Record<string, unknown>;
}

export interface ServicePlan {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  liveSystemId: EntityId;
  sourceMusicScaleId?: EntityId;
  title: string;
  scheduledAt: string;
  profileId?: EntityId;
  items: ServiceItem[];
  revision: number;
}

export interface LiveSession {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  liveSystemId: EntityId;
  servicePlanId: EntityId;
  startedAt: string;
  endedAt?: string;
  status: 'preflight' | 'live' | 'ended' | 'aborted';
  activeServiceItemId?: EntityId | null;
}

export interface ProviderLink {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  providerInstanceId: EntityId;
  entityType: string;
  musicScaleEntityId?: EntityId;
  externalId: string;
  fingerprint?: string;
  lastVerifiedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SceneAction {
  id: EntityId;
  capability: Capability;
  targetProviderIds: EntityId[];
  outputTargets: EntityId[];
  payload: Record<string, unknown>;
  safetyLevel: SafetyLevel;
  /**
   * Relative delay from the scene start. Allows tightly coordinated provider
   * transitions without leaking provider-specific sequencing into the domain.
   */
  offsetMs?: number;
}

export interface Scene {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  liveSystemId?: EntityId;
  name: string;
  actions: SceneAction[];
}

export interface SceneExecutionRequest {
  id: EntityId;
  correlationId: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  liveSystemId: EntityId;
  liveSessionId: EntityId;
  serviceItemId?: EntityId;
  actorId: EntityId;
  origin: CommandOrigin;
  scene: Scene;
  idempotencyKey: string;
}

export interface SceneActionExecutionResult {
  actionId: EntityId;
  offsetMs: number;
  results: CommandResult[];
}

export interface SceneExecutionResult {
  sceneId: EntityId;
  correlationId: EntityId;
  status: 'completed' | 'partial' | 'failed';
  startedAt: string;
  completedAt: string;
  actions: SceneActionExecutionResult[];
}

export interface AutomationRule {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  name: string;
  enabled: boolean;
  trigger: string;
  conditions: Array<Record<string, unknown>>;
  actions: SceneAction[];
}

export interface MediaAsset {
  id: EntityId;
  organizationId: EntityId;
  venueId?: EntityId;
  name: string;
  mediaType: 'image' | 'video' | 'audio' | 'pdf' | 'presentation' | 'other';
  locations: Array<{
    kind: 'cloud' | 'node' | 'provider';
    ref: string;
  }>;
}

export type RequestKind = 'bible' | 'section' | 'media' | 'message';

export interface LiveRequest {
  id: EntityId;
  organizationId: EntityId;
  venueId: EntityId;
  liveSessionId: EntityId;
  actorId: EntityId;
  kind: RequestKind;
  payload: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  resolvedBy?: EntityId;
}
