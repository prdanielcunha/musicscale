import test from 'node:test';
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
    
    const search = payload ? `?ecosystem_ctx=${base64}&${extraParam}` : `?${extraParam}`;
    (global as any).window.location.search = search;
    (global as any).window.location.href = `https://musicscale.app/login${search}#hash`;
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
});
