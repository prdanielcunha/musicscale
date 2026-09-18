export interface ProPresenterBinaryResponse {
  contentType: string;
  body: Uint8Array;
}

export interface ProPresenterApi {
  get<T = unknown>(path: string): Promise<T>;
  put<T = unknown>(path: string, body?: unknown): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  delete<T = unknown>(path: string): Promise<T>;
  getBinary(path: string): Promise<ProPresenterBinaryResponse>;
}

export interface ProPresenterHttpClientOptions {
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
  return host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd');
}

export function normalizeProPresenterApiUrl(
  input = 'http://127.0.0.1:50001'
): string {
  const raw = input.trim() || 'http://127.0.0.1:50001';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  const url = new URL(withProtocol);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('propresenter_invalid_protocol');
  }
  if (!isPrivateHostname(url.hostname)) {
    throw new Error('propresenter_url_must_be_local');
  }

  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export class ProPresenterHttpClient implements ProPresenterApi {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ProPresenterHttpClientOptions = {}) {
    this.baseUrl = normalizeProPresenterApiUrl(options.baseUrl);
    this.timeoutMs = options.timeoutMs ?? 2500;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  get<T = unknown>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('PUT', path, body);
  }

  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>('DELETE', path);
  }

  async getBinary(path: string): Promise<ProPresenterBinaryResponse> {
    if (!path.startsWith('/')) throw new Error('propresenter_invalid_path');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'GET',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`propresenter_http_${response.status}`);
      return {
        contentType: response.headers.get('content-type') || 'application/octet-stream',
        body: new Uint8Array(await response.arrayBuffer())
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('propresenter_timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async request<T>(
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    if (!path.startsWith('/')) throw new Error('propresenter_invalid_path');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined
          ? undefined
          : typeof body === 'string'
            ? body
            : JSON.stringify(body),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`propresenter_http_${response.status}`);
      }
      if (response.status === 204) return undefined as T;

      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      if (!text) return undefined as T;
      if (contentType.includes('application/json')) return JSON.parse(text) as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as T;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('propresenter_timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
