import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { homedir, hostname, networkInterfaces } from 'node:os';
import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import {
  CAPABILITIES,
  CapabilityEngine,
  routeGroupForCapability,
  type Capability,
  type CommandResult,
  type LiveCommand,
  type PairingRequest,
  type ProviderAssetRequest,
  type ProviderLink,
  type ProviderRouteGroup,
  type SceneExecutionRequest,
  type SceneExecutionResult,
  type ServicePlan
} from '@musicscale-live/domain';
import { IdempotencyStore } from './idempotencyStore';
import { PairingStore } from './pairingStore';
import { RuntimeStateStore } from './runtimeStateStore';
import { ProviderConfigStore } from './providerConfigStore';
import { ProviderRoutingStore } from './providerRoutingStore';
import { buildLiveNodeDiagnostics } from './diagnostics';
import { isTrustedLiveWebOrigin } from './networkPolicy';
import { SceneExecutor } from './sceneExecutor';
import { sanitizeObservedStateForPersistence } from './observedStateSanitizer';
import { HolyricsAdapter, HolyricsHttpClient } from '@musicscale-live/adapter-holyrics';
import { ResolumeAdapter, ResolumeRestClient } from '@musicscale-live/adapter-resolume';
import {
  ProPresenterAdapter,
  ProPresenterHttpClient
} from '@musicscale-live/adapter-propresenter';
import { toString as qrToString } from 'qrcode';

const PORT = Number(process.env.MUSICSCALE_LIVE_NODE_PORT || 4317);
const HOST = process.env.MUSICSCALE_LIVE_NODE_HOST || '0.0.0.0';
const VERSION = '0.1.0-alpha.1';
const DEV_TOKEN = process.env.MUSICSCALE_LIVE_DEV_TOKEN || '';
const PAIRING_ENABLED = process.env.MUSICSCALE_LIVE_PAIRING_ENABLED !== 'false';
const HOLYRICS_TOKEN = process.env.MUSICSCALE_LIVE_HOLYRICS_TOKEN?.trim() || '';
const HOLYRICS_URL = process.env.MUSICSCALE_LIVE_HOLYRICS_URL?.trim() || 'http://127.0.0.1:8091';
const DEFAULT_RESOLUME_URL = 'http://127.0.0.1:8080';
const RESOLUME_URL = process.env.MUSICSCALE_LIVE_RESOLUME_URL?.trim() || '';
const DEFAULT_PROPRESENTER_URL = '';
const PROPRESENTER_URL = process.env.MUSICSCALE_LIVE_PROPRESENTER_URL?.trim() || '';
const STATE_DIR = process.env.MUSICSCALE_LIVE_STATE_DIR || join(homedir(), '.musicscale-live');
const PACKAGED_WEB_ROOT = resolve(dirname(process.execPath), 'web');
const WORKSPACE_WEB_ROOT = resolve(process.cwd(), 'apps/live/dist');
const PACKAGE_CWD_WEB_ROOT = resolve(process.cwd(), '../../apps/live/dist');
const DEFAULT_WEB_ROOT = [
  PACKAGED_WEB_ROOT,
  WORKSPACE_WEB_ROOT,
  PACKAGE_CWD_WEB_ROOT
].find(candidate => existsSync(join(candidate, 'index.html'))) || PACKAGED_WEB_ROOT;
const WEB_ROOT = resolve(process.env.MUSICSCALE_LIVE_WEB_ROOT || DEFAULT_WEB_ROOT);

const allowedOrigins = new Set(
  (process.env.MUSICSCALE_LIVE_ALLOWED_ORIGINS || 'http://localhost:4316,http://127.0.0.1:4316')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
);

const nodeId = process.env.MUSICSCALE_LIVE_NODE_ID ||
  `node_${createHash('sha256').update(`${hostname()}|musicscale-live`).digest('hex').slice(0, 16)}`;

const capabilityEngine = new CapabilityEngine();
const idempotency = new IdempotencyStore<CommandResult[]>();
const sceneIdempotency = new IdempotencyStore<SceneExecutionResult>();
const pairingStore = new PairingStore(join(STATE_DIR, 'pairings.json'), nodeId);
const runtimeState = new RuntimeStateStore(join(STATE_DIR, 'runtime.json'), nodeId);
const providerConfigStore = new ProviderConfigStore(join(STATE_DIR, 'providers.json'));
const providerRoutingStore = new ProviderRoutingStore(join(STATE_DIR, 'routing.json'));

const pairingRequestHits = new Map<string, number>();

async function registerHolyricsProvider(): Promise<{
  configured: boolean;
  source: 'environment' | 'local' | 'none';
  probe?: Awaited<ReturnType<HolyricsAdapter['probe']>>;
  baseUrl?: string;
}> {
  capabilityEngine.unregister('holyrics-primary');

  const localConfig = await providerConfigStore.getHolyrics();
  const token = HOLYRICS_TOKEN || localConfig?.token || '';
  const baseUrl = HOLYRICS_TOKEN
    ? HOLYRICS_URL
    : localConfig?.baseUrl || HOLYRICS_URL;
  const source = HOLYRICS_TOKEN
    ? 'environment' as const
    : localConfig
      ? 'local' as const
      : 'none' as const;

  if (!token) {
    console.log(JSON.stringify({
      event: 'provider_not_configured',
      providerKey: 'holyrics'
    }));
    return { configured: false, source };
  }

  const adapter = new HolyricsAdapter({
    id: 'holyrics-primary',
    nodeId,
    displayName: 'Holyrics',
    api: new HolyricsHttpClient({
      baseUrl,
      token
    })
  });

  capabilityEngine.register(adapter);
  const probe = await adapter.probe();

  console.log(JSON.stringify({
    event: 'provider_probe',
    providerKey: 'holyrics',
    providerId: adapter.descriptor.id,
    reachable: probe.reachable,
    version: probe.version || null,
    capabilities: probe.capabilities,
    reason: probe.reason || null,
    configurationSource: source
  }));

  return {
    configured: true,
    source,
    probe,
    baseUrl
  };
}


async function registerResolumeProvider(): Promise<{
  configured: boolean;
  source: 'environment' | 'local' | 'none';
  probe?: Awaited<ReturnType<ResolumeAdapter['probe']>>;
  baseUrl?: string;
}> {
  capabilityEngine.unregister('resolume-primary');

  const localConfig = await providerConfigStore.getResolume();
  const baseUrl = RESOLUME_URL || localConfig?.baseUrl || '';
  const source = RESOLUME_URL
    ? 'environment' as const
    : localConfig
      ? 'local' as const
      : 'none' as const;

  if (!baseUrl) {
    console.log(JSON.stringify({
      event: 'provider_not_configured',
      providerKey: 'resolume'
    }));
    return { configured: false, source };
  }

  const adapter = new ResolumeAdapter({
    id: 'resolume-primary',
    nodeId,
    displayName: 'Resolume Arena',
    api: new ResolumeRestClient({ baseUrl })
  });

  capabilityEngine.register(adapter);
  const probe = await adapter.probe();

  console.log(JSON.stringify({
    event: 'provider_probe',
    providerKey: 'resolume',
    providerId: adapter.descriptor.id,
    reachable: probe.reachable,
    version: probe.version || null,
    capabilities: probe.capabilities,
    reason: probe.reason || null,
    configurationSource: source
  }));

  return {
    configured: true,
    source,
    probe,
    baseUrl
  };
}


async function registerProPresenterProvider(): Promise<{
  configured: boolean;
  source: 'environment' | 'local' | 'none';
  probe?: Awaited<ReturnType<ProPresenterAdapter['probe']>>;
  baseUrl?: string;
}> {
  capabilityEngine.unregister('propresenter-primary');

  const localConfig = await providerConfigStore.getProPresenter();
  const baseUrl = PROPRESENTER_URL || localConfig?.baseUrl || '';
  const source = PROPRESENTER_URL
    ? 'environment' as const
    : localConfig
      ? 'local' as const
      : 'none' as const;

  if (!baseUrl) {
    console.log(JSON.stringify({
      event: 'provider_not_configured',
      providerKey: 'propresenter'
    }));
    return { configured: false, source };
  }

  const adapter = new ProPresenterAdapter({
    id: 'propresenter-primary',
    nodeId,
    displayName: 'ProPresenter',
    api: new ProPresenterHttpClient({ baseUrl })
  });

  capabilityEngine.register(adapter);
  const probe = await adapter.probe();

  console.log(JSON.stringify({
    event: 'provider_probe',
    providerKey: 'propresenter',
    providerId: adapter.descriptor.id,
    reachable: probe.reachable,
    version: probe.version || null,
    capabilities: probe.capabilities,
    reason: probe.reason || null,
    configurationSource: source
  }));

  return {
    configured: true,
    source,
    probe,
    baseUrl
  };
}

let providerObservationBusy = false;

async function observeOnlineProviders(): Promise<void> {
  if (providerObservationBusy) return;
  providerObservationBusy = true;
  try {
    const online = capabilityEngine
      .quickSnapshot()
      .filter(provider => provider.health === 'online');

    if (!online.length) return;

    const current = await runtimeState.load();
    const observed = { ...current.providerObservedState };
    let changed = false;

    for (const snapshot of online) {
      const provider = capabilityEngine.get(snapshot.providerId);
      if (!provider) continue;
      try {
        const state = await provider.getState();
        const previousJson = JSON.stringify(observed[snapshot.providerId] || {});
        const nextJson = JSON.stringify(state.observed || {});
        if (previousJson !== nextJson) {
          observed[snapshot.providerId] = {
            ...(observed[snapshot.providerId] || {}),
            ...sanitizeObservedStateForPersistence(state.observed || {})
          };
          changed = true;
        }
      } catch {
        // Provider adapters own their degraded/offline transition semantics.
      }
    }

    if (changed) {
      await runtimeState.patch({ providerObservedState: observed });
    }
  } finally {
    providerObservationBusy = false;
  }
}

async function recoverUnhealthyProviders(): Promise<void> {
  const unhealthy = capabilityEngine
    .quickSnapshot()
    .filter(provider => provider.health !== 'online');

  for (const snapshot of unhealthy) {
    const provider = capabilityEngine.get(snapshot.providerId);
    if (!provider) continue;
    try {
      const probe = await provider.probe();
      if (probe.reachable) {
        console.log(JSON.stringify({
          event: 'provider_recovered',
          providerId: snapshot.providerId,
          capabilities: probe.capabilities
        }));
      }
    } catch (error) {
      console.log(JSON.stringify({
        event: 'provider_recovery_waiting',
        providerId: snapshot.providerId,
        error: error instanceof Error ? error.message : 'unknown'
      }));
    }
  }
}

function lanAddresses(): string[] {
  const addresses: string[] = [];
  for (const group of Object.values(networkInterfaces())) {
    for (const entry of group || []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  return [...new Set(addresses)];
}

function setCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (origin && isTrustedLiveWebOrigin(origin, allowedOrigins)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader(
    'Access-Control-Allow-Headers',
    'authorization,content-type,x-correlation-id,x-live-confirmation'
  );
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function sendBinary(
  res: ServerResponse,
  status: number,
  contentType: string,
  body: Uint8Array,
  cacheControl = 'no-store'
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', cacheControl);
  res.end(Buffer.from(body));
}

function sendSvg(res: ServerResponse, status: number, svg: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(svg);
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'");
  res.end(html);
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 256 * 1024) throw new Error('payload_too_large');
    chunks.push(buffer);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function bearerToken(req: IncomingMessage): string {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

function isLoopback(req: IncomingMessage): boolean {
  const remote = req.socket.remoteAddress || '';
  return remote === '127.0.0.1' || remote === '::1' || remote === '::ffff:127.0.0.1';
}

function clientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress || 'unknown';
}

function pairingRateLimited(req: IncomingMessage): boolean {
  const ip = clientIp(req);
  const now = Date.now();
  const previous = pairingRequestHits.get(ip) || 0;
  if (now - previous < 2_000) return true;
  pairingRequestHits.set(ip, now);
  if (pairingRequestHits.size > 200) {
    for (const [key, timestamp] of pairingRequestHits) {
      if (now - timestamp > 10 * 60_000) pairingRequestHits.delete(key);
    }
  }
  return false;
}

function requireStrings(
  value: Record<string, unknown>,
  fields: string[],
  code = 'invalid_request'
): void {
  for (const field of fields) {
    if (typeof value[field] !== 'string' || !String(value[field]).trim()) {
      throw new Error(code);
    }
  }
}

function validatePairingRequest(value: unknown): PairingRequest {
  if (!value || typeof value !== 'object') throw new Error('invalid_pairing_request');
  const candidate = value as Record<string, unknown>;
  requireStrings(
    candidate,
    ['deviceId', 'deviceName'],
    'invalid_pairing_request'
  );

  const scopeValues = [
    candidate.organizationId,
    candidate.venueId,
    candidate.liveSystemId
  ];
  const scopeCount = scopeValues.filter(
    value => typeof value === 'string' && String(value).trim()
  ).length;

  if (scopeCount !== 0 && scopeCount !== 3) {
    throw new Error('invalid_pairing_scope');
  }

  return {
    organizationId: scopeCount === 3 ? String(candidate.organizationId) : undefined,
    venueId: scopeCount === 3 ? String(candidate.venueId) : undefined,
    liveSystemId: scopeCount === 3 ? String(candidate.liveSystemId) : undefined,
    deviceId: String(candidate.deviceId),
    deviceName: String(candidate.deviceName)
  };
}

function validateServicePlan(value: unknown): ServicePlan {
  if (!value || typeof value !== 'object') throw new Error('invalid_service_plan');
  const candidate = value as Partial<ServicePlan>;
  const requiredStrings = [
    candidate.id,
    candidate.organizationId,
    candidate.venueId,
    candidate.liveSystemId,
    candidate.title,
    candidate.scheduledAt
  ];
  if (requiredStrings.some(item => typeof item !== 'string' || !item)) {
    throw new Error('invalid_service_plan');
  }
  if (!Array.isArray(candidate.items)) throw new Error('invalid_service_plan');
  if (!Number.isInteger(candidate.revision) || Number(candidate.revision) < 1) {
    throw new Error('invalid_service_plan_revision');
  }
  return candidate as ServicePlan;
}

function validateProviderLinks(value: unknown): ProviderLink[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('invalid_provider_links');

  return value.map(item => {
    if (!item || typeof item !== 'object') throw new Error('invalid_provider_link');
    const link = item as Partial<ProviderLink>;
    const requiredStrings = [
      link.id,
      link.organizationId,
      link.venueId,
      link.providerInstanceId,
      link.entityType,
      link.externalId
    ];
    if (requiredStrings.some(field => typeof field !== 'string' || !field)) {
      throw new Error('invalid_provider_link');
    }
    if (!capabilityEngine.get(String(link.providerInstanceId))) {
      throw new Error('provider_link_target_missing');
    }
    return link as ProviderLink;
  });
}

function assertProviderLinksScope(
  links: ProviderLink[],
  binding: Awaited<ReturnType<typeof pairingStore.authorize>>
): void {
  if (!binding) return;
  for (const link of links) {
    if (
      link.organizationId !== binding.organizationId ||
      link.venueId !== binding.venueId
    ) {
      throw new Error('forbidden_scope');
    }
  }
}

function assertServicePlanScope(
  plan: ServicePlan,
  binding: Awaited<ReturnType<typeof pairingStore.authorize>>
): void {
  if (!binding) return;
  if (
    plan.organizationId !== binding.organizationId ||
    plan.venueId !== binding.venueId ||
    plan.liveSystemId !== binding.liveSystemId
  ) {
    throw new Error('forbidden_scope');
  }
}

function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && (CAPABILITIES as readonly string[]).includes(value);
}

function validateSceneExecutionRequest(value: unknown): SceneExecutionRequest {
  if (!value || typeof value !== 'object') throw new Error('invalid_scene_execution');
  const candidate = value as Partial<SceneExecutionRequest>;
  const requiredStrings = [
    candidate.id,
    candidate.correlationId,
    candidate.organizationId,
    candidate.venueId,
    candidate.liveSystemId,
    candidate.liveSessionId,
    candidate.actorId,
    candidate.idempotencyKey
  ];
  if (requiredStrings.some(item => typeof item !== 'string' || !item)) {
    throw new Error('invalid_scene_execution');
  }
  if (!['live-ui','pastor','conductor','automation','api'].includes(String(candidate.origin))) {
    throw new Error('invalid_origin');
  }

  const scene = candidate.scene;
  if (!scene || typeof scene !== 'object') throw new Error('invalid_scene');
  if (
    typeof scene.id !== 'string' ||
    !scene.id ||
    typeof scene.organizationId !== 'string' ||
    typeof scene.venueId !== 'string' ||
    typeof scene.name !== 'string' ||
    !Array.isArray(scene.actions) ||
    scene.actions.length < 1 ||
    scene.actions.length > 32
  ) {
    throw new Error('invalid_scene');
  }
  if (
    scene.organizationId !== candidate.organizationId ||
    scene.venueId !== candidate.venueId ||
    (scene.liveSystemId && scene.liveSystemId !== candidate.liveSystemId)
  ) {
    throw new Error('forbidden_scope');
  }

  const actionIds = new Set<string>();
  for (const action of scene.actions) {
    if (!action || typeof action !== 'object') throw new Error('invalid_scene_action');
    if (typeof action.id !== 'string' || !action.id || actionIds.has(action.id)) {
      throw new Error('invalid_scene_action');
    }
    actionIds.add(action.id);
    if (!isCapability(action.capability)) throw new Error('invalid_capability');
    if (!Array.isArray(action.targetProviderIds) || !Array.isArray(action.outputTargets)) {
      throw new Error('invalid_targets');
    }
    if (!action.payload || typeof action.payload !== 'object' || Array.isArray(action.payload)) {
      throw new Error('invalid_scene_action');
    }
    if (!['normal','guarded','critical'].includes(String(action.safetyLevel))) {
      throw new Error('invalid_safety_level');
    }
    if (
      action.offsetMs != null &&
      (!Number.isFinite(action.offsetMs) || Number(action.offsetMs) < 0 || Number(action.offsetMs) > 60_000)
    ) {
      throw new Error('invalid_scene_offset');
    }
  }

  return candidate as SceneExecutionRequest;
}

function validateCommand(value: unknown): LiveCommand {
  if (!value || typeof value !== 'object') throw new Error('invalid_command');
  const candidate = value as Partial<LiveCommand>;
  const requiredStrings = [
    candidate.id,
    candidate.correlationId,
    candidate.organizationId,
    candidate.venueId,
    candidate.liveSystemId,
    candidate.liveSessionId,
    candidate.actorId,
    candidate.idempotencyKey,
    candidate.createdAt
  ];
  if (requiredStrings.some(item => typeof item !== 'string' || !item)) {
    throw new Error('invalid_command');
  }
  if (!isCapability(candidate.capability)) throw new Error('invalid_capability');
  if (!Array.isArray(candidate.targetProviderIds) || !Array.isArray(candidate.outputTargets)) {
    throw new Error('invalid_targets');
  }
  if (!['live-ui','pastor','conductor','automation','api'].includes(String(candidate.origin))) {
    throw new Error('invalid_origin');
  }
  if (!['normal','guarded','critical'].includes(String(candidate.safetyLevel))) {
    throw new Error('invalid_safety_level');
  }
  return candidate as LiveCommand;
}

async function authorize(req: IncomingMessage) {
  const token = bearerToken(req);
  if (DEV_TOKEN && token === DEV_TOKEN) {
    return { dev: true as const, token, binding: null };
  }
  const binding = await pairingStore.authorize(token);
  return binding ? { dev: false as const, token, binding } : null;
}

function assertSceneScope(
  request: SceneExecutionRequest,
  binding: Awaited<ReturnType<typeof pairingStore.authorize>>
): void {
  if (!binding) return;
  if (
    request.organizationId !== binding.organizationId ||
    request.venueId !== binding.venueId ||
    request.liveSystemId !== binding.liveSystemId
  ) {
    throw new Error('forbidden_scope');
  }
}

function assertCommandScope(
  command: LiveCommand,
  binding: Awaited<ReturnType<typeof pairingStore.authorize>>
): void {
  if (!binding) return;
  if (
    command.organizationId !== binding.organizationId ||
    command.venueId !== binding.venueId ||
    command.liveSystemId !== binding.liveSystemId
  ) {
    throw new Error('forbidden_scope');
  }
}

async function execute(command: LiveCommand): Promise<CommandResult[]> {
  const cached = idempotency.get(command.idempotencyKey);
  if (cached) return cached;

  let targets = command.targetProviderIds.length
    ? command.targetProviderIds
        .map(id => capabilityEngine.get(id))
        .filter((provider): provider is NonNullable<typeof provider> => Boolean(provider))
    : [];

  if (!command.targetProviderIds.length) {
    const candidates = capabilityEngine.targetsFor(command.capability);
    const routeGroup = routeGroupForCapability(command.capability);
    const preferredProviderId = await providerRoutingStore.get(routeGroup);

    if (preferredProviderId) {
      const preferred = capabilityEngine.get(preferredProviderId);
      if (preferred?.capabilities().has(command.capability)) {
        targets = [preferred];
      } else {
        const result: CommandResult[] = [{
          commandId: command.id,
          providerInstanceId: preferredProviderId,
          accepted: false,
          latencyMs: 0,
          errorCode: 'configured_provider_route_unavailable',
          recoverable: true
        }];
        idempotency.set(command.idempotencyKey, result);
        return result;
      }
    } else if (candidates.length === 1) {
      targets = candidates;
    } else if (candidates.length > 1) {
      const result: CommandResult[] = [{
        commandId: command.id,
        providerInstanceId: 'ambiguous',
        accepted: false,
        latencyMs: 0,
        errorCode: 'ambiguous_provider_route',
        recoverable: true
      }];
      idempotency.set(command.idempotencyKey, result);
      return result;
    }
  }

  if (!targets.length) {
    const result: CommandResult[] = [{
      commandId: command.id,
      providerInstanceId: 'none',
      accepted: false,
      latencyMs: 0,
      errorCode: 'no_provider_for_capability',
      recoverable: true
    }];
    idempotency.set(command.idempotencyKey, result);
    return result;
  }

  const results = await Promise.all(targets.map(async provider => {
    if (!provider.capabilities().has(command.capability)) {
      return {
        commandId: command.id,
        providerInstanceId: provider.descriptor.id,
        accepted: false,
        latencyMs: 0,
        errorCode: 'capability_not_supported',
        recoverable: true
      } satisfies CommandResult;
    }
    return provider.execute(command);
  }));

  const current = await runtimeState.load();
  const providerObservedState = { ...current.providerObservedState };
  for (const result of results) {
    if (result.accepted && result.observedState) {
      providerObservedState[result.providerInstanceId] = {
        ...(providerObservedState[result.providerInstanceId] || {}),
        ...sanitizeObservedStateForPersistence(result.observedState)
      };
    }
  }
  const anyAccepted = results.some(result => result.accepted);
  const nextServicePlan =
    anyAccepted && command.serviceItemId && current.servicePlan
      ? {
          ...current.servicePlan,
          items: current.servicePlan.items.map(item => {
            if (item.id === command.serviceItemId) {
              return { ...item, state: 'live' as const };
            }
            if (item.state === 'live') {
              return { ...item, state: 'completed' as const };
            }
            return item;
          })
        }
      : current.servicePlan;

  await runtimeState.patch({
    activeLiveSessionId: command.liveSessionId,
    activeServiceItemId: anyAccepted
      ? command.serviceItemId || current.activeServiceItemId
      : current.activeServiceItemId,
    providerObservedState,
    servicePlan: nextServicePlan
  });

  idempotency.set(command.idempotencyKey, results);
  return results;
}

const sceneExecutor = new SceneExecutor({ executeCommand: execute });

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

async function webAppAvailable(): Promise<boolean> {
  try {
    return (await stat(join(WEB_ROOT, 'index.html'))).isFile();
  } catch {
    return false;
  }
}

async function serveWebApp(res: ServerResponse, pathname: string): Promise<boolean> {
  if (!(await webAppAvailable())) return false;

  let requested = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  if (!requested || requested.includes('..')) requested = 'index.html';

  let target = resolve(WEB_ROOT, requested);
  if (target !== WEB_ROOT && !target.startsWith(WEB_ROOT + sep)) {
    target = join(WEB_ROOT, 'index.html');
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) throw new Error('not_file');
  } catch {
    target = join(WEB_ROOT, 'index.html');
  }

  try {
    const data = await readFile(target);
    const extension = extname(target).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES[extension] || 'application/octet-stream');
    const basename = target.split(sep).pop() || '';
    const mustRevalidate =
      extension === '.html' ||
      basename === 'sw.js' ||
      basename === 'registerSW.js' ||
      basename === 'manifest.webmanifest';
    res.setHeader(
      'Cache-Control',
      mustRevalidate
        ? 'no-cache,no-store,must-revalidate'
        : 'public,max-age=31536000,immutable'
    );
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

function localConsoleHtml(): string {
  const addresses = lanAddresses()
    .map(ip => `<li>http://${ip}:${PORT}</li>`)
    .join('');
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>MusicScale Live Node</title>
<style>
:root{font-family:Inter,system-ui,sans-serif;color:#f5f6fa;background:#0b0c11}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 70% 10%,#241d4a 0,transparent 35%),#0b0c11}
main{width:min(680px,calc(100vw - 32px));background:#12131a;border:1px solid #292b36;border-radius:24px;padding:32px;box-shadow:0 24px 90px #0008}
small{color:#aaaebe}.brand{letter-spacing:.16em;color:#9b8cff;font-size:11px;font-weight:800}.pin{font-size:58px;letter-spacing:.12em;font-variant-numeric:tabular-nums;margin:18px 0}.muted{color:#8e93a5}.box{background:#0d0e14;border:1px solid #252733;border-radius:16px;padding:18px;margin-top:18px}code{color:#b8aeff}ul{padding-left:20px}.field{display:grid;gap:6px;margin-top:10px}.field span{font-size:11px;color:#8e93a5}.field input,.field select{background:#111219;border:1px solid #2d303c;color:#f5f6fa;border-radius:10px;padding:10px 11px;font:inherit}.routing-field{margin-top:12px}.row{display:flex;gap:8px;align-items:center;margin-top:12px}.btn{border:0;border-radius:10px;background:#7c5cff;color:white;padding:10px 13px;font:inherit;font-weight:700;cursor:pointer}.btn.secondary{background:#191b24;color:#d9dbe4;border:1px solid #2a2d38}.statusline{font-size:11px;color:#8e93a5;margin-top:10px;line-height:1.45}
</style>
</head>
<body><main>
<div class="brand">MUSICSCALE / LIVE NODE</div>
<h1>${hostname()}</h1>
<p class="muted">Node <code>${nodeId}</code> · v${VERSION}</p>
<div class="box">
<small>CÓDIGO DE PAREAMENTO ATIVO</small>
<div id="pin" class="pin">------</div>
<p id="status" class="muted">Solicite o pareamento no MusicScale Live. O código aparece somente neste computador.</p>
</div>
<div class="box">
<small>PROVIDER · HOLYRICS</small>
<div class="field"><span>Endereço da API local</span><input id="holyrics-url" value="http://127.0.0.1:8091" autocomplete="off"/></div>
<div class="field"><span>Token do Holyrics</span><input id="holyrics-token" type="password" placeholder="Cole o token criado no Holyrics" autocomplete="new-password"/></div>
<div class="row">
<button class="btn" onclick="saveHolyrics()">Salvar e testar</button>
<button class="btn secondary" onclick="refreshProvider()">Testar novamente</button>
</div>
<div id="provider-status" class="statusline">Verificando configuração…</div>
</div>
<div class="box">
<small>PROVIDER · RESOLUME ARENA / AVENUE</small>
<div class="field"><span>Endereço do Webserver / REST API</span><input id="resolume-url" value="http://127.0.0.1:8080" autocomplete="off"/></div>
<div class="row">
<button class="btn" onclick="saveResolume()">Salvar e testar</button>
<button class="btn secondary" onclick="refreshProvider()">Testar novamente</button>
</div>
<div id="resolume-status" class="statusline">Verificando configuração…</div>
</div>
<div class="box">
<small>PROVIDER · PROPRESENTER</small>
<div class="field">
<span>Endereço da Network API</span>
<input id="propresenter-url" value="" placeholder="Ex.: 192.168.1.44:porta exibida no ProPresenter" autocomplete="off"/>
</div>
<p class="muted" style="font-size:11px;line-height:1.45">No ProPresenter, habilite Network e copie exatamente o IP e a porta mostrados ali. O MusicScale Live não presume uma porta fixa.</p>
<div class="row">
<button class="btn" onclick="saveProPresenter()">Salvar e testar</button>
<button class="btn secondary" onclick="refreshProvider()">Testar novamente</button>
</div>
<div id="propresenter-status" class="statusline">Verificando configuração…</div>
</div>
<div class="box" id="routing-box" style="display:none">
<small>QUEM CONTROLA O QUÊ</small>
<p class="muted" style="font-size:11px;line-height:1.45">Quando mais de um provider consegue executar a mesma função, escolha aqui quem é o principal. Com apenas um provider compatível, o Live roteia automaticamente.</p>
<div id="routing-controls"></div>
<div id="routing-status" class="statusline"></div>
</div>
<div class="box">
<small>DIAGNÓSTICO LOCAL</small>
<div class="row">
<button class="btn secondary" onclick="downloadDiagnostics()">Baixar diagnóstico</button>
<span class="muted" style="font-size:11px">O arquivo não inclui token do Holyrics nem credenciais de pareamento.</span>
</div>
</div>
<div class="box">
<small>CONECTAR TABLET OU CELULAR</small>
<div style="display:flex;gap:16px;align-items:center;margin-top:12px;flex-wrap:wrap">
<img src="/local/connect-qr.svg" alt="QR para abrir MusicScale Live na rede local" width="150" height="150" style="background:white;border-radius:14px;padding:8px"/>
<div class="muted" style="max-width:330px;line-height:1.5">Escaneie este QR no dispositivo que ficará com o operador. Ele abre o MusicScale Live diretamente pelo Live Node, sem depender da internet.</div>
</div>
</div>
<div class="box"><small>ENDEREÇOS NA REDE LOCAL</small><ul>${addresses || '<li>Nenhum IPv4 LAN detectado</li>'}</ul></div>
<script>
async function refresh(){
  try{
    const r=await fetch('/local/pairing',{cache:'no-store'});
    if(!r.ok){document.getElementById('status').textContent='Abra esta página no próprio computador do Live Node para ver o PIN.';return}
    const d=await r.json();
    document.getElementById('pin').textContent=d.pin||'------';
    document.getElementById('status').textContent=d.pin?'Digite este código no MusicScale Live. Expira em até 2 minutos.':'Aguardando solicitação de pareamento…';
  }catch{}
}
function routeGroupForCapabilityClient(capability){
  if(capability.startsWith('presentation.')||capability==='preview.snapshot')return 'presentation';
  if(capability.startsWith('songs.')||capability.startsWith('playlist.'))return 'songs';
  if(capability.startsWith('bible.'))return 'bible';
  if(capability.startsWith('media.'))return 'media';
  if(capability.startsWith('stage.'))return 'stage';
  if(capability.startsWith('visual.'))return 'visual';
  if(capability.startsWith('audio.'))return 'audio';
  return 'automation';
}
function routeGroupLabel(group){
  return ({
    presentation:'Apresentação / slides',
    songs:'Músicas / playlists',
    bible:'Bíblia',
    media:'Mídia',
    stage:'Palco / comunicação',
    visual:'Visuais',
    audio:'Áudio',
    automation:'Automações'
  })[group]||group;
}
function renderRouting(providers,routing){
  const box=document.getElementById('routing-box');
  const root=document.getElementById('routing-controls');
  const groups=['presentation','songs','bible','media','stage','visual','audio','automation'];
  const rows=[];

  for(const group of groups){
    const candidates=(providers||[]).filter(provider =>
      Array.isArray(provider.capabilities) &&
      provider.capabilities.some(cap => routeGroupForCapabilityClient(cap)===group)
    );
    if(candidates.length<2) continue;

    const options=[
      '<option value="">Escolha o provider principal…</option>',
      ...candidates.map(provider => {
        const selected=routing&&routing[group]===provider.providerId?' selected':'';
        const health=provider.health==='online'?' · online':' · '+provider.health;
        return '<option value="'+provider.providerId+'"'+selected+'>'+provider.displayName+health+'</option>';
      })
    ].join('');

    rows.push(
      '<label class="field routing-field"><span>'+routeGroupLabel(group)+'</span>'+
      '<select data-route-group="'+group+'" onchange="saveRoute(this)">'+options+'</select></label>'
    );
  }

  root.innerHTML=rows.join('');
  box.style.display=rows.length?'block':'none';
}
async function saveRoute(select){
  const status=document.getElementById('routing-status');
  const group=select.dataset.routeGroup;
  const providerId=select.value||null;
  status.textContent='Salvando roteamento…';
  try{
    const r=await fetch('/local/routing',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({group,providerId})
    });
    const d=await r.json();
    if(!r.ok){
      status.textContent='Falha: '+(d.error||'não foi possível salvar');
      return;
    }
    status.textContent=providerId
      ? routeGroupLabel(group)+' definido.'
      : routeGroupLabel(group)+' voltará ao roteamento automático quando não houver ambiguidade.';
  }catch{
    status.textContent='Não foi possível salvar o roteamento.';
  }
}
async function refreshProvider(){
  const el=document.getElementById('provider-status');
  try{
    const r=await fetch('/local/providers',{cache:'no-store'});
    const d=await r.json();
    if(!r.ok){el.textContent='Configuração disponível apenas neste computador.';return}
    renderRouting(d.providers||[],d.routing||{});
    const h=d.holyrics||{};
    document.getElementById('holyrics-url').value=h.baseUrl||'http://127.0.0.1:8091';
    if(!h.configured){
      el.textContent='Holyrics ainda não configurado.';
    }else{
      const count=Array.isArray(h.capabilities)?h.capabilities.length:0;
      el.textContent=(h.health==='online'?'Conectado':'Configurado, mas offline')+' · '+count+' capacidades detectadas'+(h.source==='environment'?' · gerenciado pelo ambiente':'');
    }

    const re=d.resolume||{};
    const rel=document.getElementById('resolume-status');
    document.getElementById('resolume-url').value=re.baseUrl||'http://127.0.0.1:8080';
    if(!re.configured){
      rel.textContent='Resolume ainda não configurado.';
    }else{
      const count=Array.isArray(re.capabilities)?re.capabilities.length:0;
      rel.textContent=(re.health==='online'?'Conectado':'Configurado, mas offline')+' · '+count+' capacidades detectadas'+(re.source==='environment'?' · gerenciado pelo ambiente':'');
    }

    const pp=d.propresenter||{};
    const pel=document.getElementById('propresenter-status');
    document.getElementById('propresenter-url').value=pp.baseUrl||'';
    if(!pp.configured){
      pel.textContent='ProPresenter ainda não configurado.';
    }else{
      const count=Array.isArray(pp.capabilities)?pp.capabilities.length:0;
      pel.textContent=(pp.health==='online'?'Conectado':'Configurado, mas offline')+' · '+count+' capacidades detectadas'+(pp.source==='environment'?' · gerenciado pelo ambiente':'');
    }
  }catch{
    el.textContent='Não foi possível ler a configuração.';
    document.getElementById('resolume-status').textContent='Não foi possível ler a configuração.';
    document.getElementById('propresenter-status').textContent='Não foi possível ler a configuração.';
  }
}
async function downloadDiagnostics(){
  try{
    const r=await fetch('/local/diagnostics',{cache:'no-store'});
    const d=await r.json();
    if(!r.ok) throw new Error(d.error||'diagnostics_failed');
    const blob=new Blob([JSON.stringify(d,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='musicscale-live-diagnostics.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }catch(error){
    alert('Não foi possível gerar o diagnóstico local.');
  }
}
async function saveProPresenter(){
  const el=document.getElementById('propresenter-status');
  const baseUrl=document.getElementById('propresenter-url').value.trim();
  if(!baseUrl){el.textContent='Informe o IP e a porta exibidos em Network no ProPresenter.';return}
  el.textContent='Salvando e testando…';
  try{
    const r=await fetch('/local/providers/propresenter',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({baseUrl})
    });
    const d=await r.json();
    if(!r.ok){el.textContent='Falha: '+(d.error||d.reason||'não foi possível conectar');return}
    el.textContent='ProPresenter conectado · '+(d.capabilities||[]).length+' capacidades'+(d.version?' · '+d.version:'');
  }catch{el.textContent='Não foi possível salvar a configuração.'}
}
async function saveResolume(){
  const el=document.getElementById('resolume-status');
  const baseUrl=document.getElementById('resolume-url').value;
  el.textContent='Salvando e testando…';
  try{
    const r=await fetch('/local/providers/resolume',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({baseUrl})
    });
    const d=await r.json();
    if(!r.ok){el.textContent='Falha: '+(d.error||d.reason||'não foi possível conectar');return}
    el.textContent='Resolume conectado · '+(d.capabilities||[]).length+' capacidades'+(d.version?' · v'+d.version:'');
  }catch{el.textContent='Não foi possível salvar a configuração.'}
}
async function saveHolyrics(){
  const el=document.getElementById('provider-status');
  const baseUrl=document.getElementById('holyrics-url').value;
  const token=document.getElementById('holyrics-token').value;
  if(!token){el.textContent='Informe o token do Holyrics para salvar.';return}
  el.textContent='Salvando e testando…';
  try{
    const r=await fetch('/local/providers/holyrics',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({baseUrl,token})
    });
    const d=await r.json();
    document.getElementById('holyrics-token').value='';
    if(!r.ok){el.textContent='Falha: '+(d.error||d.reason||'não foi possível conectar');return}
    el.textContent='Holyrics conectado · '+(d.capabilities||[]).length+' capacidades · v'+(d.version||'detectada');
  }catch{el.textContent='Não foi possível salvar a configuração.'}
}
refresh();refreshProvider();setInterval(refresh,1000);
</script>
</main></body></html>`;
}

async function start(): Promise<void> {
  await pairingStore.load();
  await runtimeState.load();
  await providerConfigStore.load();
  await providerRoutingStore.load();
  await registerHolyricsProvider();
  await registerResolumeProvider();
  await registerProPresenterProvider();

  const server = createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/node') {
      return sendHtml(res, 200, localConsoleHtml());
    }

    if (req.method === 'GET' && url.pathname === '/.well-known/musicscale-live-node') {
      return send(res, 200, {
        product: 'MusicScale Live Node',
        protocolVersion: 1,
        version: VERSION,
        nodeId,
        port: PORT
      });
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      const providerSnapshot = capabilityEngine.quickSnapshot();
      return send(res, 200, {
        product: 'MusicScale Live Node',
        version: VERSION,
        nodeId,
        hostname: hostname(),
        health: providerSnapshot.some(provider => provider.health === 'degraded') ? 'degraded' : 'online',
        lanAddresses: lanAddresses(),
        providers: providerSnapshot.length,
        providersOnline: providerSnapshot.filter(
          provider => provider.health === 'online' || provider.health === 'degraded'
        ).length,
        now: new Date().toISOString(),
        pairing: {
          pairedDevices: await pairingStore.activePairingCount(),
          pairingEnabled: PAIRING_ENABLED
        }
      });
    }

    if (req.method === 'GET' && url.pathname === '/local/diagnostics') {
      if (!isLoopback(req)) return send(res, 403, { error: 'local_only' });

      const [runtime, pairedDevices, holyricsConfig, resolumeConfig, propresenterConfig] = await Promise.all([
        runtimeState.load(),
        pairingStore.activePairingCount(),
        providerConfigStore.getHolyrics(),
        providerConfigStore.getResolume(),
        providerConfigStore.getProPresenter()
      ]);
      const providers = capabilityEngine.quickSnapshot();

      return send(res, 200, buildLiveNodeDiagnostics({
        nodeId,
        version: VERSION,
        hostname: hostname(),
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        port: PORT,
        lanAddresses: lanAddresses(),
        webAppPresent: existsSync(join(WEB_ROOT, 'index.html')),
        pairingEnabled: PAIRING_ENABLED,
        pairedDevices,
        runtime,
        providers,
        holyrics: {
          configured: Boolean(HOLYRICS_TOKEN || holyricsConfig?.token),
          source: HOLYRICS_TOKEN ? 'environment' : holyricsConfig ? 'local' : 'none',
          baseUrl: HOLYRICS_TOKEN ? HOLYRICS_URL : holyricsConfig?.baseUrl || HOLYRICS_URL
        },
        resolume: {
          configured: Boolean(RESOLUME_URL || resolumeConfig?.baseUrl),
          source: RESOLUME_URL ? 'environment' : resolumeConfig ? 'local' : 'none',
          baseUrl: RESOLUME_URL || resolumeConfig?.baseUrl || DEFAULT_RESOLUME_URL
        },
        propresenter: {
          configured: Boolean(PROPRESENTER_URL || propresenterConfig?.baseUrl),
          source: PROPRESENTER_URL ? 'environment' : propresenterConfig ? 'local' : 'none',
          baseUrl: PROPRESENTER_URL || propresenterConfig?.baseUrl || ''
        }
      }));
    }

    if (req.method === 'GET' && url.pathname === '/local/connect-qr.svg') {
      if (!isLoopback(req)) return send(res, 403, { error: 'local_only' });
      const ip = lanAddresses()[0] || '127.0.0.1';
      const target = `http://${ip}:${PORT}/`;
      const svg = await qrToString(target, {
        type: 'svg',
        margin: 1,
        width: 320,
        errorCorrectionLevel: 'M'
      });
      return sendSvg(res, 200, svg);
    }

    if (req.method === 'GET' && url.pathname === '/local/providers') {
      if (!isLoopback(req)) return send(res, 403, { error: 'local_only' });
      const [holyricsConfig, resolumeConfig, propresenterConfig, routing] = await Promise.all([
        providerConfigStore.getHolyrics(),
        providerConfigStore.getResolume(),
        providerConfigStore.getProPresenter(),
        providerRoutingStore.all()
      ]);
      const snapshot = capabilityEngine.quickSnapshot();
      const holyrics = snapshot.find(provider => provider.providerId === 'holyrics-primary');
      const resolume = snapshot.find(provider => provider.providerId === 'resolume-primary');
      const propresenter = snapshot.find(provider => provider.providerId === 'propresenter-primary');
      const providers = snapshot.map(provider => {
        const descriptor = capabilityEngine.get(provider.providerId)?.descriptor;
        return {
          ...provider,
          displayName: descriptor?.displayName || provider.providerId,
          providerKey: descriptor?.providerKey || 'unknown',
          kind: descriptor?.kind || 'control'
        };
      });
      return send(res, 200, {
        providers,
        routing,
        holyrics: {
          configured: Boolean(HOLYRICS_TOKEN || holyricsConfig?.token),
          source: HOLYRICS_TOKEN ? 'environment' : holyricsConfig ? 'local' : 'none',
          baseUrl: HOLYRICS_TOKEN ? HOLYRICS_URL : holyricsConfig?.baseUrl || HOLYRICS_URL,
          health: holyrics?.health || 'offline',
          capabilities: holyrics?.capabilities || [],
          observed: holyrics?.observed || {}
        },
        resolume: {
          configured: Boolean(RESOLUME_URL || resolumeConfig?.baseUrl),
          source: RESOLUME_URL ? 'environment' : resolumeConfig ? 'local' : 'none',
          baseUrl: RESOLUME_URL || resolumeConfig?.baseUrl || DEFAULT_RESOLUME_URL,
          health: resolume?.health || 'offline',
          capabilities: resolume?.capabilities || [],
          observed: resolume?.observed || {}
        },
        propresenter: {
          configured: Boolean(PROPRESENTER_URL || propresenterConfig?.baseUrl),
          source: PROPRESENTER_URL ? 'environment' : propresenterConfig ? 'local' : 'none',
          baseUrl: PROPRESENTER_URL || propresenterConfig?.baseUrl || '',
          health: propresenter?.health || 'offline',
          capabilities: propresenter?.capabilities || [],
          observed: propresenter?.observed || {}
        }
      });
    }

    if (req.method === 'POST' && url.pathname === '/local/providers/holyrics') {
      if (!isLoopback(req)) return send(res, 403, { error: 'local_only' });
      if (HOLYRICS_TOKEN) {
        return send(res, 409, { error: 'holyrics_managed_by_environment' });
      }
      const body = await readJson(req);
      if (!body || typeof body !== 'object') throw new Error('invalid_holyrics_config');
      const candidate = body as Record<string, unknown>;
      const baseUrl = String(candidate.baseUrl || HOLYRICS_URL);
      const token = String(candidate.token || '');
      await providerConfigStore.setHolyrics({ baseUrl, token });
      const result = await registerHolyricsProvider();
      return send(res, result.probe?.reachable ? 200 : 422, {
        configured: result.configured,
        source: result.source,
        baseUrl: result.baseUrl,
        reachable: result.probe?.reachable || false,
        version: result.probe?.version || null,
        capabilities: result.probe?.capabilities || [],
        reason: result.probe?.reason || null
      });
    }

    if (req.method === 'POST' && url.pathname === '/local/providers/resolume') {
      if (!isLoopback(req)) return send(res, 403, { error: 'local_only' });
      if (RESOLUME_URL) {
        return send(res, 409, { error: 'resolume_managed_by_environment' });
      }
      const body = await readJson(req);
      if (!body || typeof body !== 'object') throw new Error('invalid_resolume_config');
      const candidate = body as Record<string, unknown>;
      const baseUrl = String(candidate.baseUrl || DEFAULT_RESOLUME_URL);
      await providerConfigStore.setResolume({ baseUrl });
      const result = await registerResolumeProvider();
      return send(res, result.probe?.reachable ? 200 : 422, {
        configured: result.configured,
        source: result.source,
        baseUrl: result.baseUrl,
        reachable: result.probe?.reachable || false,
        version: result.probe?.version || null,
        capabilities: result.probe?.capabilities || [],
        reason: result.probe?.reason || null
      });
    }

    if (req.method === 'POST' && url.pathname === '/local/providers/propresenter') {
      if (!isLoopback(req)) return send(res, 403, { error: 'local_only' });
      if (PROPRESENTER_URL) {
        return send(res, 409, { error: 'propresenter_managed_by_environment' });
      }
      const body = await readJson(req);
      if (!body || typeof body !== 'object') throw new Error('invalid_propresenter_config');
      const candidate = body as Record<string, unknown>;
      const baseUrl = String(candidate.baseUrl || '').trim();
      if (!baseUrl) throw new Error('propresenter_url_required');
      await providerConfigStore.setProPresenter({ baseUrl });
      const result = await registerProPresenterProvider();
      return send(res, result.probe?.reachable ? 200 : 422, {
        configured: result.configured,
        source: result.source,
        baseUrl: result.baseUrl,
        reachable: result.probe?.reachable || false,
        version: result.probe?.version || null,
        capabilities: result.probe?.capabilities || [],
        reason: result.probe?.reason || null
      });
    }

    if (req.method === 'POST' && url.pathname === '/local/providers/propresenter/clear') {
      if (!isLoopback(req)) return send(res, 403, { error: 'local_only' });
      if (PROPRESENTER_URL) {
        return send(res, 409, { error: 'propresenter_managed_by_environment' });
      }
      await providerConfigStore.clearProPresenter();
      capabilityEngine.unregister('propresenter-primary');
      return send(res, 200, { cleared: true });
    }

    if (req.method === 'POST' && url.pathname === '/local/routing') {
      if (!isLoopback(req)) return send(res, 403, { error: 'local_only' });
      const body = await readJson(req);
      if (!body || typeof body !== 'object') throw new Error('invalid_route');
      const candidate = body as Record<string, unknown>;
      const group = String(candidate.group || '') as ProviderRouteGroup;
      const providerId = candidate.providerId == null
        ? null
        : String(candidate.providerId).trim() || null;

      if (![
        'presentation','songs','bible','media','stage','visual','audio','automation'
      ].includes(group)) {
        throw new Error('invalid_route_group');
      }

      if (providerId) {
        const provider = capabilityEngine.get(providerId);
        if (!provider) throw new Error('route_provider_missing');
        const supportsGroup = [...provider.capabilities()]
          .some(capability => routeGroupForCapability(capability) === group);
        if (!supportsGroup) throw new Error('route_provider_incompatible');
      }

      await providerRoutingStore.set(group, providerId);
      return send(res, 200, {
        group,
        providerId,
        routing: await providerRoutingStore.all()
      });
    }

    if (req.method === 'POST' && url.pathname === '/local/providers/resolume/clear') {
      if (!isLoopback(req)) return send(res, 403, { error: 'local_only' });
      if (RESOLUME_URL) {
        return send(res, 409, { error: 'resolume_managed_by_environment' });
      }
      await providerConfigStore.clearResolume();
      capabilityEngine.unregister('resolume-primary');
      return send(res, 200, { cleared: true });
    }

    if (req.method === 'POST' && url.pathname === '/local/providers/holyrics/clear') {
      if (!isLoopback(req)) return send(res, 403, { error: 'local_only' });
      if (HOLYRICS_TOKEN) {
        return send(res, 409, { error: 'holyrics_managed_by_environment' });
      }
      await providerConfigStore.clearHolyrics();
      capabilityEngine.unregister('holyrics-primary');
      return send(res, 200, { cleared: true });
    }

    if (req.method === 'GET' && url.pathname === '/local/pairing') {
      if (!isLoopback(req)) return send(res, 403, { error: 'local_only' });
      const challenge = pairingStore.activeChallengeForLocalDisplay();
      return send(res, 200, {
        pin: challenge?.pin || null,
        expiresAt: challenge?.expiresAt || null
      });
    }

    if (req.method === 'POST' && url.pathname === '/pairing/request') {
      if (!PAIRING_ENABLED) return send(res, 404, { error: 'pairing_not_enabled' });
      if (pairingRateLimited(req)) return send(res, 429, { error: 'pairing_rate_limited' });
      const request = validatePairingRequest(await readJson(req));
      const challenge = await pairingStore.createChallenge(request);
      console.log(JSON.stringify({
        event: 'pairing_code_created',
        nodeId,
        challengeId: challenge.challengeId,
        expiresAt: challenge.expiresAt,
        deviceName: request.deviceName
      }));
      return send(res, 201, {
        challengeId: challenge.challengeId,
        nodeId,
        expiresAt: challenge.expiresAt,
        method: 'pin',
        displayedOnNode: true
      });
    }

    if (req.method === 'POST' && url.pathname === '/pairing/complete') {
      const body = await readJson(req);
      if (!body || typeof body !== 'object') throw new Error('invalid_pairing_complete');
      const candidate = body as Record<string, unknown>;
      requireStrings(
        candidate,
        ['challengeId', 'pin', 'deviceId', 'deviceName'],
        'invalid_pairing_complete'
      );
      const completed = await pairingStore.complete(
        String(candidate.challengeId),
        String(candidate.pin),
        String(candidate.deviceId),
        String(candidate.deviceName)
      );
      return send(res, 201, completed);
    }

    if (req.method === 'GET' && url.pathname === '/capabilities') {
      const session = await authorize(req);
      if (!session) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, { nodeId, providers: capabilityEngine.quickSnapshot() });
    }

    if (req.method === 'GET' && url.pathname === '/state') {
      const session = await authorize(req);
      if (!session) return send(res, 401, { error: 'unauthorized' });
      const state = await runtimeState.load();
      const providers = capabilityEngine.quickSnapshot().map(provider => ({
        ...provider,
        observed:
          state.providerObservedState[provider.providerId] ||
          provider.observed ||
          {}
      }));
      return send(res, 200, {
        nodeId,
        state,
        providers,
        routing: await providerRoutingStore.all()
      });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/provider-assets/')) {
      const session = await authorize(req);
      if (!session) return send(res, 401, { error: 'unauthorized' });

      const parts = url.pathname.split('/').filter(Boolean);
      const providerId = decodeURIComponent(parts[1] || '');
      const assetKind = parts[2] || '';
      const provider = capabilityEngine.get(providerId);
      if (!provider || !provider.fetchAsset) {
        return send(res, 404, { error: 'provider_asset_not_supported' });
      }

      if (assetKind !== 'output-snapshot') {
        return send(res, 404, { error: 'provider_asset_kind_not_supported' });
      }

      const targetId = String(url.searchParams.get('targetId') || '');
      const format = url.searchParams.get('format') === 'png' ? 'png' : 'jpeg';
      if (!targetId) return send(res, 400, { error: 'asset_target_required' });

      const request: ProviderAssetRequest = {
        kind: 'output.snapshot',
        targetId,
        format
      };
      const asset = await provider.fetchAsset(request);
      return sendBinary(
        res,
        200,
        asset.contentType,
        asset.body,
        asset.cacheControl || 'no-store'
      );
    }

    if (req.method === 'POST' && url.pathname === '/heartbeat') {
      const session = await authorize(req);
      if (!session) return send(res, 401, { error: 'unauthorized' });
      const binding = session.dev ? null : await pairingStore.touch(session.token);
      return send(res, 200, {
        nodeId,
        now: new Date().toISOString(),
        binding,
        stateRevision: (await runtimeState.load()).revision
      });
    }

    if (req.method === 'POST' && url.pathname === '/service-plan') {
      const session = await authorize(req);
      if (!session) return send(res, 401, { error: 'unauthorized' });

      const body = await readJson(req);
      const wrapper = (
        body &&
        typeof body === 'object' &&
        'plan' in (body as Record<string, unknown>)
      )
        ? body as Record<string, unknown>
        : { plan: body, providerLinks: [] };

      const plan = validateServicePlan(wrapper.plan);
      const providerLinks = validateProviderLinks(wrapper.providerLinks);
      assertServicePlanScope(plan, session.binding);
      assertProviderLinksScope(providerLinks, session.binding);

      const currentRuntime = await runtimeState.load();
      if (
        currentRuntime.servicePlan?.id === plan.id &&
        plan.revision < currentRuntime.servicePlan.revision
      ) {
        return send(res, 409, {
          error: 'stale_service_plan',
          currentRevision: currentRuntime.servicePlan.revision,
          incomingRevision: plan.revision
        });
      }

      const state = await runtimeState.patch({
        servicePlan: plan,
        providerLinks,
        activeLiveSessionId: `service-plan:${plan.id}`,
        activeServiceItemId: plan.items[0]?.id || null
      });
      return send(res, 200, {
        nodeId,
        servicePlanId: plan.id,
        providerLinks: providerLinks.length,
        stateRevision: state.revision
      });
    }

    if (req.method === 'POST' && url.pathname === '/pairing/revoke') {
      const session = await authorize(req);
      if (!session) return send(res, 401, { error: 'unauthorized' });
      const body = await readJson(req);
      if (!body || typeof body !== 'object') throw new Error('invalid_revoke_request');
      const deviceId = String((body as Record<string, unknown>).deviceId || '');
      if (!deviceId) throw new Error('invalid_revoke_request');
      if (session.binding && session.binding.deviceId !== deviceId) {
        return send(res, 403, { error: 'cannot_revoke_other_device' });
      }
      return send(res, 200, { revoked: await pairingStore.revoke(deviceId) });
    }

    if (req.method === 'POST' && url.pathname === '/scenes/execute') {
      const session = await authorize(req);
      if (!session) return send(res, 401, { error: 'unauthorized' });

      const sceneRequest = validateSceneExecutionRequest(await readJson(req));
      assertSceneScope(sceneRequest, session.binding);

      const cached = sceneIdempotency.get(sceneRequest.idempotencyKey);
      if (cached) return send(res, 200, cached);

      const safetyLevels = sceneRequest.scene.actions.map(action => action.safetyLevel);
      if (
        safetyLevels.includes('critical') &&
        process.env.MUSICSCALE_LIVE_CRITICAL_ACTIONS_ENABLED !== 'true'
      ) {
        return send(res, 403, { error: 'critical_action_blocked' });
      }
      if (
        safetyLevels.some(level => level === 'guarded' || level === 'critical') &&
        req.headers['x-live-confirmation'] !== sceneRequest.id
      ) {
        return send(res, 409, { error: 'guarded_action_confirmation_required' });
      }

      const result = await sceneExecutor.execute(sceneRequest);
      sceneIdempotency.set(sceneRequest.idempotencyKey, result);
      return send(res, 200, result);
    }

    if (req.method === 'POST' && url.pathname === '/commands') {
      const session = await authorize(req);
      if (!session) return send(res, 401, { error: 'unauthorized' });

      const command = validateCommand(await readJson(req));
      assertCommandScope(command, session.binding);

      if (command.safetyLevel === 'critical' && process.env.MUSICSCALE_LIVE_CRITICAL_ACTIONS_ENABLED !== 'true') {
        return send(res, 403, { error: 'critical_action_blocked' });
      }
      if (
        command.safetyLevel === 'guarded' &&
        req.headers['x-live-confirmation'] !== command.id
      ) {
        return send(res, 409, { error: 'guarded_action_confirmation_required' });
      }

      return send(res, 200, {
        correlationId: command.correlationId,
        results: await execute(command)
      });
    }

    if (req.method === 'GET' && await serveWebApp(res, url.pathname)) {
      return;
    }

    return send(res, 404, { error: 'not_found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal_error';
    const status =
      message === 'payload_too_large' ? 413 :
      message === 'forbidden_scope' ? 403 :
      message === 'provider_link_target_missing' ? 409 :
      message === 'stale_service_plan' ? 409 :
      message.includes('expired') ? 410 :
      message.includes('attempts_exceeded') ? 429 :
      message.includes('pin_invalid') || message.startsWith('invalid_') ? 400 :
      500;
    return send(res, status, { error: message });
  }
});

  server.listen(PORT, HOST, () => {
    const urls = lanAddresses().map(ip => `http://${ip}:${PORT}`);
    console.log(JSON.stringify({
      event: 'live_node_started',
      nodeId,
      version: VERSION,
      local: `http://127.0.0.1:${PORT}`,
      lan: urls,
      stateDir: STATE_DIR,
      webRoot: WEB_ROOT,
      pairingEnabled: PAIRING_ENABLED
    }));
  });

  const providerObservationTimer = setInterval(() => {
    void observeOnlineProviders();
  }, 1_500);
  providerObservationTimer.unref();

  const providerRecoveryTimer = setInterval(() => {
    void recoverUnhealthyProviders();
  }, 10_000);
  providerRecoveryTimer.unref();
}

void start().catch(error => {
  console.error(JSON.stringify({
    event: 'live_node_fatal',
    error: error instanceof Error ? error.message : 'unknown'
  }));
  process.exitCode = 1;
});
