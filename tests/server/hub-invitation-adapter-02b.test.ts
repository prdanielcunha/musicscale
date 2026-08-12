import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  HubInvitationAdapter, HubInvitationError, abandonRoleIntent, applyRoleIntent,
  decodeLegacyNestedToken, finishRoleIntent, normalizeEmail, permitsLegacyInvitationFallback,
  prepareRoleIntent, recipientEmailHash, resolveHubOrigin
} from '../../services/server/hubInvitationAdapter';

const response = (status: number, body: any) => ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;
const role = (organizationId = 'org-1', name = 'Administrador') => ({ exists: true, data: () => ({ organizationId, name }) });

function fakeDb(roleDoc: any = role()) {
  const docs = new Map<string, any>();
  const writes: Array<{ path: string; data: any; operation: string }> = [];
  const ref = (path: string): any => ({
    path,
    collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
    get: async () => path.startsWith('roles/') ? roleDoc : ({ exists: docs.has(path), data: () => docs.get(path) }),
    set: async (data: any, options?: any) => { docs.set(path, options?.merge ? { ...docs.get(path), ...data } : data); writes.push({ path, data, operation: 'set' }); },
    delete: async () => { docs.delete(path); writes.push({ path, data: null, operation: 'delete' }); }
  });
  return { db: { collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }) }, docs, writes, ref };
}

describe('02B create adapter matrix (3-31)', () => {
  it.each([
    ['', 'HUB_NOT_CONFIGURED'], ['https://u:p@hub.example', 'HUB_NOT_CONFIGURED'],
    ['https://hub.example?x=1', 'HUB_NOT_CONFIGURED'], ['https://hub.example#x', 'HUB_NOT_CONFIGURED'],
    ['https://hub.example/path', 'HUB_NOT_CONFIGURED']
  ])('26-30 origin rejects %s', (origin, reason) => expect(() => resolveHubOrigin(origin)).toThrow(reason));

  it('10-16 and 31 forwards exact bearer and canonical-only body to configured origin', async () => {
    const fetcher = vi.fn(async (url, init) => {
      expect(url).toBe('https://configured.example/api/v1/invitations');
      expect(init?.headers).toEqual({ 'content-type': 'application/json', authorization: 'Bearer exact-token' });
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({ organizationId: 'org-1', email: 'person@example.com', role: 'member' });
      expect(body).not.toHaveProperty('roleId'); expect(body).not.toHaveProperty('musicscaleRole');
      return response(200, { success: true, reasonCode: 'CREATED', invitePath: '/join/org-1?token=raw-secret', invitation: { id: 'i1', organizationId: 'org-1', role: 'member', expiresAtMs: 1 } });
    });
    const result = await new HubInvitationAdapter({ origin: 'https://configured.example', fetch: fetcher as any }).create('Bearer exact-token', 'org-1', ' Person@Example.COM ');
    expect(result.invitePath).toBe('/join/org-1?token=raw-secret');
  });

  it.each(['owner', 'dono', 'ceo', 'global_admin', 'ecosystem_owner', 'founder', 'support', 'suporte'])('7-8 rejects forbidden domain role %s', async name => {
    await expect(prepareRoleIntent(fakeDb(role('org-1', name)).db, 'org-1', 'a@b.com', 'role-1', 'actor')).rejects.toMatchObject({ status: 403 });
  });

  it('3,5,6 deny invalid organization and invalid/cross-tenant roles', async () => {
    await expect(prepareRoleIntent(fakeDb().db, '../bad', 'a@b.com', 'role-1', 'actor')).rejects.toMatchObject({ status: 400 });
    await expect(prepareRoleIntent(fakeDb({ exists: false }).db, 'org-1', 'a@b.com', 'missing', 'actor')).rejects.toThrow('ROLE_NOT_FOUND');
    await expect(prepareRoleIntent(fakeDb(role('org-2')).db, 'org-1', 'a@b.com', 'role-1', 'actor')).rejects.toThrow('ROLE_ORGANIZATION_MISMATCH');
  });

  it('9,17-20 permits Administrador, hashes normalized email, scopes tenant, preserves only role intent', async () => {
    const store = fakeDb();
    const intent = await prepareRoleIntent(store.db, 'org-1', ' Person@Example.COM ', 'role-admin', 'actor');
    expect(intent.ref.path).toBe(`organizations/org-1/musicscale_invite_role_intents/${recipientEmailHash('person@example.com')}`);
    const saved = store.docs.get(intent.ref.path);
    expect(saved).toMatchObject({ organizationId: 'org-1', recipientEmailHash: recipientEmailHash('person@example.com'), roleId: 'role-admin', status: 'creating' });
    expect(JSON.stringify(saved)).not.toContain('raw-secret');
  });

  it('21-22 generation protects stale finish and cleanup', async () => {
    const store = fakeDb(); const ref = store.ref('intent');
    store.docs.set('intent', { generationId: 'new', status: 'creating' });
    await finishRoleIntent(ref, 'stale', { invitation: { id: 'hub', expiresAtMs: 1 } });
    await abandonRoleIntent(ref, 'stale');
    expect(store.docs.get('intent')).toEqual({ generationId: 'new', status: 'creating' });
    await abandonRoleIntent(ref, 'new'); expect(store.docs.has('intent')).toBe(false);
  });

  it.each([[500, 'HUB_500'], [502, 'HUB_502'], [503, 'HUB_503'], [504, 'HUB_504']])('24 preserves ambiguous %s fail-closed', async (status, reasonCode) => {
    await expect(new HubInvitationAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(status as number, { reasonCode })) as any }).accept('Bearer x', 'token'))
      .rejects.toMatchObject({ status, reasonCode, ambiguous: true });
  });

  it('23,25 timeout/network fail closed and ambiguous', async () => {
    const adapter = new HubInvitationAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => { throw new Error('DNS'); }) as any });
    await expect(adapter.accept('Bearer x', 'token')).rejects.toMatchObject({ status: 503, reasonCode: 'HUB_UNAVAILABLE', ambiguous: true });
  });
});

describe('02B accept/projection and zero parallel authority matrix (32-46)', () => {
  it('35-46 applies valid intent only to projection and intent using token-derived identity', async () => {
    const store = fakeDb(role('hub-org')); const hash = recipientEmailHash('signed@example.com');
    store.docs.set(`organizations/hub-org/musicscale_invite_role_intents/${hash}`, { status: 'pending', organizationId: 'hub-org', roleId: 'role-admin' });
    expect(await applyRoleIntent(store.db, 'hub-org', 'token-uid', 'SIGNED@example.com')).toBe(true);
    const paths = store.writes.map(write => write.path);
    expect(paths).toContain('organizations/hub-org/musicscale_members/token-uid');
    expect(paths).toContain(`organizations/hub-org/musicscale_invite_role_intents/${hash}`);
    expect(paths.some(path => /\/members\//.test(path) && !path.includes('musicscale_members'))).toBe(false);
    expect(paths.some(path => path.startsWith('organization_members/'))).toBe(false);
    expect(paths.some(path => path.startsWith('users/'))).toBe(false);
    expect(paths.some(path => path.includes('/invites/'))).toBe(false);
    expect(JSON.stringify(store.writes)).not.toContain('raw-token');
  });

  it('37 ALREADY_MEMBER uses the same idempotent projection recovery contract', async () => {
    const fetcher = vi.fn(async () => response(200, { success: true, organizationId: 'org-1', alreadyMember: true, reasonCode: 'ALREADY_MEMBER' }));
    const result = await new HubInvitationAdapter({ origin: 'https://hub.example', fetch: fetcher as any }).accept('Bearer x', 'token');
    expect(result).toMatchObject({ success: true, alreadyMember: true, organizationId: 'org-1' });
  });

  it('38 missing intent preserves canonical success without writes', async () => {
    const store = fakeDb(); expect(await applyRoleIntent(store.db, 'org-1', 'uid', 'a@b.com')).toBe(false); expect(store.writes).toEqual([]);
  });

  it('39-41 invalid, missing and cross-tenant roles never invent a projection role', async () => {
    for (const roleDoc of [{ exists: false }, role('org-2')]) {
      const store = fakeDb(roleDoc); const path = `organizations/org-1/musicscale_invite_role_intents/${recipientEmailHash('a@b.com')}`;
      store.docs.set(path, { status: 'pending', organizationId: 'org-1', roleId: 'bad-role' });
      expect(await applyRoleIntent(store.db, 'org-1', 'uid', 'a@b.com')).toBe(false);
      expect(store.writes.some(write => write.path === 'organizations/org-1/musicscale_members/uid')).toBe(false);
      expect(store.docs.get(path).status).toBe('invalid');
    }
  });
});

describe('02B fallback and legacy parsing matrix (47-59,75-79)', () => {
  it('47 permits only exact 404 INVITE_NOT_FOUND', () => expect(permitsLegacyInvitationFallback(new HubInvitationError(404, 'INVITE_NOT_FOUND'))).toBe(true));
  it.each([[404, 'OTHER'], [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [409, 'CONFLICT'], [429, 'RATE_LIMIT'], [500, 'E'], [502, 'E'], [503, 'E'], [504, 'E']])
  ('48-56 denies fallback for %s %s', (status, reason) => expect(permitsLegacyInvitationFallback(new HubInvitationError(status as number, reason as string))).toBe(false));
  it('57-59 denies fallback for timeout/network/malformed ambiguity', () => {
    expect(permitsLegacyInvitationFallback(new HubInvitationError(503, 'HUB_UNAVAILABLE', true))).toBe(false);
    expect(permitsLegacyInvitationFallback(new HubInvitationError(502, 'INVALID_HUB_RESPONSE', true))).toBe(false);
    expect(permitsLegacyInvitationFallback(new Error('network'))).toBe(false);
  });
  it('75 accepts strict orgId:inviteId', () => expect(decodeLegacyNestedToken(Buffer.from('org-1:invite-1').toString('base64url'))).toEqual({ organizationId: 'org-1', inviteId: 'invite-1' }));
  it.each(['onepart', 'a:b:c', '', '%%%%', Buffer.from('a:../bad').toString('base64url')])('76-79 rejects malformed/path-unbound %s', value => expect(decodeLegacyNestedToken(value)).toBeNull());
});

describe('02B HTTP and legacy server source invariants (1-2,4,16,32-36,42-46,60-74,80-87)', () => {
  const source = readFileSync('server.ts', 'utf8');
  it('1-2,32-34 endpoints require and verify bearer before command processing', () => {
    expect(source).toContain('resolveOrganizationAuthorization(req.headers.authorization, organizationId, db, auth)');
    expect(source).toContain('if (!authHeader || !authHeader.startsWith("Bearer "))');
    expect(source).toContain('await auth.verifyIdToken(idToken, true)');
    expect(source).toContain('if (!token) return res.status(400)');
  });
  it('4,16 validates email and returns canonical Hub link', () => {
    expect(source).toContain('INVALID_EMAIL'); expect(source).toContain('link: hub.invitePath');
  });
  it('35,42-46 Hub success only invokes domain projection with token-derived UID/email and Hub org', () => {
    expect(source).toContain('applyRoleIntent(db, hub.organizationId, authenticatedUid, authenticatedEmail)');
    const hubSuccess = source.slice(source.indexOf('const hub = await new HubInvitationAdapter().accept'), source.indexOf('const tokenHash', source.indexOf('const hub = await new HubInvitationAdapter().accept')));
    expect(hubSuccess).not.toMatch(/collection\(['"](?:users|organization_members|members|invites)/);
    expect(hubSuccess).not.toContain('logger.');
  });
  it('60-74 root validates hash/status/expiry/email/tenant/role, member authority separation and audit', () => {
    for (const invariant of ['tokenHash', 'timingSafeEqual', 'TOKEN_EXPIRED', 'INVITE_NOT_PENDING', 'EMAIL_MISMATCH', 'INVALID_ORG', 'ROLE_NOT_FOUND', 'ROLE_ORGANIZATION_MISMATCH', 'CANNOT_ACCEPT_GLOBAL_OR_OWNER', "finalOrgRole = 'member'", "collection('musicscale_members')", 'legacy_root_migrated']) expect(source).toContain(invariant);
    const canonicalData = source.slice(source.indexOf('const canonicalData = {'), source.indexOf('t.set(canonMemberRef'));
    expect(canonicalData).not.toContain('roleId:'); expect(canonicalData).not.toContain('internalRoleId:');
  });
  it('80-87 nested validates expiry/status/roles, keeps member projection separate and remains multi-use', () => {
    expect(source).toContain("isNestedLegacy ? 'legacy_nested_invite_migration'");
    expect(source).toContain("if (!isNestedLegacy) t.update(inviteDoc.ref, inviteUpdates)");
    expect(source).toContain("action: isNestedLegacy ? 'organization.invite.legacy_nested_migrated'");
  });
});
