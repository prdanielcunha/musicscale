import { describe, expect, it, vi } from 'vitest';
import {
  HubInvitationAdapter, HubInvitationError, abandonRoleIntent, applyRoleIntent,
  decodeLegacyNestedToken, finishRoleIntent, permitsLegacyInvitationFallback,
  prepareRoleIntent, recipientEmailHash, resolveHubOrigin
} from '../../services/server/hubInvitationAdapter';

const response = (status: number, body: any, jsonThrows = false) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => { if (jsonThrows) throw new Error('invalid json'); return body; }
}) as Response;
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

const validAccept = (overrides: any = {}) => ({
  success: true,
  organizationId: 'org-1',
  activeOrganizationId: 'org-1',
  membershipRole: 'member',
  alreadyMember: false,
  legacyTokenMigrated: false,
  reasonCode: 'INVITATION_CAN_BE_ACCEPTED',
  ...overrides
});

describe('02B create adapter matrix', () => {
  it.each([
    ['', 'HUB_NOT_CONFIGURED'], ['https://u:p@hub.example', 'HUB_NOT_CONFIGURED'],
    ['https://hub.example?x=1', 'HUB_NOT_CONFIGURED'], ['https://hub.example#x', 'HUB_NOT_CONFIGURED'],
    ['https://hub.example/path', 'HUB_NOT_CONFIGURED']
  ])('origin rejects %s', (origin, reason) => expect(() => resolveHubOrigin(origin)).toThrow(reason));

  it('forwards exact bearer and canonical-only body to configured origin', async () => {
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

  it.each(['owner', 'dono', 'ceo', 'global_admin', 'ecosystem_owner', 'founder', 'support', 'suporte'])('rejects forbidden domain role %s', async name => {
    await expect(prepareRoleIntent(fakeDb(role('org-1', name)).db, 'org-1', 'a@b.com', 'role-1', 'actor')).rejects.toMatchObject({ status: 403 });
  });

  it('denies invalid organization and invalid/cross-tenant roles', async () => {
    await expect(prepareRoleIntent(fakeDb().db, '../bad', 'a@b.com', 'role-1', 'actor')).rejects.toMatchObject({ status: 400 });
    await expect(prepareRoleIntent(fakeDb({ exists: false }).db, 'org-1', 'a@b.com', 'missing', 'actor')).rejects.toThrow('ROLE_NOT_FOUND');
    await expect(prepareRoleIntent(fakeDb(role('org-2')).db, 'org-1', 'a@b.com', 'role-1', 'actor')).rejects.toThrow('ROLE_ORGANIZATION_MISMATCH');
  });

  it('permits Administrador, hashes normalized email and scopes tenant', async () => {
    const store = fakeDb();
    const intent = await prepareRoleIntent(store.db, 'org-1', ' Person@Example.COM ', 'role-admin', 'actor');
    expect(intent.ref.path).toBe(`organizations/org-1/musicscale_invite_role_intents/${recipientEmailHash('person@example.com')}`);
    const saved = store.docs.get(intent.ref.path);
    expect(saved).toMatchObject({ organizationId: 'org-1', recipientEmailHash: recipientEmailHash('person@example.com'), roleId: 'role-admin', status: 'creating' });
    expect(JSON.stringify(saved)).not.toContain('raw-secret');
  });

  it('generation protects stale finish and cleanup', async () => {
    const store = fakeDb(); const ref = store.ref('intent');
    store.docs.set('intent', { generationId: 'new', status: 'creating' });
    await finishRoleIntent(ref, 'stale', { invitation: { id: 'hub', expiresAtMs: 1 } });
    await abandonRoleIntent(ref, 'stale');
    expect(store.docs.get('intent')).toEqual({ generationId: 'new', status: 'creating' });
    await abandonRoleIntent(ref, 'new'); expect(store.docs.has('intent')).toBe(false);
  });

  it.each([[500, 'HUB_500'], [502, 'HUB_502'], [503, 'HUB_503'], [504, 'HUB_504']])('preserves ambiguous %s fail-closed', async (status, reasonCode) => {
    await expect(new HubInvitationAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(status as number, { reasonCode })) as any }).accept('Bearer x', 'token'))
      .rejects.toMatchObject({ status, reasonCode, ambiguous: true });
  });

  it('network failure is fail-closed and ambiguous', async () => {
    const adapter = new HubInvitationAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => { throw new Error('DNS'); }) as any });
    await expect(adapter.accept('Bearer x', 'token')).rejects.toMatchObject({ status: 503, reasonCode: 'HUB_UNAVAILABLE', ambiguous: true });
  });
});

describe('02B Hub acceptance response validation', () => {
  it.each([
    ['missing organizationId', { organizationId: undefined }],
    ['empty organizationId', { organizationId: '' }],
    ['malformed organizationId', { organizationId: '../bad', activeOrganizationId: '../bad' }],
    ['missing activeOrganizationId', { activeOrganizationId: undefined }],
    ['mismatched activeOrganizationId', { activeOrganizationId: 'org-2' }],
    ['missing membershipRole', { membershipRole: undefined }],
    ['missing alreadyMember', { alreadyMember: undefined }],
    ['non-boolean alreadyMember', { alreadyMember: 'false' }],
    ['unexpected reasonCode', { reasonCode: 'OTHER' }]
  ])('rejects malformed success: %s', async (_label, overrides) => {
    const adapter = new HubInvitationAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, validAccept(overrides))) as any });
    await expect(adapter.accept('Bearer x', 'token')).rejects.toMatchObject({ status: 502, reasonCode: 'INVALID_HUB_RESPONSE', ambiguous: true });
  });

  it('rejects HTTP 2xx success:false', async () => {
    const adapter = new HubInvitationAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, { success: false })) as any });
    await expect(adapter.accept('Bearer x', 'token')).rejects.toMatchObject({ status: 502, reasonCode: 'INVALID_HUB_RESPONSE', ambiguous: true });
  });

  it('rejects invalid JSON', async () => {
    const adapter = new HubInvitationAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, {}, true)) as any });
    await expect(adapter.accept('Bearer x', 'token')).rejects.toMatchObject({ status: 502, reasonCode: 'INVALID_HUB_RESPONSE', ambiguous: true });
  });

  it.each([
    validAccept(),
    validAccept({ alreadyMember: true, reasonCode: 'ALREADY_MEMBER' })
  ])('accepts certified success contract %#', async payload => {
    const adapter = new HubInvitationAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, payload)) as any });
    await expect(adapter.accept('Bearer x', 'token')).resolves.toMatchObject(payload);
  });

  it('malformed success never enables legacy fallback', async () => {
    const error = await new HubInvitationAdapter({ origin: 'https://hub.example', fetch: vi.fn(async () => response(200, validAccept({ reasonCode: 'OTHER' }))) as any })
      .accept('Bearer x', 'token').catch(value => value);
    expect(permitsLegacyInvitationFallback(error)).toBe(false);
  });
});

describe('02B accept/projection and zero parallel authority', () => {
  it('applies valid intent only to projection and preserves inviter provenance', async () => {
    const store = fakeDb(role('hub-org')); const hash = recipientEmailHash('signed@example.com');
    store.docs.set(`organizations/hub-org/musicscale_invite_role_intents/${hash}`, { status: 'pending', organizationId: 'hub-org', roleId: 'role-admin', createdByUid: 'inviter-1' });
    expect(await applyRoleIntent(store.db, 'hub-org', 'token-uid', 'SIGNED@example.com')).toBe(true);
    const projection = store.docs.get('organizations/hub-org/musicscale_members/token-uid');
    expect(projection).toMatchObject({ roleId: 'role-admin', updatedByUid: 'inviter-1', source: 'hub_invitation_role_intent' });
    const paths = store.writes.map(write => write.path);
    expect(paths.some(path => /\/members\//.test(path) && !path.includes('musicscale_members'))).toBe(false);
    expect(paths.some(path => path.startsWith('organization_members/'))).toBe(false);
    expect(paths.some(path => path.startsWith('users/'))).toBe(false);
    expect(paths.some(path => path.includes('/invites/'))).toBe(false);
  });

  it('missing intent preserves canonical success without writes', async () => {
    const store = fakeDb(); expect(await applyRoleIntent(store.db, 'org-1', 'uid', 'a@b.com')).toBe(false); expect(store.writes).toEqual([]);
  });

  it('invalid and cross-tenant roles never invent a projection role', async () => {
    for (const roleDoc of [{ exists: false }, role('org-2')]) {
      const store = fakeDb(roleDoc); const path = `organizations/org-1/musicscale_invite_role_intents/${recipientEmailHash('a@b.com')}`;
      store.docs.set(path, { status: 'pending', organizationId: 'org-1', roleId: 'bad-role' });
      expect(await applyRoleIntent(store.db, 'org-1', 'uid', 'a@b.com')).toBe(false);
      expect(store.writes.some(write => write.path === 'organizations/org-1/musicscale_members/uid')).toBe(false);
      expect(store.docs.get(path).status).toBe('invalid');
    }
  });
});

describe('02B fallback and legacy parsing', () => {
  it('permits only exact 404 INVITE_NOT_FOUND', () => expect(permitsLegacyInvitationFallback(new HubInvitationError(404, 'INVITE_NOT_FOUND'))).toBe(true));
  it.each([[404, 'OTHER'], [401, 'UNAUTHORIZED'], [403, 'FORBIDDEN'], [409, 'CONFLICT'], [429, 'RATE_LIMIT'], [500, 'E'], [502, 'E'], [503, 'E'], [504, 'E']])
  ('denies fallback for %s %s', (status, reason) => expect(permitsLegacyInvitationFallback(new HubInvitationError(status as number, reason as string))).toBe(false));
  it('denies fallback for timeout/network/malformed ambiguity', () => {
    expect(permitsLegacyInvitationFallback(new HubInvitationError(503, 'HUB_UNAVAILABLE', true))).toBe(false);
    expect(permitsLegacyInvitationFallback(new HubInvitationError(502, 'INVALID_HUB_RESPONSE', true))).toBe(false);
    expect(permitsLegacyInvitationFallback(new Error('network'))).toBe(false);
  });
  it('accepts strict orgId:inviteId', () => expect(decodeLegacyNestedToken(Buffer.from('org-1:invite-1').toString('base64url'))).toEqual({ organizationId: 'org-1', inviteId: 'invite-1' }));
  it.each(['onepart', 'a:b:c', '', '%%%%', Buffer.from('a:../bad').toString('base64url')])('rejects malformed/path-unbound %s', value => expect(decodeLegacyNestedToken(value)).toBeNull());
});
