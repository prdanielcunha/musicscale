const fs = require('fs');
const crypto = require('crypto');

function getGitHash(content) {
  const header = `blob ${Buffer.byteLength(content)}\0`;
  const store = Buffer.concat([Buffer.from(header), Buffer.from(content)]);
  return crypto.createHash('sha1').update(store).digest('hex');
}

const files = {
  'test_handoff.ts': {
    target: '70acfacb387fcbf2303ea46d13ac58c7a9d3e07c',
    content: `import test from 'node:test';
import assert from 'node:assert';
// Setup mock window
const mockReplace = (url: string) => { (global as any).lastReplace = url; };
const mockReplaceState = (state: any, title: string, url: string) => { (global as any).lastReplaceState = url; };
(global as any).window = {
    location: { search: '', href: '', pathname: '/login', origin: 'https://musicscale.app', replace: mockReplace },
    history: { replaceState: mockReplaceState }
};
(global as any).atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
(global as any).localStorage = { getItem: () => null, setItem: () => null, removeItem: () => null };
// Import the module under test
import { consumeHandoff, resetHandoffForTesting } from './services/ecosystem/handoffHelper.js';
import { _resetStartupTelemetry, getStartupTelemetrySnapshot } from './lib/startupTelemetry.js';
function setupUrl(payload: any | string, isRaw = false, extraParam = 'other=123') {
    resetHandoffForTesting();
    _resetStartupTelemetry();
    (global as any).lastReplace = '';
    (global as any).lastReplaceState = '';
    
    let base64 = '';
    if (isRaw) {
        base64 = payload as string;
    } else if (payload) {
        base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    }
    
    const search = payload ? \\\`?ecosystem_ctx=\\$\\{base64\\}&\\$\\{extraParam\\}\\\` : \\\`?\\$\\{extraParam\\}\\\`;
    (global as any).window.location.search = search;
    (global as any).window.location.href = \\\`https://musicscale.app/login\\$\\{search\\}#hash\\\`;
}
test('Handoff Parser Tests', async (t) => {
    await t.test('1. Valid payload parses and URL clears, falls through to Firebase error (invalid token)', async () => {
        setupUrl({ 
            appId: 'musicscale', protocolVersion: '1.0.0', 
            userId: 'user_123', customToken: 'token_123', 
            expiresAt: Date.now() + 10000 
        });
        
        try { await consumeHandoff(); } catch(e) {}
        
        const snapshot = getStartupTelemetrySnapshot();
        const startedEvents = snapshot.filter(e => e.metric === 'handoff_exchange_started_ms');
        const completedEvents = snapshot.filter(e => e.metric === 'handoff_exchange_completed_ms');
        
        assert.strictEqual(startedEvents.length, 1, 'Should register exactly one handoff_exchange_started_ms');
        assert.strictEqual(completedEvents.length, 0, 'Should not register handoff_exchange_completed_ms');
        
        assert.ok((global as any).lastReplaceState.includes('other=123'));
        assert.ok(!(global as any).lastReplaceState.includes('ecosystem_ctx'));
        assert.ok((global as any).lastReplaceState.includes('#hash'));
        assert.ok((global as any).lastReplace.includes('handoff_error=invalid')); // Because token_123 is not a real custom token
    });
    await t.test('2. Expired payload fails with "expired"', async () => {
        setupUrl({ 
            appId: 'musicscale', protocolVersion: '1.0.0', 
            userId: 'user_123', customToken: 'token_123', 
            expiresAt: Date.now() - 100000 
        });
        
        try { await consumeHandoff(); } catch (e) {}
        
        const snapshot = getStartupTelemetrySnapshot();
        const startedEvents = snapshot.filter(e => e.metric === 'handoff_exchange_started_ms');
        assert.strictEqual(startedEvents.length, 0, 'Expired payload should not register handoff_exchange_started_ms');
        
        assert.ok((global as any).lastReplace.includes('handoff_error=expired'));
    });
    await t.test('3. Incorrect appId fails with "invalid"', async () => {
        setupUrl({ 
            appId: 'otherapp', protocolVersion: '1.0.0', 
            userId: 'user_123', customToken: 'token_123', 
            expiresAt: Date.now() + 10000 
        });
        
        try { await consumeHandoff(); } catch (e) {}
        
        const snapshot = getStartupTelemetrySnapshot();
        const startedEvents = snapshot.filter(e => e.metric === 'handoff_exchange_started_ms');
        assert.strictEqual(startedEvents.length, 0, 'Incorrect appId should not register handoff_exchange_started_ms');
        
        assert.ok((global as any).lastReplace.includes('handoff_error=invalid'));
    });
    await t.test('4. Incompatible protocol fails with "invalid"', async () => {
        setupUrl({ 
            appId: 'musicscale', protocolVersion: '2.0.0', 
            userId: 'user_123', customToken: 'token_123', 
            expiresAt: Date.now() + 10000 
        });
        
        try { await consumeHandoff(); } catch (e) {}
        assert.ok((global as any).lastReplace.includes('handoff_error=invalid'));
    });
    await t.test('5. Missing token fails with "invalid"', async () => {
        setupUrl({ 
            appId: 'musicscale', protocolVersion: '1.0.0', 
            userId: 'user_123', 
            expiresAt: Date.now() + 10000 
        });
        
        try { await consumeHandoff(); } catch (e) {}
        assert.ok((global as any).lastReplace.includes('handoff_error=invalid'));
    });
    await t.test('6. Missing userId fails with "invalid"', async () => {
        setupUrl({ 
            appId: 'musicscale', protocolVersion: '1.0.0', 
            customToken: 'token_123', 
            expiresAt: Date.now() + 10000 
        });
        
        try { await consumeHandoff(); } catch (e) {}
        assert.ok((global as any).lastReplace.includes('handoff_error=invalid'));
    });
    await t.test('7. UID mismatch fails with "invalid"', async () => {
        setupUrl({ 
            appId: 'musicscale', protocolVersion: '1.0.0', 
            userId: 'user_123', customToken: 'token_123', 
            expiresAt: Date.now() + 10000,
            user: { uid: 'different_user' }
        });
        
        try { await consumeHandoff(); } catch (e) {}
        assert.ok((global as any).lastReplace.includes('handoff_error=invalid'));
    });
    await t.test('8. Invalid Base64 fails with "invalid"', async () => {
        setupUrl('not_valid_base64_%$#', true);
        
        try { await consumeHandoff(); } catch (e) {}
        assert.ok((global as any).lastReplace.includes('handoff_error=invalid'));
    });
    await t.test('9. Invalid JSON fails with "invalid"', async () => {
        setupUrl(Buffer.from('not json').toString('base64'), true);
        
        try { await consumeHandoff(); } catch (e) {}
        assert.ok((global as any).lastReplace.includes('handoff_error=invalid'));
    });
    await t.test('10. Payload > 32KiB fails with "invalid"', async () => {
        const largeString = 'a'.repeat(33000);
        setupUrl(largeString, true);
        
        try { await consumeHandoff(); } catch (e) {}
        assert.ok((global as any).lastReplace.includes('handoff_error=invalid'));
    });
    await t.test('11. StrictMode behavior returns same Promise and does not contain ecosystem_ctx in error URL', async () => {
        setupUrl({ 
            appId: 'musicscale', protocolVersion: '1.0.0', 
            userId: 'user_123', customToken: 'token_123', 
            expiresAt: Date.now() + 10000 
        });
        
        // Call first time
        const promise1 = consumeHandoff();
        
        // Simulate URL already cleaned
        (global as any).window.location.search = '?other=123';
        
        // Call second time
        const promise2 = consumeHandoff();
        
        assert.strictEqual(promise1, promise2, 'Second call should return exact same Promise');
        
        try { await promise1; } catch(e) {}
        
        const snapshot = getStartupTelemetrySnapshot();
        const startedEvents = snapshot.filter(e => e.metric === 'handoff_exchange_started_ms');
        assert.strictEqual(startedEvents.length, 1, 'StrictMode should register only one handoff_exchange_started_ms');
        
        assert.ok(!(global as any).lastReplace.includes('ecosystem_ctx'), 'Error URL must not contain ecosystem_ctx');
    });
});`
  },
  'test_ms_perf_2.ts': {
    target: '1ba805087939641d77d9517671ff4d61126c689d',
    content: `import test from 'node:test';
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
    assert.strictEqual(key, \\\`musicscale:music-data:v2:\\$\\{uid\\}:\\$\\{orgId\\}\\\`);
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
});`
  },
  'test_ms_perf_3.ts': {
    target: '03bfe1970524aa4d24b6ad7d0ff27f9b321b6593',
    content: `import { 
  markStartupMetric, 
  incrementStartupCounter, 
  markStartupFailure, 
  recordStartupGauge,
  drainStartupTelemetry, 
  subscribeStartupTelemetry, 
  unsubscribeStartupTelemetry, 
  _resetStartupTelemetry,
  getStartupTelemetrySnapshot
} from './lib/startupTelemetry';
function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(msg);
    process.exit(1);
  }
}
function runTests() {
  console.log("Running MS-PERF-3 tests...");
  // 1 & 2: milestone registered only once & StrictMode no duplication
  _resetStartupTelemetry();
  markStartupMetric('test_milestone', { entry_mode: 'direct' });
  markStartupMetric('test_milestone', { entry_mode: 'handoff' });
  let events = getStartupTelemetrySnapshot();
  assert(events.length === 1, "Milestone should be registered only once");
  assert((events[0].attributes as any)?.entry_mode === 'direct', "First milestone attributes should be kept");
  // 3: counter can increment
  _resetStartupTelemetry();
  incrementStartupCounter('test_counter');
  incrementStartupCounter('test_counter');
  events = getStartupTelemetrySnapshot();
  assert(events.length === 2, "Counter should increment twice");
  // 4: buffer never exceeds 40 events
  _resetStartupTelemetry();
  for (let i = 0; i < 50; i++) {
    incrementStartupCounter('spam_counter');
  }
  events = getStartupTelemetrySnapshot();
  assert(events.length === 40, "Buffer should not exceed 40 events");
  // 5: drain returns events and clears buffer, but snapshot remains intact
  _resetStartupTelemetry();
  incrementStartupCounter('test_drain');
  const drained = drainStartupTelemetry();
  assert(drained.length === 1, "Drain should return 1 event");
  assert(getStartupTelemetrySnapshot().length === 1, "Snapshot should be intact after drain");
  const drainedAgain = drainStartupTelemetry();
  assert(drainedAgain.length === 0, "Buffer should be empty on second drain");
  assert(getStartupTelemetrySnapshot().length === 1, "Snapshot should still be intact after second drain");
  // 6 & 7: subscribe/unsubscribe
  _resetStartupTelemetry();
  let received = 0;
  let activeListeners: any[] = [];
  const listener = () => { received++; };
  // Mock window for CustomEvent if not in browser
  if (typeof window === 'undefined') {
     (global as any).window = {
        addEventListener: (name: string, fn: any) => { activeListeners.push(fn); },
        removeEventListener: (name: string, fn: any) => { activeListeners = activeListeners.filter(l => l !== fn); },
        dispatchEvent: (ev: any) => { activeListeners.forEach(fn => fn(ev)); }
     };
  }
  subscribeStartupTelemetry(listener as any);
  incrementStartupCounter('test_sub');
  assert(received === 1, "Listener should receive event");
  unsubscribeStartupTelemetry(listener as any);
  incrementStartupCounter('test_sub_2');
  assert(received === 1, "Listener should not receive event after unsubscribe");
  
  if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
      delete (global as any).window; // cleanup mock
  }
  // 8, 9, 10, 11: attributes not permitted are removed
  _resetStartupTelemetry();
  markStartupMetric('test_attrs', { 
    token: 'secret', 
    email: 'test@example.com', 
    uid: '123', 
    organizationId: 'org123',
    entry_mode: 'direct',
    standalone: true
  });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.token === undefined, "token should be removed");
  assert((events[0].attributes as any)?.email === undefined, "email should be removed");
  assert((events[0].attributes as any)?.uid === undefined, "uid should be removed");
  assert((events[0].attributes as any)?.organizationId === undefined, "organizationId should be removed");
  assert((events[0].attributes as any)?.entry_mode === 'direct', "entry_mode should be kept");
  assert((events[0].attributes as any)?.standalone === true, "standalone should be kept");
  // 12: raw error message not accepted
  _resetStartupTelemetry();
  markStartupFailure('some raw error message');
  events = getStartupTelemetrySnapshot();
  assert(events.length === 0, "markStartupFailure with unknown code should not create event");
  // 13: negative cache_age_ms normalized
  _resetStartupTelemetry();
  recordStartupGauge('test_cache_age', -500, { cache_age_ms: -500 });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.cache_age_ms === undefined, "negative cache_age_ms should be removed/undefined");
  // 14 & 15: no window/sessionStorage handles gracefully
  // tested by running this file in node
  // 16: startup_failure_reason only enumerations
  _resetStartupTelemetry();
  markStartupFailure('chunk_load_failure');
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.failure_reason === 'chunk_load_failure', "enumerated failure should be kept");
  // 17: snapshot no sensitive data
  // verified by 8-11.
  // MS-PERF-3-FIX-1 new tests
  _resetStartupTelemetry();
  recordStartupGauge('test_gauge', 42);
  events = getStartupTelemetrySnapshot();
  assert(events[0].kind === 'gauge', "gauge should have kind gauge");
  assert(events[0].value === 42, "gauge should preserve numerical value");
  _resetStartupTelemetry();
  recordStartupGauge('test_gauge_dup', 10);
  recordStartupGauge('test_gauge_dup', 20);
  events = getStartupTelemetrySnapshot();
  assert(events.length === 1, "gauge of the same name should not duplicate");
  assert(events[0].value === 10, "gauge should keep first value");
  _resetStartupTelemetry();
  recordStartupGauge('test_gauge_dup', 30);
  events = getStartupTelemetrySnapshot();
  assert(events.length === 1, "reset allows recording gauge again");
  assert(events[0].value === 30, "reset allows new value");
  _resetStartupTelemetry();
  recordStartupGauge('cache_hit', 1, { cache_hit: 'true' as any }); // string instead of boolean
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.cache_hit === undefined, "cache_hit accepts only boolean");
  _resetStartupTelemetry();
  recordStartupGauge('cache_hit2', 1, { cache_status: 'foo' as any });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.cache_status === undefined, "invalid cache_status is removed");
  _resetStartupTelemetry();
  markStartupMetric('test_entry_mode', { entry_mode: 'invalid' as any });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.entry_mode === undefined, "invalid entry_mode is removed");
  _resetStartupTelemetry();
  markStartupMetric('test_standalone', { standalone: 1 as any });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.standalone === undefined, "invalid standalone is removed");
  _resetStartupTelemetry();
  recordStartupGauge('test_cache_age2', 500, { cache_age_ms: NaN });
  events = getStartupTelemetrySnapshot();
  assert((events[0].attributes as any)?.cache_age_ms === undefined, "NaN cache_age_ms is refused");
  console.log("All MS-PERF-3 tests passed.");
}
runTests();`
  },
  'test_ms_perf_4b.ts': {
    target: 'c8184ae03f376da8da66e0e7fd361cc074c989ce',
    content: `import { getCandidateOrganizationIds, isValidCanonicalResponse } from './services/ecosystem/startupFastPath';
import * as fs from 'fs';
import * as path from 'path';
function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}
function runTests() {
    console.log("Running MS-PERF-4B-FIX-1 tests...");
    // 1. ordem e deduplicação dos candidatos;
    const candidates = getCandidateOrganizationIds('local_org', 'active_org', 'local_org', null);
    assert(candidates.length === 2, "Should remove duplicates and empty values");
    assert(candidates[0] === 'local_org', "Should preserve precedence (local first)");
    assert(candidates[1] === 'active_org', "Should preserve precedence (active second)");
    // 2. ausência total de candidatos;
    const emptyCandidates = getCandidateOrganizationIds('', null, undefined, '  ');
    assert(emptyCandidates.length === 0, "Should ignore empty candidates");
    // 3. resposta canônica exata válida;
    const validRes = {
        success: true,
        uid: 'user123',
        organizationId: 'org123'
    };
    assert(isValidCanonicalResponse(validRes, 'user123', 'org123') === true, "Valid response should be accepted");
    // 4. resposta válida usando effectiveContext;
    const validResWithCtx = {
        success: true,
        effectiveContext: {
            userId: 'user123',
            organizationId: 'org123'
        }
    };
    assert(isValidCanonicalResponse(validResWithCtx, 'user123', 'org123') === true, "Valid response with effectiveContext should be accepted");
    // 5. success false rejeitado;
    const invalidSuccess = {
        success: false,
        uid: 'user123',
        organizationId: 'org123'
    };
    assert(isValidCanonicalResponse(invalidSuccess, 'user123', 'org123') === false, "Success false should be rejected");
    // 6. success true sem UID rejeitado;
    const noUidRes = {
        success: true,
        organizationId: 'org123'
    };
    assert(isValidCanonicalResponse(noUidRes, 'user123', 'org123') === false, "Success true without UID rejected");
    // 7. success true sem organizationId rejeitado;
    const noOrgRes = {
        success: true,
        uid: 'user123'
    };
    assert(isValidCanonicalResponse(noOrgRes, 'user123', 'org123') === false, "Success true without OrgID rejected");
    // 8. UID divergente rejeitado;
    const diffUidRes = {
        success: true,
        uid: 'otherUser',
        organizationId: 'org123'
    };
    assert(isValidCanonicalResponse(diffUidRes, 'user123', 'org123') === false, "Different UID should be rejected");
    // 9. organização divergente rejeitada;
    const diffOrgRes = {
        success: true,
        uid: 'user123',
        organizationId: 'otherOrg'
    };
    assert(isValidCanonicalResponse(diffOrgRes, 'user123', 'org123') === false, "Different OrgID should be rejected");
    // 10. UID conflitante entre raiz e effectiveContext rejeitado;
    const conflictUidRes = {
        success: true,
        uid: 'user123',
        effectiveContext: {
            userId: 'otherUser',
            organizationId: 'org123'
        }
    };
    assert(isValidCanonicalResponse(conflictUidRes, 'user123', 'org123') === false, "Conflicting UID should be rejected");
    // 11. organização conflitante entre raiz e effectiveContext rejeitada;
    const conflictOrgRes = {
        success: true,
        uid: 'user123',
        organizationId: 'org123',
        effectiveContext: {
            userId: 'user123',
            organizationId: 'otherOrg'
        }
    };
    assert(isValidCanonicalResponse(conflictOrgRes, 'user123', 'org123') === false, "Conflicting OrgID should be rejected");
    // 12. UID e organização vazios rejeitados;
    const emptyFieldsRes = {
        success: true,
        uid: '',
        organizationId: ''
    };
    assert(isValidCanonicalResponse(emptyFieldsRes, 'user123', 'org123') === false, "Empty fields should be rejected");
    // 13. payload null ou malformado rejeitado.
    assert(isValidCanonicalResponse(null, 'user123', 'org123') === false, "Null payload rejected");
    assert(isValidCanonicalResponse({}, 'user123', 'org123') === false, "Malformed payload rejected");
    // Executable checks on EcosystemContext.tsx
    const contextFile = fs.readFileSync(path.join(process.cwd(), 'contexts/EcosystemContext.tsx'), 'utf-8');
    
    // - não existe buildEffectiveAccessContext aplicado a parsed/cache;
    assert(!contextFile.includes('buildEffectiveAccessContext(user.uid, parsed.currentOrganizationId'), "Should not apply buildEffectiveAccessContext to parsed cache");
    
    // - não existe buildEffectiveAccessContext aplicado ao offlineDefault;
    assert(!contextFile.includes('buildEffectiveAccessContext(user.uid, offlineDefault.currentOrganizationId'), "Should not apply buildEffectiveAccessContext to offlineDefault");
    
    // - o fallback offline não usa papel owner;
    assert(contextFile.includes("roleInCurrentOrganization: 'none'") || !contextFile.includes("roleInCurrentOrganization: 'owner'"), "Offline fallback should not use owner role");
    assert(contextFile.includes("ecosystemRole: 'none'") || !contextFile.includes("ecosystemRole: isCeoFallback ? 'ceo' : 'user'"), "Offline fallback should not use ceo/user role");
    
    // - existe timeout de 5.000 ms no early fetch;
    assert(contextFile.includes('setTimeout(() => earlyAbortController?.abort(), 5000)'), "Early fetch must have 5000ms timeout");
    
    // - não existe currentGeneration = Symbol() sem uso;
    assert(!contextFile.includes('const currentGeneration = Symbol()'), "Should not use unused Symbol generation");
    
    // - não existe getIdToken(true).
    assert(!contextFile.includes('getIdToken(true)'), "Should not use getIdToken(true)");
    // test presence of real generation
    assert(contextFile.includes('let activeGeneration = 0;'), "Must have real activeGeneration counter");
    assert(contextFile.includes('const currentGeneration = ++activeGeneration;'), "Must increment generation");
    // FIX-2 TEST CASES
    // 1. uid vazio na raiz + UID válido no effectiveContext deve ser rejeitado;
    const emptyUidWithCtx = {
        success: true,
        uid: '',
        organizationId: 'org123',
        effectiveContext: { userId: 'user123' }
    };
    assert(isValidCanonicalResponse(emptyUidWithCtx, 'user123', 'org123') === false, "Empty UID in root with valid ctx should be rejected");
    // 2. organizationId vazio na raiz + organização válida no effectiveContext deve ser rejeitado;
    const emptyOrgWithCtx = {
        success: true,
        uid: 'user123',
        organizationId: '',
        effectiveContext: { organizationId: 'org123' }
    };
    assert(isValidCanonicalResponse(emptyOrgWithCtx, 'user123', 'org123') === false, "Empty OrgID in root with valid ctx should be rejected");
    // 3. UID contendo somente espaços deve ser rejeitado;
    const spacesUid = { success: true, uid: '   ', organizationId: 'org123' };
    assert(isValidCanonicalResponse(spacesUid, '   ', 'org123') === false, "Spaces UID should be rejected");
    // 4. organização contendo somente espaços deve ser rejeitada;
    const spacesOrg = { success: true, uid: 'user123', organizationId: '   ' };
    assert(isValidCanonicalResponse(spacesOrg, 'user123', '   ') === false, "Spaces OrgID should be rejected");
    // 5. UID null deve ser rejeitado;
    const nullUid = { success: true, uid: null, organizationId: 'org123' };
    assert(isValidCanonicalResponse(nullUid, 'user123', 'org123') === false, "Null UID should be rejected");
    // 6. organizationId null deve ser rejeitado;
    const nullOrg = { success: true, uid: 'user123', organizationId: null };
    assert(isValidCanonicalResponse(nullOrg, 'user123', 'org123') === false, "Null OrgID should be rejected");
    // 7. UID numérico deve ser rejeitado;
    const numUid = { success: true, uid: 123, organizationId: 'org123' };
    assert(isValidCanonicalResponse(numUid, '123', 'org123') === false, "Numeric UID should be rejected");
    // 8. organizationId numérico deve ser rejeitado;
    const numOrg = { success: true, uid: 'user123', organizationId: 123 };
    assert(isValidCanonicalResponse(numOrg, 'user123', '123') === false, "Numeric OrgID should be rejected");
    // 9. resposta totalmente válida deve continuar aceita;
    const validFullRes = {
        success: true,
        uid: 'user123',
        organizationId: 'org123',
        effectiveContext: {
            userId: 'user123',
            organizationId: 'org123'
        }
    };
    assert(isValidCanonicalResponse(validFullRes, 'user123', 'org123') === true, "Fully valid response should be accepted");
    // 10. cache sanitizado não pode incluir serverContext;
    const cachePayloadBlockMatch = contextFile.match(/const cachePayload = \\{[^}]+\\}/);
    assert(cachePayloadBlockMatch !== null && !cachePayloadBlockMatch[0].includes("serverContext"), "Sanitized cache cannot include serverContext");
    // 11. restauração deve sobrescrever serverContext com null;
    assert(contextFile.includes('serverContext: null,'), "Cache restore must overwrite serverContext with null");
    // 12. localStorage.setItem deve estar protegido pela geração ativa;
    assert(contextFile.includes("if (mounted && currentGeneration === activeGeneration && auth.currentUser?.uid === user.uid && orgId && orgId !== 'offline_default') {") && contextFile.includes("localStorage.setItem('musicscale_cached_context_' + user.uid"), "localStorage.setItem must be protected by active generation and conditions");
    // 13. incremento da geração deve ocorrer antes de if (user);
    assert(!!contextFile.match(/const currentGeneration = \\+\\+activeGeneration;\\s*if\\s*\\(user\\)/), "Generation must be incremented before if (user)");
    // 14. earlyCanonicalPromise deve limpar timeout em todos os caminhos;
    assert(contextFile.includes('.finally(() => { clearTimeout(earlyTimeoutId); })'), "earlyCanonicalPromise must clean timeout in all paths");
    // 15. não existe getIdToken(true);
    assert(!contextFile.includes('getIdToken(true)'), "getIdToken(true) must not exist");
    // 16. permissões do cache e offline continuam totalmente negadas.
    assert(contextFile.includes('permissions: DENIED_PERMISSIONS'), "Cache and offline permissions must remain totally denied");
    console.log("All MS-PERF-4B-FIX-1 and FIX-2 tests passed.");
}
runTests();`
  },
  'test_ms_perf_5.ts': {
    target: 'ab842cb9497ffc70ca38c1d19ab854d0ebdb68f0',
    content: `import fs from 'fs';
import { resolveMembershipRoleAndStatus } from './services/ecosystem/accessContextResolver.js';
function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}
function runTests() {
    console.log("Running MS-PERF-5-FIX-1 tests...");
    // Test cases for resolveMembershipRoleAndStatus (FIX-1)
    
    // 1. membership direta com role continua tendo precedência;
    let res = resolveMembershipRoleAndStatus('user1', {}, { role: 'admin', status: 'active' }, { role: 'viewer', status: 'active' }, { role: 'musician', status: 'active' });
    assert(res.role === 'admin' && res.status === 'active', "1. Direct membership with role must have precedence");
    // 2. membership direta com organizationRole continua tendo precedência;
    res = resolveMembershipRoleAndStatus('user1', {}, { organizationRole: 'admin', status: 'active' }, { role: 'viewer', status: 'active' }, null);
    assert(res.role === 'admin' && res.status === 'active', "2. Direct membership with organizationRole must have precedence");
    // 3. documento direto existente sem papel permite usar crossMemberData1;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'inactive' }, { role: 'viewer', status: 'active' }, { role: 'musician', status: 'active' });
    assert(res.role === 'viewer' && res.status === 'active', "3. Direct document without role allows using crossMemberData1");
    // 4. documento direto sem papel e crossMemberData1 sem papel permitem usar crossMemberData2;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'inactive' }, { status: 'inactive' }, { role: 'musician', status: 'active' });
    assert(res.role === 'musician' && res.status === 'active', "4. Direct and cross1 without role allow using crossMemberData2");
    // 5. crossMemberData1 com organizationRole é usado antes de crossMemberData2;
    res = resolveMembershipRoleAndStatus('user1', {}, null, { organizationRole: 'viewer', status: 'active' }, { role: 'musician', status: 'active' });
    assert(res.role === 'viewer' && res.status === 'active', "5. crossMemberData1 with organizationRole is used before crossMemberData2");
    // 6. status vem da fonte que efetivamente forneceu o papel;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'inactive' }, { role: 'viewer', status: 'pending' }, { role: 'musician', status: 'active' });
    assert(res.role === 'viewer' && res.status === 'pending', "6. Status comes from the source that actually provided the role");
    // 7. fonte selecionada sem status usa active;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'inactive' }, { role: 'viewer' }, { role: 'musician', status: 'active' });
    assert(res.role === 'viewer' && res.status === 'active', "7. Selected source without status uses active");
    // 8. documento direto sem papel e sem alternativas mantém role null;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'inactive' }, null, null);
    assert(res.role === null, "8. Direct document without role and no alternatives keeps role null");
    // 9. nenhum documento retorna role null e status null;
    res = resolveMembershipRoleAndStatus('user1', {}, null, null, null);
    assert(res.role === null && res.status === null, "9. No document returns role null and status null");
    // 10. quando nenhum documento possui papel, o status legado da última fonte existente é preservado;
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'status_dir' }, { status: 'status_cr1' }, { status: 'status_cr2' });
    assert(res.role === null && res.status === 'status_cr2', "10a. Legacy status from last existing source is preserved (cr2)");
    
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'status_dir' }, { status: 'status_cr1' }, null);
    assert(res.role === null && res.status === 'status_cr1', "10b. Legacy status from last existing source is preserved (cr1)");
    res = resolveMembershipRoleAndStatus('user1', {}, { status: 'status_dir' }, null, null);
    assert(res.role === null && res.status === 'status_dir', "10c. Legacy status from last existing source is preserved (dir)");
    res = resolveMembershipRoleAndStatus('user1', {}, { some_field: true }, null, null);
    assert(res.role === null && res.status === 'active', "10d. Legacy status without explicit status uses active");
    // 11. ownerUid continua sobrescrevendo tudo;
    res = resolveMembershipRoleAndStatus('user1', { ownerUid: 'user1' }, { role: 'viewer', status: 'inactive' }, null, null);
    assert(res.role === 'owner' && res.status === 'active', "11. ownerUid must override anything");
    // 12. ownerId continua sobrescrevendo tudo;
    res = resolveMembershipRoleAndStatus('user1', { ownerId: 'user1' }, { role: 'viewer', status: 'inactive' }, null, null);
    assert(res.role === 'owner' && res.status === 'active', "12. ownerId must override anything");
    // 13. owner sempre recebe status active;
    res = resolveMembershipRoleAndStatus('user1', { ownerId: 'user1' }, { role: 'viewer', status: 'inactive' }, null, null);
    assert(res.role === 'owner' && res.status === 'active', "13. Owner must always get active status");
    const resolverFile = fs.readFileSync('./services/ecosystem/accessContextResolver.ts', 'utf8');
    // 14. helper não acessa Firebase, rede ou armazenamento;
    assert(!resolverFile.includes('firebase') && !resolverFile.includes('fetch') && !resolverFile.includes('localStorage') && !resolverFile.includes('db.'), "14. Helper must not access Firebase, network, or storage");
    const serverFile = fs.readFileSync('./server.ts', 'utf8');
    const startIndex = serverFile.indexOf('app.get("/api/v1/ecosystem/access-context"');
    const endIndex = serverFile.indexOf('app.post("/api/orgs/create"', startIndex);
    const endpointBlock = serverFile.substring(startIndex, endIndex);
    // 14. server.ts usa Promise.all na primeira onda;
    assert(endpointBlock.includes('const [userSnap, orgSnap, orgMemberSnap, rbacModule, resolverModule] = await Promise.all(['), "server.ts must use Promise.all in the first wave");
    // 15. fallback de membership usa Promise.all;
    assert(endpointBlock.includes('const [cross1, cross2] = await Promise.all(['), "Membership fallback must use Promise.all");
    // 16. fallback não é executado quando a membership direta já resolveu o papel;
    assert(endpointBlock.includes('if (!hasDirectRole) {') || endpointBlock.includes('if(!hasDirectRole){'), "Fallback must not be executed when direct membership resolved the role");
    // 17. não existe localStorage ou sessionStorage no endpoint;
    assert(!endpointBlock.includes('localStorage') && !endpointBlock.includes('sessionStorage'), "No localStorage or sessionStorage in the endpoint");
    // 18. não existe consulta a Stripe, subscriptions ou billing dentro do endpoint;
    assert(!endpointBlock.includes('stripe') && !endpointBlock.includes('subscriptions') && !endpointBlock.includes('billing'), "No Stripe, subscriptions, or billing queries in the endpoint");
    // 19. verifyIdToken ocorre antes das leituras canônicas;
    const verifyIndex = endpointBlock.indexOf('verifyIdToken');
    const getIndex = endpointBlock.indexOf('db.collection("users")');
    assert(verifyIndex < getIndex, "verifyIdToken must occur before canonical reads");
    // 20. resposta mantém todos os campos obrigatórios;
    const responseBlock = endpointBlock.substring(endpointBlock.indexOf('res.json({'), endpointBlock.indexOf('});', endpointBlock.indexOf('res.json({')));
    assert(responseBlock.includes('success:') &&
           responseBlock.includes('correlationId,') &&
           responseBlock.includes('userId:') &&
           responseBlock.includes('organizationId:') &&
           responseBlock.includes('systemRole,') &&
           responseBlock.includes('organizationRole:') &&
           responseBlock.includes('membershipStatus,') &&
           responseBlock.includes('musicScaleProfile,') &&
           responseBlock.includes('isGlobalAccess:') &&
           responseBlock.includes('isOrganizationAdmin:') &&
           responseBlock.includes('effectiveCapabilities:') &&
           responseBlock.includes('accessSource:') &&
           responseBlock.includes('resolutionStatus:') &&
           responseBlock.includes('version:') &&
           responseBlock.includes('effectiveContext:'), "Response must maintain all required fields");
    // 21. nenhum token é registrado;
    assert(!endpointBlock.includes('console.log(token)') && !endpointBlock.includes('logger.info(token)'), "No token should be logged");
    // 22. Server-Timing não contém identificadores ou payloads.
    const timingBlock = endpointBlock.substring(endpointBlock.indexOf("res.set('Server-Timing'"), endpointBlock.indexOf(")", endpointBlock.indexOf("res.set('Server-Timing'")));
    assert(!timingBlock.includes('uid') && !timingBlock.includes('orgId') && !timingBlock.includes('token'), "Server-Timing must not contain identifiers or payloads");
    // 23. Ambos os headers Server-Timing e X-MusicScale-Timing usam timingValue
    assert(endpointBlock.includes("res.set('Server-Timing', timingValue);"), "Server-Timing must use timingValue");
    assert(endpointBlock.includes("res.set('X-MusicScale-Timing', timingValue);"), "X-MusicScale-Timing must use timingValue");
    // 24. Sanitização de timingValue existe
    assert(endpointBlock.includes("const sanitizeDuration = (value: number) =>"), "sanitizeDuration function must exist");
    assert(endpointBlock.includes("Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;"), "sanitizeDuration logic must exist");
    // 25. timingValue tem o formato correto
    assert(endpointBlock.includes("const timingValue = ["), "timingValue array must exist");
    assert(endpointBlock.includes("\\\`auth;dur=\\$\\{sanitizeDuration(durAuth)\\}\\\`"), "timingValue must include auth");
    assert(endpointBlock.includes("\\\`primary_reads;dur=\\$\\{sanitizeDuration(durPrimary)\\}\\\`"), "timingValue must include primary_reads");
    assert(endpointBlock.includes("\\\`membership_fallback;dur=\\$\\{sanitizeDuration(durFallback)\\}\\\`"), "timingValue must include membership_fallback");
    assert(endpointBlock.includes("\\\`access_resolution;dur=\\$\\{sanitizeDuration(durResolve)\\}\\\`"), "timingValue must include access_resolution");
    assert(endpointBlock.includes("\\\`total;dur=\\$\\{sanitizeDuration(durTotal)\\}\\\`"), "timingValue must include total");
    console.log("All MS-PERF-5 tests passed.");
}
runTests();`
  },
  'test_ms_perf_6.ts': {
    target: 'e743d0ca110d0b4bf03fd4b0a662c6955b3565c3',
    content: `import fs from 'fs';
import { isGlobalOrganizationCatalogRole } from './services/ecosystem/startupFastPath.js';
function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
}
function runTests() {
    console.log("Running MS-PERF-6 tests...");
    // 1. isGlobalOrganizationCatalogRole aceita todos os dez papéis autorizados.
    const validRoles = ['ceo', 'founder', 'ecosystem_owner', 'owner', 'dono', 'admin', 'global_admin', 'administrador', 'support', 'suporte'];
    for (const role of validRoles) {
        assert(isGlobalOrganizationCatalogRole(role), \\\`1. Should accept \\$\\{role\\}\\\`);
    }
    // 2. Normalização de maiúsculas e espaços.
    assert(isGlobalOrganizationCatalogRole(' CEO '), "2. Should normalize CEO");
    assert(isGlobalOrganizationCatalogRole('Founder  '), "2. Should normalize Founder");
    assert(isGlobalOrganizationCatalogRole('  ADMINISTRADOR'), "2. Should normalize ADMINISTRADOR");
    // 3. Papéis comuns e valores inválidos retornam false.
    assert(!isGlobalOrganizationCatalogRole('member'), "3. Should reject member");
    assert(!isGlobalOrganizationCatalogRole('visitor'), "3. Should reject visitor");
    assert(!isGlobalOrganizationCatalogRole('musician'), "3. Should reject musician");
    assert(!isGlobalOrganizationCatalogRole(''), "3. Should reject empty");
    assert(!isGlobalOrganizationCatalogRole(null), "3. Should reject null");
    assert(!isGlobalOrganizationCatalogRole(undefined), "3. Should reject undefined");
    assert(!isGlobalOrganizationCatalogRole({}), "3. Should reject object");
    // 4. Helper não acessa Firebase, fetch, localStorage ou sessionStorage.
    // Verified by running it in a Node context without those globals.
    // 1 & 2. Verificar arquivos test_ms_perf_6.ts duplicados
    assert(!fs.existsSync('app/applet/test_ms_perf_6.ts'), "1. app/applet/test_ms_perf_6.ts should not exist");
    assert(fs.existsSync('test_ms_perf_6.ts'), "2. test_ms_perf_6.ts should exist in the root");
    // Static analysis on EcosystemContext.tsx
    const ecosystemContext = fs.readFileSync('contexts/EcosystemContext.tsx', 'utf-8');
    // 3 & 4. Validating snap.exists() properly
    assert(ecosystemContext.includes('typeof snap.exists === \\\\'function\\\\''), "3/4. Must verify snap.exists is a function");
    assert(ecosystemContext.includes('snap.exists()'), "3/4. Must call snap.exists()");
    assert(!ecosystemContext.match(/if \\\\(snap && snap\\\\.exists\\\\) /), "4. Must not accept just snap.exists presence");
    // 5-9. Fallbacks and exists() logic
    assert(ecosystemContext.includes('getReusableOrganizationSnapshot = async (targetOrgId: string)'), "5-9. Must have getReusableOrganizationSnapshot helper");
    assert(ecosystemContext.includes('if (targetOrgId === candidateOrgId && earlyOrgDocPromise)'), "9. Must check earlyOrgDocPromise");
    assert(ecosystemContext.includes('return getDoc(doc(db, \\\\'organizations\\\\', targetOrgId)).catch(() => null);'), "6/7/8. Must fallback to getDoc");
    // 11 (was 5). A Promise do catálogo global é criada antes do array das consultas de descoberta.
    const globalPromiseIndex = ecosystemContext.indexOf('earlyGlobalCatalogPromise = getDocs(collection(db, \\\\'organizations\\\\'))');
    const queriesArrayIndex = ecosystemContext.indexOf('const queries = [');
    assert(globalPromiseIndex > -1 && queriesArrayIndex > -1 && globalPromiseIndex < queriesArrayIndex, "11. earlyGlobalCatalogPromise must be created before queries array");
    // A Promise iniciada antecipadamente é reutilizada no bloco global.
    assert(ecosystemContext.includes('const allOrgsSnap = await earlyGlobalCatalogPromise'), "Must reuse earlyGlobalCatalogPromise");
    // 10 (was 7). Não existe uma segunda consulta global de organizations no bootstrap.
    const countAllOrgsFetch = (ecosystemContext.match(/getDocs\\\\(collection\\\\(db, 'organizations'\\\\)\\\\)/g) || []).length;
    assert(countAllOrgsFetch === 1, "10. Must have exactly one getDocs(collection(db, 'organizations'))");
    // Leituras de plano utilizam o helper reutilizável.
    const getPlMatches = (ecosystemContext.match(/const getPl = await getReusableOrganizationSnapshot\\\\(orgId\\\\);/g) || []).length;
    assert(getPlMatches >= 4, "Plan reads must use getReusableOrganizationSnapshot");
    // 12. Não existe getIdToken(true).
    assert(!ecosystemContext.includes('getIdToken(true)'), "12. Must not include getIdToken(true)");
    // 13. Resposta canônica continua obrigatória para permissões.
    assert(ecosystemContext.includes('if (isValidCanonicalResponse('), "13. Must require isValidCanonicalResponse");
    
    // 14 & 15. Endpoints
    assert(!ecosystemContext.includes('/api/check_membership'), "14. Must not include /api/check_membership");
    assert(ecosystemContext.includes('/api/v1/ecosystem/access-context'), "15. Must use /api/v1/ecosystem/access-context");
    // Outras variáveis de estado e segurança
    assert(ecosystemContext.includes('AbortController'), "AbortController must be present");
    assert(ecosystemContext.includes('mounted = true'), "mounted must be present");
    assert(ecosystemContext.includes('currentGeneration'), "currentGeneration must be present");
    const isInitializedMatches = (ecosystemContext.match(/setIsInitialized\\\\(true\\\\)/g) || []).length;
    assert(isInitializedMatches > 0, "isInitialized must be managed properly");
    assert(ecosystemContext.includes('Sincronizando Ecossistema...'), "Visual contract preserved");
    console.log("All MS-PERF-6 tests passed.");
}
runTests();`
  }
};

let allMatched = true;

for (const [filename, info] of Object.entries(files)) {
  if (filename === 'test_tenant_boundaries.ts') continue;
  
  let found = false;
  // Variations to try:
  // - 0, 1, 2 trailing newlines
  // - replacing `  \n` with `\n` or keeping it
  // - removing trailing spaces on all lines
  // - adding spaces to empty lines (0, 4)
  
  for (let newlines = 0; newlines <= 2; newlines++) {
    for (let trimEnd = 0; trimEnd < 2; trimEnd++) {
      for (let emptyLineSpaces = 0; emptyLineSpaces < 5; emptyLineSpaces++) {
        
        let v = info.content;
        
        if (trimEnd === 1) {
          v = v.split('\n').map(l => l.trimEnd()).join('\n');
        }
        
        if (emptyLineSpaces > 0 && trimEnd === 0) {
          v = v.replace(/\n\n/g, '\n' + ' '.repeat(emptyLineSpaces) + '\n');
        }
        
        if (newlines === 0) v = v.trimEnd();
        else if (newlines === 1) v = v.trimEnd() + '\n';
        else if (newlines === 2) v = v.trimEnd() + '\n\n';
        
        if (getGitHash(v) === info.target) {
          console.log(`MATCH FOUND for ${filename}`);
          fs.writeFileSync(filename, v);
          found = true;
          break;
        }
      }
      if (found) break;
    }
    if (found) break;
  }
  
  if (!found) {
    console.error(`Not found for ${filename}`);
    allMatched = false;
  }
}

if (!allMatched) {
    process.exit(1);
}
