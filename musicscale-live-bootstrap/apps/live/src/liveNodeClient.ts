import type {
  CommandResult,
  LiveCommand,
  LiveNodeHealth,
  LiveNodeRuntimeState,
  PairingChallenge,
  PairingCompleteResponse,
  PairingRequest
} from '@musicscale-live/domain';

export interface LiveNodeStateResponse {
  nodeId: string;
  state: LiveNodeRuntimeState;
  providers: Array<{
    providerId: string;
    capabilities: string[];
    health: string;
  }>;
}

export class LiveNodeApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message = code
  ) {
    super(message);
  }
}

function ipv4IsPrivate(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) {
    return false;
  }
  return (
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 172 && (octets[1] ?? 0) >= 16 && (octets[1] ?? 0) <= 31)
  );
}

export function normalizePrivateNodeUrl(input: string): string {
  const value = input.trim();
  const withProtocol = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  const url = new URL(withProtocol);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported_node_protocol');

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const allowed =
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.startsWith('fe80:') ||
    host.startsWith('fc') ||
    host.startsWith('fd') ||
    ipv4IsPrivate(host);

  if (!allowed) throw new Error('node_must_be_local');
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

async function requestJson<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  timeoutMs = 3500
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new LiveNodeApiError(
        String(body?.error || 'node_request_failed'),
        response.status
      );
    }
    return body as T;
  } catch (error) {
    if (error instanceof LiveNodeApiError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new LiveNodeApiError('node_timeout', 0);
    }
    throw new LiveNodeApiError('node_unreachable', 0);
  } finally {
    window.clearTimeout(timeout);
  }
}

export function mixedContentWouldBlock(baseUrl: string): boolean {
  return window.location.protocol === 'https:' && new URL(baseUrl).protocol === 'http:';
}

export async function probeNode(baseUrlInput: string): Promise<LiveNodeHealth> {
  const baseUrl = normalizePrivateNodeUrl(baseUrlInput);
  return requestJson<LiveNodeHealth>(baseUrl, '/health', {}, 2500);
}

export async function requestPairing(
  baseUrlInput: string,
  request: PairingRequest
): Promise<PairingChallenge> {
  const baseUrl = normalizePrivateNodeUrl(baseUrlInput);
  return requestJson<PairingChallenge>(baseUrl, '/pairing/request', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}

export async function completePairing(
  baseUrlInput: string,
  request: {
    challengeId: string;
    pin: string;
    deviceId: string;
    deviceName: string;
  }
): Promise<PairingCompleteResponse> {
  const baseUrl = normalizePrivateNodeUrl(baseUrlInput);
  return requestJson<PairingCompleteResponse>(baseUrl, '/pairing/complete', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}

export async function heartbeatNode(baseUrl: string, token: string): Promise<{
  nodeId: string;
  now: string;
  stateRevision: number;
}> {
  return requestJson(baseUrl, '/heartbeat', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: '{}'
  }, 2200);
}

export async function loadNodeState(
  baseUrl: string,
  token: string
): Promise<LiveNodeStateResponse> {
  return requestJson<LiveNodeStateResponse>(baseUrl, '/state', {
    headers: { Authorization: `Bearer ${token}` }
  });
}

export async function revokeNodePairing(
  baseUrl: string,
  token: string,
  deviceId: string
): Promise<void> {
  await requestJson(baseUrl, '/pairing/revoke', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ deviceId })
  });
}


export async function executeNodeCommand(
  baseUrl: string,
  token: string,
  command: LiveCommand
): Promise<{ correlationId: string; results: CommandResult[] }> {
  const guardedHeaders: Record<string, string> =
    command.safetyLevel === 'guarded'
      ? { 'x-live-confirmation': command.id }
      : {};

  return requestJson(baseUrl, '/commands', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...guardedHeaders
    },
    body: JSON.stringify(command)
  }, 5000);
}
