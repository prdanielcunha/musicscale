export interface ResolumeBinaryResponse {
  contentType: string;
  body: Uint8Array;
}

export interface ResolumeRestApi {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  getBinary(path: string): Promise<ResolumeBinaryResponse>;
}

export interface ResolumeRestClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
  if (host.startsWith('127.') || host.startsWith('10.') || host.startsWith('192.168.')) return true;
  const match = host.match(/^172\.(\d{1,3})\./);
  if (match) {
    const second = Number(match[1]);
    return second >= 16 && second <= 31;
  }
  if (host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
  return false;
}

export function normalizeResolumeApiUrl(input = 'http://127.0.0.1:8080'): string {
  const raw = input.trim() || 'http://127.0.0.1:8080';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  const url = new URL(withProtocol);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('resolume_invalid_protocol');
  }
  if (!isPrivateHostname(url.hostname)) {
    throw new Error('resolume_url_must_be_local');
  }

  const cleanPath = url.pathname.replace(/\/+$/, '');
  url.pathname = cleanPath.endsWith('/api/v1')
    ? cleanPath
    : `${cleanPath}/api/v1`.replace(/\/+/g, '/');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export class ResolumeRestClient implements ResolumeRestApi {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ResolumeRestClientOptions = {}) {
    this.baseUrl = normalizeResolumeApiUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? 2500;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  async getBinary(path: string): Promise<ResolumeBinaryResponse> {
    if (!path.startsWith('/')) throw new Error('resolume_invalid_path');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'GET',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`resolume_http_${response.status}`);
      return {
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        body: new Uint8Array(await response.arrayBuffer())
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('resolume_timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    if (!path.startsWith('/')) throw new Error('resolume_invalid_path');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`resolume_http_${response.status}`);
      }

      if (response.status === 204) return undefined as T;
      const text = await response.text();
      if (!text) return undefined as T;
      return JSON.parse(text) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('resolume_timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
