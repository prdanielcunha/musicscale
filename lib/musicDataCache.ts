export const CACHE_CONTEXT_VERSION = 2;
export const FRESH_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const STALE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours

export type CacheStatus = 'fresh' | 'stale' | 'miss' | 'invalid';

export interface CacheReadResult<T> {
  status: CacheStatus;
  data: T | null;
  ageMs: number;
}

export interface CacheEnvelope<T> {
  contextVersion: number;
  uid: string;
  organizationId: string;
  issuedAt: number;
  expiresAt: number;
  data: T;
}

export function getMusicDataCacheKey(uid: string, organizationId: string): string {
  return `musicscale:music-data:v2:${uid}:${organizationId}`;
}

export function readMusicDataCache<T>(
  storage: Storage | null,
  uid: string,
  organizationId: string,
  nowMs: number = Date.now()
): CacheReadResult<T> {
  if (!storage) {
    return { status: 'miss', data: null, ageMs: 0 };
  }

  const key = getMusicDataCacheKey(uid, organizationId);
  const raw = storage.getItem(key);

  if (!raw) {
    return { status: 'miss', data: null, ageMs: 0 };
  }

  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;

    if (
      parsed.contextVersion !== CACHE_CONTEXT_VERSION ||
      parsed.uid !== uid ||
      parsed.organizationId !== organizationId ||
      typeof parsed.issuedAt !== 'number' ||
      typeof parsed.expiresAt !== 'number' ||
      !parsed.data ||
      typeof parsed.data !== 'object'
    ) {
      storage.removeItem(key);
      return { status: 'invalid', data: null, ageMs: 0 };
    }

    const ageMs = nowMs - parsed.issuedAt;

    if (ageMs > STALE_LIMIT_MS || ageMs < 0) {
      storage.removeItem(key);
      return { status: 'invalid', data: null, ageMs };
    }

    if (nowMs > parsed.expiresAt) {
      return { status: 'stale', data: parsed.data, ageMs };
    }

    return { status: 'fresh', data: parsed.data, ageMs };
  } catch (error) {
    storage.removeItem(key);
    return { status: 'invalid', data: null, ageMs: 0 };
  }
}

export function writeMusicDataCache<T>(
  storage: Storage | null,
  uid: string,
  organizationId: string,
  data: T,
  nowMs: number = Date.now()
): void {
  if (!storage) return;

  const key = getMusicDataCacheKey(uid, organizationId);
  const envelope: CacheEnvelope<T> = {
    contextVersion: CACHE_CONTEXT_VERSION,
    uid,
    organizationId,
    issuedAt: nowMs,
    expiresAt: nowMs + FRESH_TTL_MS,
    data
  };

  try {
    storage.setItem(key, JSON.stringify(envelope));
  } catch (error) {
    // Ignore quota or availability errors
  }
}

export function removeMusicDataCache(
  storage: Storage | null,
  uid: string,
  organizationId: string
): void {
  if (!storage) return;
  const key = getMusicDataCacheKey(uid, organizationId);
  storage.removeItem(key);
}
