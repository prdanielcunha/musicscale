import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { HubInvitationError, recipientEmailHash } from '../../services/server/hubInvitationAdapter';
import {
  createInvitationCompatibilityHandlers,
  resolveAuthenticatedInvitationPrincipal
} from '../../services/server/musicScaleInvitationCompatibility';

const DELETE = Symbol('delete');

class FakeDb {
  docs = new Map<string, any>();
  writes: Array<{ operation: string; path: string; data: any }> = [];
  autoId = 0;

  seed(path: string, data: any) { this.docs.set(path, structuredCloneSafe(data)); }

  collection(path: string) {
    return new FakeCollection(this, path);
  }

  async runTransaction(callback: (transaction: any) => Promise<void>) {
    const transaction = {
      get: async (ref: FakeRef) => ref.get(),
      set: (ref: FakeRef, data: any, options?: any) => ref.setSync(data, options),
      update: (ref: FakeRef, data: any) => ref.updateSync(data)
    };
    await callback(transaction);
  }
}

class FakeCollection {
  constructor(private db: FakeDb, public path: string) {}
  doc(id?: string) { return new FakeRef(this.db, `${this.path}/${id || `auto-${++this.db.autoId}`}`); }
  where(field: string, op: string, value: any) {
    if (op !== '==') throw new Error('unsupported query');
    return new FakeQuery(this.db, this.path, field, value);
  }
}

class FakeQuery {
  constructor(private db: FakeDb, private collectionPath: string, private field: string, private value: any) {}
  limit(_count: number) { return this; }
  async get() {
    const prefix = `${this.collectionPath}/`;
    const expectedDepth = this.collectionPath.split('/').length + 1;
    const docs: FakeSnapshot[] = [];
    for (const [path, data] of this.db.docs.entries()) {
      if (!path.startsWith(prefix) || path.split('/').length !== expectedDepth) continue;
      if (data?.[this.field] === this.value) docs.push(new FakeSnapshot(new FakeRef(this.db, path), data));
    }
    return { empty: docs.length === 0, docs };
  }
}

class FakeRef {
  constructor(private db: FakeDb, public path: string) {}
  get id() { return this.path.split('/').at(-1)!; }
  collection(name: string) { return new FakeCollection(this.db, `${this.path}/${name}`); }
  async get() {
    const exists = this.db.docs.has(this.path);
    return new FakeSnapshot(this, exists ? this.db.docs.get(this.path) : undefined);
  }
  async set(data: any, options?: any) { this.setSync(data, options); }
  setSync(data: any, options?: any) {
    const next = options?.merge ? { ...(this.db.docs.get(this.path) || {}), ...structuredCloneSafe(data) } : structuredCloneSafe(data);
    this.db.docs.set(this.path, next);
    this.db.writes.push({ operation: 'set', path: this.path, data: structuredCloneSafe(data) });
  }
  async update(data: any) { this.updateSync(data); }
  updateSync(data: any) {
    const current = { ...(this.db.docs.get(this.path) || {}) };
    for (const [key, value] of Object.entries(data)) {
      if (value === DELETE) delete current[key];
      else current[key] = structuredCloneSafe(value);
    }
    this.db.docs.set(this.path, current);
    this.db.writes.push({ operation: 'update', path: this.path, data: structuredCloneSafe(data) });
  }
  async delete() {
    this.db.docs.delete(this.path);
    this.db.writes.push({ operation: 'delete', path: this.path, data: null });
  }
}

class FakeSnapshot {
  exists: boolean;
  constructor(public ref: FakeRef, private value: any) { this.exists = value !== undefined; }
  get id() { return this.ref.id; }
  data() { return this.value; }
}

function structuredCloneSafe<T>(value: T): T {
  if (value === DELETE) return value;
  if (value instanceof Date) return new Date(value.getTime()) as T;
  if (Array.isArray(value)) return value.map(structuredCloneSafe) as T;
  if (value && typeof value === 'object') {
    const output: any = {};
    for (const [key, item] of Object.entries(value as any)) output[key] = structuredCloneSafe(item);
    return output;
  }
  return value;
}

const admin = {
  firestore: {
    FieldValue: {
      serverTimestamp: () => 'SERVER_TIMESTAMP',
      arrayUnion: (...values: any[]) => ({ __arrayUnion: values }),
      delete: () => DELETE
    }
  }
};

function fakeRes() {
  return {
    statusCode: 200,
    body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; }
  };
}

function authFor(uid: string, currentEmail: string | undefined, claimEmail = 'old@example.com') {
  return {
    verifyIdToken: vi.fn(async () => ({ uid, email: claimEmail })),
    getUser: vi.fn(async () => ({ uid, email: currentEmail }))
  };
}

const validHubAccept = (organizationId = 'org-1', overrides: any = {}) => ({
  success: true,
  organizationId,
  activeOrganizationId: organizationId,
  membershipRole: 'member',
  alreadyMember: false,
  legacyTokenMigrated: false,
  reasonCode: 'INVITATION_CAN_BE_ACCEPTED',
  ...overrides
});

const fallbackHub = () => ({
  create: vi.fn(),
  accept: vi.fn(async () => { throw new HubInvitationError(404, 'INVITE_NOT_FOUND'); })
});

function seedLegacyBase(db: FakeDb, uid = 'user-1', email = 'current@example.com') {
  db.seed('organizations/org-1', { status: 'active', archived: false });
  db.seed(`users/${uid}`, { email, displayName: uid, organizations: [] });
  db.seed('roles/role-1', { organizationId: 'org-1', name: 'Administrador' });
}

describe('02B2 authenticated invitation identity', () => {
  it('uses Firebase Admin current email instead of stale ID-token email', async () => {
    const auth = authFor('user-1', 'Current@Example.COM', 'old@example.com');
    const principal = await resolveAuthenticatedInvitationPrincipal(auth, 'Bearer token');
    expect(principal).toEqual({ uid: 'user-1', email: 'current@example.com', bearer: 'Bearer token' });
    expect(auth.getUser).toHaveBeenCalledWith('user-1');
  });

  it('fails closed when Firebase Auth user has no email', async () => {
    await expect(resolveAuthenticatedInvitationPrincipal(authFor('user-1', undefined), 'Bearer token'))
      .rejects.toMatchObject({ status: 403, reasonCode: 'AUTHENTICATED_EMAIL_REQUIRED' });
  });

  it('fails closed when Firebase Admin getUser is unavailable', async () => {
    const auth = authFor('user-1', 'current@example.com');
    auth.getUser.mockRejectedValueOnce(new Error('unavailable'));
    await expect(resolveAuthenticatedInvitationPrincipal(auth, 'Bearer token'))
      .rejects.toMatchObject({ status: 503, reasonCode: 'AUTHENTICATED_USER_UNAVAILABLE' });
  });
});

describe('02B2 executable create handler', () => {
  it('forwards bearer + normalized email while keeping MusicScale role intent local', async () => {
    const db = new FakeDb();
    db.seed('roles/role-admin', { organizationId: 'org-1', name: 'Administrador' });
    const hub = {
      create: vi.fn(async (_bearer: string, organizationId: string, email: string) => ({
        success: true,
        reasonCode: 'CREATED',
        invitePath: `/join/${organizationId}?token=raw-secret`,
        invitation: { id: 'hub-i1', organizationId, role: 'member', expiresAtMs: 123 }
      })),
      accept: vi.fn()
    };
    const resolveAuthorization = vi.fn(async (bearer: string | undefined) => bearer === 'Bearer actor-token'
      ? { context: { uid: 'actor-1', systemRole: null, organizationRole: 'admin', isActive: true, isOwner: false, capabilities: ['organization.members.manage'] } }
      : { statusCode: 401, error: 'UNAUTHORIZED' });
    const handlers = createInvitationCompatibilityHandlers({ db, auth: {}, admin, hubFactory: () => hub as any, resolveAuthorization: resolveAuthorization as any });
    const res = fakeRes();
    await handlers.create({ headers: { authorization: 'Bearer actor-token' }, body: { organizationId: 'org-1', email: ' Person@Example.COM ', roleId: 'role-admin' } }, res);
    expect(res.statusCode).toBe(200);
    expect(hub.create).toHaveBeenCalledWith('Bearer actor-token', 'org-1', 'person@example.com');
    expect(res.body.link).toBe('/join/org-1?token=raw-secret');
    const intentPath = `organizations/org-1/musicscale_invite_role_intents/${recipientEmailHash('person@example.com')}`;
    expect(db.docs.get(intentPath)).toMatchObject({ roleId: 'role-admin', createdByUid: 'actor-1', status: 'pending', hubInvitationId: 'hub-i1' });
    expect(JSON.stringify(db.docs.get(intentPath))).not.toContain('raw-secret');
  });

  it('requires authorization before creating intent', async () => {
    const db = new FakeDb();
    const handlers = createInvitationCompatibilityHandlers({
      db, auth: {}, admin,
      hubFactory: () => ({ create: vi.fn(), accept: vi.fn() }) as any,
      resolveAuthorization: vi.fn(async () => ({ statusCode: 401, error: 'UNAUTHORIZED' })) as any
    });
    const res = fakeRes();
    await handlers.create({ headers: {}, body: { organizationId: 'org-1', email: 'a@b.com', roleId: 'role-1' } }, res);
    expect(res.statusCode).toBe(401);
    expect(db.writes).toEqual([]);
  });
});

describe('02B2 executable Hub-success acceptance', () => {
  it('uses current Firebase Auth email for role intent and writes no parallel authority', async () => {
    const db = new FakeDb();
    db.seed('roles/role-1', { organizationId: 'org-1', name: 'Administrador' });
    const currentHash = recipientEmailHash('current@example.com');
    const oldHash = recipientEmailHash('old@example.com');
    db.seed(`organizations/org-1/musicscale_invite_role_intents/${currentHash}`, {
      status: 'pending', organizationId: 'org-1', roleId: 'role-1', createdByUid: 'inviter-1'
    });
    db.seed(`organizations/org-1/musicscale_invite_role_intents/${oldHash}`, {
      status: 'pending', organizationId: 'org-1', roleId: 'wrong-role', createdByUid: 'wrong-inviter'
    });
    const hub = { create: vi.fn(), accept: vi.fn(async () => validHubAccept()) };
    const handlers = createInvitationCompatibilityHandlers({ db, auth: authFor('user-1', 'current@example.com', 'old@example.com'), admin, hubFactory: () => hub as any });
    const res = fakeRes();
    await handlers.accept({ headers: { authorization: 'Bearer user-token' }, body: { token: 'hub-token' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.roleProjectionApplied).toBe(true);
    expect(db.docs.get('organizations/org-1/musicscale_members/user-1')).toMatchObject({
      roleId: 'role-1', updatedByUid: 'inviter-1', source: 'hub_invitation_role_intent'
    });
    expect(db.docs.get(`organizations/org-1/musicscale_invite_role_intents/${oldHash}`).status).toBe('pending');
    const paths = db.writes.map(write => write.path);
    expect(paths.some(path => path.includes('/members/'))).toBe(false);
    expect(paths.some(path => path.startsWith('organization_members/'))).toBe(false);
    expect(paths.some(path => path.startsWith('users/'))).toBe(false);
    expect(paths.some(path => path.includes('/invites/'))).toBe(false);
  });

  it('ALREADY_MEMBER recovers a pending MusicScale role intent idempotently', async () => {
    const db = new FakeDb();
    db.seed('roles/role-1', { organizationId: 'org-1', name: 'Administrador' });
    db.seed(`organizations/org-1/musicscale_invite_role_intents/${recipientEmailHash('current@example.com')}`, {
      status: 'pending', organizationId: 'org-1', roleId: 'role-1', createdByUid: 'inviter-1'
    });
    const hub = { create: vi.fn(), accept: vi.fn(async () => validHubAccept('org-1', { alreadyMember: true, reasonCode: 'ALREADY_MEMBER' })) };
    const handlers = createInvitationCompatibilityHandlers({ db, auth: authFor('user-1', 'current@example.com'), admin, hubFactory: () => hub as any });
    const res = fakeRes();
    await handlers.accept({ headers: { authorization: 'Bearer token' }, body: { token: 'hub-token' } }, res);
    expect(res.body).toMatchObject({ success: true, alreadyMember: true, roleProjectionApplied: true });
  });

  it('missing current Firebase email fails before Hub and never falls back', async () => {
    const db = new FakeDb();
    const hub = fallbackHub();
    const handlers = createInvitationCompatibilityHandlers({ db, auth: authFor('user-1', undefined), admin, hubFactory: () => hub as any });
    const res = fakeRes();
    await handlers.accept({ headers: { authorization: 'Bearer token' }, body: { token: 'anything' } }, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.reasonCode).toBe('AUTHENTICATED_EMAIL_REQUIRED');
    expect(hub.accept).not.toHaveBeenCalled();
    expect(db.writes).toEqual([]);
  });
});

describe('02B2 executable legacy root fallback', () => {
  it('accepts valid root invite, binds current email, keeps canonical role member and records provenance', async () => {
    const db = new FakeDb(); seedLegacyBase(db);
    const token = 'root-secret';
    db.seed('invites/invite-1', {
      organizationId: 'org-1', status: 'pending', email: 'current@example.com',
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60_000),
      roleId: 'role-1', createdByUid: 'inviter-1'
    });
    const handlers = createInvitationCompatibilityHandlers({ db, auth: authFor('user-1', 'current@example.com'), admin, hubFactory: () => fallbackHub() as any });
    const res = fakeRes();
    await handlers.accept({ headers: { authorization: 'Bearer token' }, body: { token } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, organization_id: 'org-1' });
    const canonical = db.docs.get('organizations/org-1/members/user-1');
    expect(canonical).toMatchObject({ organizationRole: 'member', role: 'member', email: 'current@example.com' });
    expect(canonical).not.toHaveProperty('roleId');
    expect(db.docs.get('organizations/org-1/musicscale_members/user-1')).toMatchObject({
      roleId: 'role-1', updatedByUid: 'inviter-1', source: 'legacy_root_invite_migration'
    });
    expect(db.docs.get('invites/invite-1')).toMatchObject({ status: 'accepted', acceptedByUid: 'user-1' });
    expect(Array.from(db.docs.values()).some(value => value?.action === 'organization.invite.legacy_root_migrated')).toBe(true);
  });

  it('denies wrong recipient email without creating membership', async () => {
    const db = new FakeDb(); seedLegacyBase(db);
    const token = 'root-secret';
    db.seed('invites/invite-1', {
      organizationId: 'org-1', status: 'pending', email: 'other@example.com',
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 60_000), roleId: 'role-1'
    });
    const handlers = createInvitationCompatibilityHandlers({ db, auth: authFor('user-1', 'current@example.com'), admin, hubFactory: () => fallbackHub() as any });
    const res = fakeRes();
    await handlers.accept({ headers: { authorization: 'Bearer token' }, body: { token } }, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.reasonCode).toBe('EMAIL_MISMATCH');
    expect(db.docs.has('organizations/org-1/members/user-1')).toBe(false);
  });

  it('denies expired, cross-tenant and forbidden internal roles', async () => {
    for (const variant of ['expired', 'cross-tenant', 'forbidden'] as const) {
      const db = new FakeDb(); seedLegacyBase(db);
      const token = `root-${variant}`;
      if (variant === 'cross-tenant') db.seed('roles/role-1', { organizationId: 'org-2', name: 'Administrador' });
      if (variant === 'forbidden') db.seed('roles/role-1', { organizationId: 'org-1', name: 'owner' });
      db.seed('invites/invite-1', {
        organizationId: 'org-1', status: 'pending', email: 'current@example.com',
        tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + (variant === 'expired' ? -60_000 : 60_000)), roleId: 'role-1'
      });
      const handlers = createInvitationCompatibilityHandlers({ db, auth: authFor('user-1', 'current@example.com'), admin, hubFactory: () => fallbackHub() as any });
      const res = fakeRes();
      await handlers.accept({ headers: { authorization: 'Bearer token' }, body: { token } }, res);
      expect(res.statusCode).not.toBe(200);
      expect(db.docs.has('organizations/org-1/members/user-1')).toBe(false);
    }
  });

  it('denies unknown token/hash', async () => {
    const db = new FakeDb(); seedLegacyBase(db);
    const handlers = createInvitationCompatibilityHandlers({ db, auth: authFor('user-1', 'current@example.com'), admin, hubFactory: () => fallbackHub() as any });
    const res = fakeRes();
    await handlers.accept({ headers: { authorization: 'Bearer token' }, body: { token: 'no-match' } }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.reasonCode).toBe('INVALID_TOKEN');
  });
});

describe('02B2 executable legacy nested fallback', () => {
  it('preserves historical multi-use behavior while keeping each membership canonical member', async () => {
    const db = new FakeDb();
    db.seed('organizations/org-1', { status: 'active' });
    db.seed('roles/role-1', { organizationId: 'org-1', name: 'Administrador' });
    db.seed('users/user-1', { email: 'one@example.com', displayName: 'One' });
    db.seed('users/user-2', { email: 'two@example.com', displayName: 'Two' });
    db.seed('organizations/org-1/invites/nested-1', {
      organizationId: 'org-1', status: 'pending', expiresAt: new Date(Date.now() + 60_000), roleId: 'role-1', createdByUid: 'inviter-1'
    });
    const token = Buffer.from('org-1:nested-1').toString('base64url');

    for (const [uid, email] of [['user-1', 'one@example.com'], ['user-2', 'two@example.com']] as const) {
      const handlers = createInvitationCompatibilityHandlers({ db, auth: authFor(uid, email), admin, hubFactory: () => fallbackHub() as any });
      const res = fakeRes();
      await handlers.accept({ headers: { authorization: `Bearer ${uid}` }, body: { token } }, res);
      expect(res.statusCode).toBe(200);
      expect(db.docs.get(`organizations/org-1/members/${uid}`)).toMatchObject({ organizationRole: 'member', role: 'member' });
      expect(db.docs.get(`organizations/org-1/musicscale_members/${uid}`)).toMatchObject({ roleId: 'role-1', source: 'legacy_nested_invite_migration', updatedByUid: 'inviter-1' });
    }

    expect(db.docs.get('organizations/org-1/invites/nested-1').status).toBe('pending');
    expect(Array.from(db.docs.values()).filter(value => value?.action === 'organization.invite.legacy_nested_migrated')).toHaveLength(2);
  });

  it('denies path/org mismatch and non-pending nested invite', async () => {
    for (const variant of ['mismatch', 'accepted'] as const) {
      const db = new FakeDb(); seedLegacyBase(db);
      db.seed('organizations/org-1/invites/nested-1', {
        organizationId: variant === 'mismatch' ? 'org-2' : 'org-1',
        status: variant === 'accepted' ? 'accepted' : 'pending',
        expiresAt: new Date(Date.now() + 60_000), roleId: 'role-1'
      });
      const token = Buffer.from('org-1:nested-1').toString('base64url');
      const handlers = createInvitationCompatibilityHandlers({ db, auth: authFor('user-1', 'current@example.com'), admin, hubFactory: () => fallbackHub() as any });
      const res = fakeRes();
      await handlers.accept({ headers: { authorization: 'Bearer token' }, body: { token } }, res);
      expect(res.statusCode).not.toBe(200);
      expect(db.docs.has('organizations/org-1/members/user-1')).toBe(false);
    }
  });
});
