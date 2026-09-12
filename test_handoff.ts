import test from 'node:test';
import assert from 'node:assert';

// Setup mock browser primitives used by the handoff helper.
const mockReplace = (url: string) => { (global as any).lastReplace = url; };
const mockAssign = (url: string) => { (global as any).lastAssign = url; };
const mockReplaceState = (_state: any, _title: string, url: string) => { (global as any).lastReplaceState = url; };

const sessionStore = new Map<string, string>();
(global as any).sessionStorage = {
    getItem: (key: string) => sessionStore.get(key) ?? null,
    setItem: (key: string, value: string) => { sessionStore.set(key, value); },
    removeItem: (key: string) => { sessionStore.delete(key); },
    clear: () => { sessionStore.clear(); }
};
(global as any).localStorage = { getItem: () => null, setItem: () => null, removeItem: () => null };
(global as any).window = {
    location: {
        search: '',
        href: '',
        pathname: '/login',
        origin: 'https://musicscale.app',
        replace: mockReplace,
        assign: mockAssign
    },
    history: { replaceState: mockReplaceState }
};
(global as any).atob = (str: string) => Buffer.from(str, 'base64').toString('binary');

// Import the module under test.
import { consumeHandoff, resetHandoffForTesting } from './services/ecosystem/handoffHelper.js';
import { _resetStartupTelemetry, getStartupTelemetrySnapshot } from './lib/startupTelemetry.js';

const HUB_LAUNCH = 'https://www.millionsnest.com/apps/musicscale/launch';

function setupUrl(payload: any | string, isRaw = false, extraParam = 'other=123') {
    resetHandoffForTesting();
    _resetStartupTelemetry();
    sessionStore.clear();
    (global as any).lastReplace = '';
    (global as any).lastAssign = '';
    (global as any).lastReplaceState = '';
    (global as any).window.location.pathname = '/login';

    let base64 = '';
    if (isRaw) {
        base64 = payload as string;
    } else if (payload) {
        base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    }

    const search = payload ? `?ecosystem_ctx=${base64}&${extraParam}` : `?${extraParam}`;
    (global as any).window.location.search = search;
    (global as any).window.location.href = `https://musicscale.app/login${search}#hash`;
}

function assertFirstFailureRecoversThroughHub() {
    const replaced = String((global as any).lastReplace || '');
    const url = new URL(replaced);
    assert.strictEqual(`${url.origin}${url.pathname}`, HUB_LAUNCH);
    assert.strictEqual(url.searchParams.get('returnTo'), '/login');
    assert.ok(!replaced.includes('ecosystem_ctx'), 'Hub recovery URL must never contain ecosystem_ctx');
    assert.strictEqual(sessionStore.get('mn_sso_recovery_musicscale'), '1');
}

test('Handoff Parser Tests', async (t) => {
    await t.test('1. Valid payload clears URL and a failed token exchange recovers once through Hub', async () => {
        setupUrl({
            appId: 'musicscale', protocolVersion: '1.0.0',
            userId: 'user_123', customToken: 'token_123',
            expiresAt: Date.now() + 10000
        });

        try { await consumeHandoff(); } catch (e) {}

        const snapshot = getStartupTelemetrySnapshot();
        const startedEvents = snapshot.filter(e => e.metric === 'handoff_exchange_started_ms');
        const completedEvents = snapshot.filter(e => e.metric === 'handoff_exchange_completed_ms');

        assert.strictEqual(startedEvents.length, 1, 'Should register exactly one handoff_exchange_started_ms');
        assert.strictEqual(completedEvents.length, 0, 'Should not register handoff_exchange_completed_ms');
        assert.ok((global as any).lastReplaceState.includes('other=123'));
        assert.ok(!(global as any).lastReplaceState.includes('ecosystem_ctx'));
        assert.ok((global as any).lastReplaceState.includes('#hash'));
        assertFirstFailureRecoversThroughHub();
    });

    await t.test('2. Expired payload recovers through Hub before exchange', async () => {
        setupUrl({
            appId: 'musicscale', protocolVersion: '1.0.0',
            userId: 'user_123', customToken: 'token_123',
            expiresAt: Date.now() - 100000
        });

        try { await consumeHandoff(); } catch (e) {}

        const snapshot = getStartupTelemetrySnapshot();
        const startedEvents = snapshot.filter(e => e.metric === 'handoff_exchange_started_ms');
        assert.strictEqual(startedEvents.length, 0, 'Expired payload should not register handoff_exchange_started_ms');
        assertFirstFailureRecoversThroughHub();
    });

    await t.test('3. Incorrect appId recovers through Hub', async () => {
        setupUrl({
            appId: 'otherapp', protocolVersion: '1.0.0',
            userId: 'user_123', customToken: 'token_123',
            expiresAt: Date.now() + 10000
        });

        try { await consumeHandoff(); } catch (e) {}

        const snapshot = getStartupTelemetrySnapshot();
        const startedEvents = snapshot.filter(e => e.metric === 'handoff_exchange_started_ms');
        assert.strictEqual(startedEvents.length, 0, 'Incorrect appId should not register handoff_exchange_started_ms');
        assertFirstFailureRecoversThroughHub();
    });

    await t.test('4. Incompatible protocol recovers through Hub', async () => {
        setupUrl({
            appId: 'musicscale', protocolVersion: '2.0.0',
            userId: 'user_123', customToken: 'token_123',
            expiresAt: Date.now() + 10000
        });
        try { await consumeHandoff(); } catch (e) {}
        assertFirstFailureRecoversThroughHub();
    });

    await t.test('5. Missing token recovers through Hub', async () => {
        setupUrl({
            appId: 'musicscale', protocolVersion: '1.0.0',
            userId: 'user_123',
            expiresAt: Date.now() + 10000
        });
        try { await consumeHandoff(); } catch (e) {}
        assertFirstFailureRecoversThroughHub();
    });

    await t.test('6. Missing userId recovers through Hub', async () => {
        setupUrl({
            appId: 'musicscale', protocolVersion: '1.0.0',
            customToken: 'token_123',
            expiresAt: Date.now() + 10000
        });
        try { await consumeHandoff(); } catch (e) {}
        assertFirstFailureRecoversThroughHub();
    });

    await t.test('7. UID mismatch recovers through Hub', async () => {
        setupUrl({
            appId: 'musicscale', protocolVersion: '1.0.0',
            userId: 'user_123', customToken: 'token_123',
            expiresAt: Date.now() + 10000,
            user: { uid: 'different_user' }
        });
        try { await consumeHandoff(); } catch (e) {}
        assertFirstFailureRecoversThroughHub();
    });

    await t.test('8. Invalid Base64 recovers through Hub', async () => {
        setupUrl('not_valid_base64_%$#', true);
        try { await consumeHandoff(); } catch (e) {}
        assertFirstFailureRecoversThroughHub();
    });

    await t.test('9. Invalid JSON recovers through Hub', async () => {
        setupUrl(Buffer.from('not json').toString('base64'), true);
        try { await consumeHandoff(); } catch (e) {}
        assertFirstFailureRecoversThroughHub();
    });

    await t.test('10. Payload > 32KiB recovers through Hub', async () => {
        const largeString = 'a'.repeat(33000);
        setupUrl(largeString, true);
        try { await consumeHandoff(); } catch (e) {}
        assertFirstFailureRecoversThroughHub();
    });

    await t.test('11. StrictMode returns the same Promise and never leaks ecosystem_ctx', async () => {
        setupUrl({
            appId: 'musicscale', protocolVersion: '1.0.0',
            userId: 'user_123', customToken: 'token_123',
            expiresAt: Date.now() + 10000
        });

        const promise1 = consumeHandoff();
        (global as any).window.location.search = '?other=123';
        const promise2 = consumeHandoff();

        assert.strictEqual(promise1, promise2, 'Second call should return exact same Promise');
        try { await promise1; } catch (e) {}

        const snapshot = getStartupTelemetrySnapshot();
        const startedEvents = snapshot.filter(e => e.metric === 'handoff_exchange_started_ms');
        assert.strictEqual(startedEvents.length, 1, 'StrictMode should register only one handoff_exchange_started_ms');
        assert.ok(!(global as any).lastReplace.includes('ecosystem_ctx'), 'Recovery URL must not contain ecosystem_ctx');
    });

    await t.test('12. A second failure in the same session fails closed to local login', async () => {
        setupUrl({
            appId: 'otherapp', protocolVersion: '1.0.0',
            userId: 'user_123', customToken: 'token_123',
            expiresAt: Date.now() + 10000
        });
        sessionStore.set('mn_sso_recovery_musicscale', '1');

        try { await consumeHandoff(); } catch (e) {}

        const replaced = String((global as any).lastReplace || '');
        const url = new URL(replaced);
        assert.strictEqual(url.origin, 'https://musicscale.app');
        assert.strictEqual(url.pathname, '/login');
        assert.strictEqual(url.searchParams.get('handoff_error'), 'invalid');
        assert.ok(!replaced.includes('ecosystem_ctx'));
    });
});
