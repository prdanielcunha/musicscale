import { createNestAiClient, type Locale, type NestAiClient } from '@millionsnest/ai';

type RequestLike = {
  headers?: Record<string, string | string[] | undefined>;
};

function header(req: RequestLike, name: string): string {
  const raw = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(raw) ? String(raw[0] ?? '') : String(raw ?? '');
}

export function normalizeNestAiLocale(value: unknown): Locale {
  const raw = String(value || 'pt-BR').toLowerCase();
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('es')) return 'es';
  return 'pt-BR';
}

export function createMusicScaleNestAiClient(input: {
  req: RequestLike;
  organizationId: string;
  locale?: unknown;
  fetcher?: typeof fetch;
}): NestAiClient {
  const authorization = header(input.req, 'authorization').trim();
  const appCheck = header(input.req, 'x-firebase-appcheck').trim();
  if (!authorization.startsWith('Bearer ')) throw new Error('NESTAI_FIREBASE_AUTH_REQUIRED');
  if (!appCheck) throw new Error('NESTAI_APP_CHECK_REQUIRED');

  const fetcher = input.fetcher ?? fetch;
  const locale = normalizeNestAiLocale(input.locale);
  const organizationId = String(input.organizationId || '').trim();
  if (!organizationId || organizationId.includes('/') || organizationId.length > 256) {
    throw new Error('NESTAI_ORGANIZATION_INVALID');
  }

  let tokenPromise: Promise<string> | null = null;
  const getToken = async (): Promise<string> => {
    if (!tokenPromise) {
      tokenPromise = (async () => {
        const response = await fetcher('https://www.millionsnest.com/api/v1/ai/token', {
          method: 'POST',
          headers: {
            authorization,
            'x-firebase-appcheck': appCheck,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            organizationId,
            appId: 'musicscale',
            locale,
          }),
        });
        const body = await response.json() as { token?: string; error?: string };
        if (!response.ok || !body.token) {
          throw new Error(body.error || 'NESTAI_HUB_TOKEN_FAILED');
        }
        return body.token;
      })();
    }
    return tokenPromise;
  };

  return createNestAiClient({
    appId: 'musicscale',
    organizationId,
    locale,
    getToken,
    getAppCheckToken: async () => appCheck,
    baseUrl: process.env.NESTAI_BASE_URL || 'https://ai.millionsnest.com/v1/',
    fetcher,
  });
}

export function nestAiHttpStatus(error: unknown): number {
  const code = error instanceof Error ? error.message : String(error || '');
  if (/AUTH|TOKEN|APP_CHECK|ACCESS_DENIED/.test(code)) return 401;
  if (/RATE|COST|QUOTA|LIMIT/.test(code)) return 429;
  if (/TIMEOUT/.test(code)) return 504;
  return 503;
}
