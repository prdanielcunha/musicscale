import assert from 'node:assert/strict';
import { createConnectSupportDraftProxy } from './services/server/connect/supportDraftProxy';
const request = { headers: { authorization: 'Bearer synthetic-user', 'x-organization-id': 'synthetic-org' }, body: { locale: 'pt-BR' } };
let calls = 0, status = 200;
let data: any = { product: 'musicscale', automaticSend: false, expiresAt: Date.now() + 600000, draftUrl: 'https://wa.me/16505550100?text=MusicScale%20support', private: 'PRIVATE' };
const proxy = createConnectSupportDraftProxy(async (url, init) => {
  calls++; assert.equal(url, 'https://connect.millionsnest.com/api/core/support/draft'); assert.equal(init.redirect, 'error');
  assert.equal((init.headers as any).Authorization, request.headers.authorization);
  assert.equal((init.headers as any)['X-Connect-User-Authorization'], request.headers.authorization);
  assert.deepEqual(JSON.parse(String(init.body)), { product: 'musicscale', organizationId: 'synthetic-org', locale: 'pt-BR' });
  return new Response(JSON.stringify(data), { status });
});
function response() { return { code: 200, body: undefined as any, setHeader() {}, status(n: number) { this.code = n; return this; }, json(value: unknown) { this.body = value; return this; } }; }
async function invoke(req: any = request) { const res = response(); await proxy(req, res); return res; }
const ok = await invoke(); assert.equal(ok.code, 200); assert(!JSON.stringify(ok.body).includes('PRIVATE'));
assert.equal((await invoke({ ...request, headers: {} })).code, 401);
for (const body of [{ ...request.body, product: 'nestfinance' }, { ...request.body, role: 'owner' }, { ...request.body, organizationId: 'other' }, { locale: 'bad' }]) assert.equal((await invoke({ ...request, body })).code, 400);
assert.equal(calls, 1);
const valid = { ...data };
for (const change of [{ draftUrl: 'https://evil.test/' }, { draftUrl: 'https://wa.me.evil.test/16505550100' }, { draftUrl: 'https://user@wa.me/16505550100' }, { draftUrl: 'https://wa.me/16505550100?text=support&token=PRIVATE' }, { draftUrl: 'https://wa.me/16505550100?text=synthetic-user' }, { automaticSend: true }, { product: 'nestfinance' }, { expiresAt: 0 }]) {
  data = { ...valid, ...change }; assert.equal((await invoke()).code, 503);
}
for (const upstreamStatus of [401, 403, 404, 409, 500]) { status = upstreamStatus; data = { private: 'PRIVATE' }; const res = await invoke(); assert.equal(res.code, upstreamStatus < 500 ? upstreamStatus : 503); assert(!JSON.stringify(res.body).includes('PRIVATE')); }
console.log('MusicScale support relay: fixed official destination/product, transient identity, injected authority denial, strict manual URL and private failure projection passed');
