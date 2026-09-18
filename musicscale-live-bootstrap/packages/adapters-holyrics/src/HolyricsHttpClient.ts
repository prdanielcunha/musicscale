import { createHash } from 'node:crypto';

export interface HolyricsResponse<T = unknown> {
  status: 'ok' | 'error';
  data?: T;
  error?: unknown;
}

export interface HolyricsApi {
  request<T = unknown>(action: string, input?: Record<string, unknown>): Promise<T>;
}

export interface HolyricsHttpClientOptions {
  baseUrl?: string;
  token: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface HashSession {
  sid: string;
  nonce: string;
  rid: number;
}

function normalizeBaseUrl(input: string): string {
  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('holyrics_invalid_protocol');
  url.pathname = '';
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export class HolyricsHttpClient implements HolyricsApi {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private session: HashSession | null = null;
  private authPromise: Promise<void> | null = null;
  private requestQueue: Promise<void> = Promise.resolve();

  constructor(options: HolyricsHttpClientOptions) {
    if (!options.token.trim()) throw new Error('holyrics_token_required');
    this.baseUrl = normalizeBaseUrl(options.baseUrl || 'http://127.0.0.1:8091');
    this.token = options.token;
    this.timeoutMs = options.timeoutMs ?? 2500;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  request<T = unknown>(
    action: string,
    input: Record<string, unknown> = {}
  ): Promise<T> {
    const operation = this.requestQueue.then(() => this.performRequest<T>(action, input));
    this.requestQueue = operation.then(
      () => undefined,
      () => undefined
    );
    return operation;
  }

  private async performRequest<T>(
    action: string,
    input: Record<string, unknown>
  ): Promise<T> {
    if (!/^[A-Za-z0-9_]+$/.test(action)) throw new Error('holyrics_invalid_action');
    await this.ensureAuthenticated();

    try {
      return await this.requestWithSession<T>(action, input);
    } catch (error) {
      if (!(error instanceof Error) || ![
        'holyrics_invalid_token',
        'holyrics_invalid_session',
        'holyrics_unauthorized'
      ].includes(error.message)) {
        throw error;
      }
      this.session = null;
      await this.ensureAuthenticated();
      return this.requestWithSession<T>(action, input);
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.session) return;
    if (this.authPromise) return this.authPromise;
    this.authPromise = this.authenticate().finally(() => {
      this.authPromise = null;
    });
    return this.authPromise;
  }

  private async authenticate(): Promise<void> {
    const initial = await this.rawPost<{ sid: string; nonce: string }>(
      '/api/Auth',
      '{}'
    );
    const sid = initial?.sid;
    const nonce = initial?.nonce;
    if (!sid || !nonce) throw new Error('holyrics_auth_nonce_missing');

    const dtoken = sha256(`${nonce}:0:${this.token}:auth`);
    await this.rawPost(
      `/api/Auth?sid=${encodeURIComponent(sid)}&rid=0&dtoken=${dtoken}`,
      'auth'
    );
    this.session = { sid, nonce, rid: 0 };
  }

  private async requestWithSession<T>(
    action: string,
    input: Record<string, unknown>
  ): Promise<T> {
    if (!this.session) throw new Error('holyrics_invalid_session');
    const body = JSON.stringify(input);
    const rid = this.session.rid + 1;
    const dtoken = sha256(
      `${this.session.nonce}:${rid}:${this.token}:${body}`
    );
    const path =
      `/api/${action}?sid=${encodeURIComponent(this.session.sid)}&rid=${rid}&dtoken=${dtoken}`;

    try {
      const data = await this.rawPost<T>(path, body);
      this.session.rid = rid;
      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes('invalid token')) {
        throw new Error('holyrics_invalid_token');
      }
      if (error instanceof Error && error.message.includes('session')) {
        throw new Error('holyrics_invalid_session');
      }
      throw error;
    }
  }

  private async rawPost<T>(path: string, body: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`holyrics_http_${response.status}`);
      }
      const payload = await response.json() as HolyricsResponse<T>;
      if (payload.status !== 'ok') {
        const errorValue =
          typeof payload.error === 'string'
            ? payload.error
            : JSON.stringify(payload.error || 'unknown');
        throw new Error(`holyrics_api_error:${errorValue}`);
      }
      return payload.data as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('holyrics_timeout');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
