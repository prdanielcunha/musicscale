import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { homedir, hostname, networkInterfaces } from 'node:os';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CAPABILITIES,
  CapabilityEngine,
  type Capability,
  type CommandResult,
  type LiveCommand,
  type PairingRequest,
  type ProviderLink,
  type ServicePlan
} from '@musicscale-live/domain';
import { IdempotencyStore } from './idempotencyStore';
import { PairingStore } from './pairingStore';
import { RuntimeStateStore } from './runtimeStateStore';
import { HolyricsAdapter, HolyricsHttpClient } from '@musicscale-live/adapter-holyrics';

const PORT = Number(process.env.MUSICSCALE_LIVE_NODE_PORT || 4317);
const HOST = process.env.MUSICSCALE_LIVE_NODE_HOST || '0.0.0.0';
const VERSION = '0.1.0-alpha.1';
const DEV_TOKEN = process.env.MUSICSCALE_LIVE_DEV_TOKEN || '';
const PAIRING_ENABLED = process.env.MUSICSCALE_LIVE_PAIRING_ENABLED !== 'false';
const HOLYRICS_TOKEN = process.env.MUSICSCALE_LIVE_HOLYRICS_TOKEN?.trim() || '';
const HOLYRICS_URL = process.env.MUSICSCALE_LIVE_HOLYRICS_URL?.trim() || 'http://127.0.0.1:8091';
const STATE_DIR = process.env.MUSICSCALE_LIVE_STATE_DIR || join(homedir(), '.musicscale-live');
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_WEB_ROOT = resolve(MODULE_DIR, '../../../apps/live/dist');
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
const pairingStore = new PairingStore(join(STATE_DIR, 'pairings.json'), nodeId);
const runtimeState = new RuntimeStateStore(join(STATE_DIR, 'runtime.json'), nodeId);

const pairingRequestHits = new Map<string, number>();

async function registerBuiltInProviders(): Promise<void> {
  if (!HOLYRICS_TOKEN) {
    console.log(JSON.stringify({
      event: 'provider_not_configured',
      providerKey: 'holyrics'
    }));
    return;
  }

  const adapter = new HolyricsAdapter({
    id: 'holyrics-primary',
    nodeId,
    displayName: 'Holyrics',
    api: new HolyricsHttpClient({
      baseUrl: HOLYRICS_URL,
      token: HOLYRICS_TOKEN
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
    reason: probe.reason || null
  }));
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
  if (origin && allowedOrigins.has(origin)) {
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

  const targets = command.targetProviderIds.length
    ? command.targetProviderIds
        .map(id => capabilityEngine.get(id))
        .filter((provider): provider is NonNullable<typeof provider> => Boolean(provider))
    : capabilityEngine.targetsFor(command.capability);

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
      providerObservedState[result.providerInstanceId] = result.observedState;
    }
  }
  await runtimeState.patch({
    activeLiveSessionId: command.liveSessionId,
    providerObservedState
  });

  idempotency.set(command.idempotencyKey, results);
  return results;
}


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
small{color:#aaaebe}.brand{letter-spacing:.16em;color:#9b8cff;font-size:11px;font-weight:800}.pin{font-size:58px;letter-spacing:.12em;font-variant-numeric:tabular-nums;margin:18px 0}.muted{color:#8e93a5}.box{background:#0d0e14;border:1px solid #252733;border-radius:16px;padding:18px;margin-top:18px}code{color:#b8aeff}ul{padding-left:20px}
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
refresh();setInterval(refresh,1000);
</script>
</main></body></html>`;
}

await pairingStore.load();
await runtimeState.load();
await registerBuiltInProviders();

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
      const providerSnapshot = await capabilityEngine.snapshot();
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
      return send(res, 200, { nodeId, providers: await capabilityEngine.snapshot() });
    }

    if (req.method === 'GET' && url.pathname === '/state') {
      const session = await authorize(req);
      if (!session) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, {
        nodeId,
        state: await runtimeState.load(),
        providers: await capabilityEngine.snapshot()
      });
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
