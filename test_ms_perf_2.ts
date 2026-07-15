import test from 'node:test';
import assert from 'node:assert';
import {
  getMusicDataCacheKey,
  readMusicDataCache,
  writeMusicDataCache,
  removeMusicDataCache,
  CACHE_CONTEXT_VERSION,
  FRESH_TTL_MS,
  STALE_LIMIT_MS
} from './lib/musicDataCache';

class MockStorage implements Storage {
  private store: Map<string, string> = new Map();
  get length() { return this.store.size; }
  clear() { this.store.clear(); }
  getItem(key: string) { return this.store.get(key) || null; }
  key(index: number) { return Array.from(this.store.keys())[index] || null; }
  removeItem(key: string) { this.store.delete(key); }
  setItem(key: string, value: string) { this.store.set(key, value); }
}

test('MS-PERF-2: Cache Helper Tests', async (t) => {
  const storage = new MockStorage();
  const uid = 'user123';
  const orgId = 'org456';
  const now = 1000000;
  const data = { some: 'data' };

  await t.test('1. Cache key contains version, UID and organizationId', () => {
    const key = getMusicDataCacheKey(uid, orgId);
    assert.strictEqual(key, `musicscale:music-data:v2:${uid}:${orgId}`);
  });

  await t.test('2. Fresh cache is valid', () => {
    storage.clear();
    writeMusicDataCache(storage, uid, orgId, data, now);
    const result = readMusicDataCache(storage, uid, orgId, now + 1000);
    assert.strictEqual(result.status, 'fresh');
    assert.deepStrictEqual(result.data, data);
  });

  await t.test('3. Stale cache < 24h is returned as stale', () => {
    storage.clear();
    writeMusicDataCache(storage, uid, orgId, data, now);
    const staleTime = now + FRESH_TTL_MS + 1000;
    const result = readMusicDataCache(storage, uid, orgId, staleTime);
    assert.strictEqual(result.status, 'stale');
    assert.deepStrictEqual(result.data, data);
  });

  await t.test('4. Cache > 24h is refused and removed', () => {
    storage.clear();
    writeMusicDataCache(storage, uid, orgId, data, now);
    const invalidTime = now + STALE_LIMIT_MS + 1000;
    const result = readMusicDataCache(storage, uid, orgId, invalidTime);
    assert.strictEqual(result.status, 'invalid');
    assert.strictEqual(result.data, null);
    assert.strictEqual(storage.getItem(getMusicDataCacheKey(uid, orgId)), null);
  });

  await t.test('5. Different UID is refused', () => {
    storage.clear();
    writeMusicDataCache(storage, uid, orgId, data, now);
    const result = readMusicDataCache(storage, 'otherUid', orgId, now);
    assert.strictEqual(result.status, 'miss'); // Reading a different key entirely
    // Try to trick by setting the other key's value to the original envelope
    storage.setItem(getMusicDataCacheKey('otherUid', orgId), storage.getItem(getMusicDataCacheKey(uid, orgId))!);
    const result2 = readMusicDataCache(storage, 'otherUid', orgId, now);
    assert.strictEqual(result2.status, 'invalid');
  });

  await t.test('6. Different organizationId is refused', () => {
    storage.clear();
    writeMusicDataCache(storage, uid, orgId, data, now);
    storage.setItem(getMusicDataCacheKey(uid, 'otherOrg'), storage.getItem(getMusicDataCacheKey(uid, orgId))!);
    const result = readMusicDataCache(storage, uid, 'otherOrg', now);
    assert.strictEqual(result.status, 'invalid');
  });

  await t.test('7. Different contextVersion is refused', () => {
    storage.clear();
    const envelope = {
      contextVersion: 1, // Invalid version
      uid,
      organizationId: orgId,
      issuedAt: now,
      expiresAt: now + FRESH_TTL_MS,
      data
    };
    storage.setItem(getMusicDataCacheKey(uid, orgId), JSON.stringify(envelope));
    const result = readMusicDataCache(storage, uid, orgId, now);
    assert.strictEqual(result.status, 'invalid');
  });

  await t.test('8. Invalid JSON is refused and removed', () => {
    storage.clear();
    const key = getMusicDataCacheKey(uid, orgId);
    storage.setItem(key, '{ invalid json');
    const result = readMusicDataCache(storage, uid, orgId, now);
    assert.strictEqual(result.status, 'invalid');
    assert.strictEqual(storage.getItem(key), null);
  });

  await t.test('9. Invalid expiresAt is refused', () => {
    storage.clear();
    const envelope = {
      contextVersion: CACHE_CONTEXT_VERSION,
      uid,
      organizationId: orgId,
      issuedAt: now,
      expiresAt: 'not a number',
      data
    };
    storage.setItem(getMusicDataCacheKey(uid, orgId), JSON.stringify(envelope));
    const result = readMusicDataCache(storage, uid, orgId, now);
    assert.strictEqual(result.status, 'invalid');
  });

  await t.test('10. Invalid issuedAt is refused', () => {
    storage.clear();
    const envelope = {
      contextVersion: CACHE_CONTEXT_VERSION,
      uid,
      organizationId: orgId,
      issuedAt: 'not a number',
      expiresAt: now + FRESH_TTL_MS,
      data
    };
    storage.setItem(getMusicDataCacheKey(uid, orgId), JSON.stringify(envelope));
    const result = readMusicDataCache(storage, uid, orgId, now);
    assert.strictEqual(result.status, 'invalid');
  });

  await t.test('11. Write includes all fields', () => {
    storage.clear();
    writeMusicDataCache(storage, uid, orgId, data, now);
    const raw = storage.getItem(getMusicDataCacheKey(uid, orgId))!;
    const parsed = JSON.parse(raw);
    assert.strictEqual(parsed.contextVersion, CACHE_CONTEXT_VERSION);
    assert.strictEqual(parsed.uid, uid);
    assert.strictEqual(parsed.organizationId, orgId);
    assert.strictEqual(parsed.issuedAt, now);
    assert.strictEqual(parsed.expiresAt, now + FRESH_TTL_MS);
    assert.deepStrictEqual(parsed.data, data);
  });

  await t.test('12. No credentials created by helper', () => {
    storage.clear();
    writeMusicDataCache(storage, uid, orgId, data, now);
    const raw = storage.getItem(getMusicDataCacheKey(uid, orgId))!;
    assert.ok(!raw.includes('token'));
    assert.ok(!raw.includes('password'));
  });

  await t.test('13. Keys for different users/orgs do not collide', () => {
    const k1 = getMusicDataCacheKey('u1', 'o1');
    const k2 = getMusicDataCacheKey('u1', 'o2');
    const k3 = getMusicDataCacheKey('u2', 'o1');
    assert.notStrictEqual(k1, k2);
    assert.notStrictEqual(k1, k3);
    assert.notStrictEqual(k2, k3);
  });
});
