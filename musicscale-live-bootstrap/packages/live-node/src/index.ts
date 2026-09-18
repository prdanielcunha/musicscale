import { createHash, randomInt } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { hostname, networkInterfaces } from 'node:os';
import {
  CAPABILITIES,
  CapabilityEngine,
  type Capability,
  type CommandResult,
  type LiveCommand
} from '@musicscale-live/domain';
import { IdempotencyStore } from './idempotencyStore';

const PORT = Number(process.env.MUSICSCALE_LIVE_NODE_PORT || 4317);
const HOST = process.env.MUSICSCALE_LIVE_NODE_HOST || '0.0.0.0';
const VERSION = '0.0.1';
const DEV_TOKEN = process.env.MUSICSCALE_LIVE_DEV_TOKEN || '';
const allowedOrigins = new Set(
  (process.env.MUSICSCALE_LIVE_ALLOWED_ORIGINS || 'http://localhost:4316')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
);

const nodeId = process.env.MUSICSCALE_LIVE_NODE_ID ||
  `node_${createHash('sha256').update(`${hostname()}|musicscale-live`).digest('hex').slice(0, 16)}`;

const capabilityEngine = new CapabilityEngine();
const idempotency = new IdempotencyStore<CommandResult[]>();

function lanAddresses(): string[] {
  const addresses: string[] = [];
  for (const group of Object.values(networkInterfaces())) {
    for (const entry of group || []) {
      if (entry.family === 'IPv4' && !entry.internal) addresses.push(entry.address);
    }
  }
  return addresses;
}

function setCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type,x-correlation-id');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
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

function authorized(req: IncomingMessage): boolean {
  if (!DEV_TOKEN) return false;
  return req.headers.authorization === `Bearer ${DEV_TOKEN}`;
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
    candidate.liveSessionId,
    candidate.actorId,
    candidate.idempotencyKey,
    candidate.createdAt
  ];
  if (requiredStrings.some(item => typeof item !== 'string' || !item)) throw new Error('invalid_command');
  if (!isCapability(candidate.capability)) throw new Error('invalid_capability');
  if (!Array.isArray(candidate.targetProviderIds) || !Array.isArray(candidate.outputTargets)) throw new Error('invalid_targets');
  if (!['live-ui','pastor','conductor','automation','api'].includes(String(candidate.origin))) throw new Error('invalid_origin');
  if (!['normal','guarded','critical'].includes(String(candidate.safetyLevel))) throw new Error('invalid_safety_level');
  return candidate as LiveCommand;
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

  idempotency.set(command.idempotencyKey, results);
  return results;
}

const server = createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, {
        product: 'MusicScale Live Node',
        version: VERSION,
        nodeId,
        hostname: hostname(),
        health: 'online',
        lanAddresses: lanAddresses(),
        providers: (await capabilityEngine.snapshot()).length,
        now: new Date().toISOString()
      });
    }

    if (req.method === 'GET' && url.pathname === '/capabilities') {
      return send(res, 200, { nodeId, providers: await capabilityEngine.snapshot() });
    }

    if (req.method === 'GET' && url.pathname === '/pairing/challenge') {
      if (process.env.MUSICSCALE_LIVE_PAIRING_ENABLED !== 'true') {
        return send(res, 404, { error: 'pairing_not_enabled' });
      }
      const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
      return send(res, 200, {
        nodeId,
        pin,
        expiresInSeconds: 120,
        note: 'Bootstrap challenge only. Signed venue-bound pairing is Phase 1.'
      });
    }

    if (req.method === 'POST' && url.pathname === '/commands') {
      if (!DEV_TOKEN) return send(res, 503, { error: 'node_not_paired' });
      if (!authorized(req)) return send(res, 401, { error: 'unauthorized' });
      const command = validateCommand(await readJson(req));
      return send(res, 200, {
        correlationId: command.correlationId,
        results: await execute(command)
      });
    }

    return send(res, 404, { error: 'not_found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'internal_error';
    const status = message === 'payload_too_large' ? 413 : message.startsWith('invalid_') ? 400 : 500;
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
    lan: urls
  }));
});
