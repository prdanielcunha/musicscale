import { describe, expect, it, vi } from 'vitest';
import { HubJoinRequestError } from '../../services/server/hubJoinRequestAdapter';
import {
  createJoinRequestCompatibilityHandlers,
  resolveUniqueActiveOwnerOrganization
} from '../../services/server/musicScaleJoinRequestCompatibility';

type OrgRecord = { id: string; data: Record<string, any> };

function fakeDb(records: OrgRecord[]) {
  const queryCalls: Array<{ field: string; value: string }> = [];
  const writeAttempts: string[] = [];
  return {
    queryCalls,
    writeAttempts,
    db: {
      collection: (name: string) => {
        if (name !== 'organizations') {
          writeAttempts.push(`unexpected-collection:${name}`);
          throw new Error(`unexpected collection ${name}`);
        }
        return {
          where: (field: string, op: string, value: string) => {
            expect(op).toBe('==');
            queryCalls.push({ field, value });
            return {
              get: async () => ({
                docs: records
                  .filter(record => record.data[field] === value)
                  .map(record => ({ id: record.id, data: () => record.data }))
              })
            };
          },
          doc: () => {
            writeAttempts.push('doc');
            throw new Error('local document authority must not be used');
          }
        };
      },
      runTransaction: () => {
        writeAttempts.push('transaction');
        throw new Error('local transaction authority must not be used');
      }
    }
  };
}

function fakeAuth(ownerUid = 'owner-1') {
  return {
    verifyIdToken: vi.fn(async (token: string, checkRevoked: boolean) => {
      expect(checkRevoked).toBe(true);
      if (token === 'bad') throw new Error('invalid');
      return { uid: 'requester-1' };
    }),
    getUserByEmail: vi.fn(async (email: string) => {
      if (email === 'missing@example.com') throw new Error('missing');
      return { uid: ownerUid, email, disabled: false };
    })
  };
}

function invoke(handler: (req: any, res: any) => any, req: any) {
  const state: any = { statusCode: 200, body: undefined };
  const res: any = {
    status(code: number) { state.statusCode = code; return res; },
    json(body: any) { state.body = body; return res; }
  };
  return Promise.resolve(handler(req, res)).then(() => state);
}

describe('02C owner-email discovery is discovery only', () => {
  it('normalizes owner email and resolves exactly one active owner organization', async () => {
    const store = fakeDb([
      { id: 'org-1', data: { status: 'active', ownerUid: 'owner-1' } },
      { id: 'archived', data: { status: 'active', archived: true, ownerId: 'owner-1' } },
      { id: 'inactive', data: { status: 'inactive', ownerUserId: 'owner-1' } }
    ]);
    await expect(resolveUniqueActiveOwnerOrganization(store.db, fakeAuth(), ' Owner@Example.COM ')).resolves.toBe('org-1');
    expect(store.queryCalls).toHaveLength(4);
    expect(store.queryCalls.every(call => call.value === 'owner-1')).toBe(true);
    expect(store.writeAttempts).toEqual([]);
  });

  it('fails closed for missing, inactive-only, disabled, or ambiguous ownership', async () => {
    const empty = fakeDb([]);
    await expect(resolveUniqueActiveOwnerOrganization(empty.db, fakeAuth(), 'missing@example.com')).rejects.toMatchObject({ status: 404 });

    const inactive = fakeDb([{ id: 'org-1', data: { status: 'inactive', ownerUid: 'owner-1' } }]);
    await expect(resolveUniqueActiveOwnerOrganization(inactive.db, fakeAuth(), 'owner@example.com')).rejects.toMatchObject({ status: 404 });

    const disabledAuth = fakeAuth();
    disabledAuth.getUserByEmail = vi.fn(async () => ({ uid: 'owner-1', disabled: true })) as any;
    await expect(resolveUniqueActiveOwnerOrganization(fakeDb([]).db, disabledAuth, 'owner@example.com')).rejects.toMatchObject({ status: 404 });

    const ambiguous = fakeDb([
      { id: 'org-1', data: { status: 'active', ownerUid: 'owner-1' } },
      { id: 'org-2', data: { status: 'active', ownerId: 'owner-1' } }
    ]);
    await expect(resolveUniqueActiveOwnerOrganization(ambiguous.db, fakeAuth(), 'owner@example.com')).rejects.toMatchObject({ status: 409, reasonCode: 'OWNER_HAS_MULTIPLE_ORGANIZATIONS' });
  });
});

describe('02C compatibility handlers have zero local membership authority', () => {
  it('create ignores body userId authority and forwards exact caller bearer plus discovered org to Hub', async () => {
    const store = fakeDb([{ id: 'org-1', data: { status: 'active', ownerUid: 'owner-1' } }]);
    const auth = fakeAuth();
    const hubCreate = vi.fn(async (bearer: string, organizationId: string) => {
      expect(bearer).toBe('Bearer requester-token');
      expect(organizationId).toBe('org-1');
      return { success: true as const, reasonCode: 'JOIN_REQUEST_CREATED', organizationId, requestId: 'requester-1', generation: 1 };
    });
    const handlers = createJoinRequestCompatibilityHandlers({
      db: store.db,
      auth,
      hubFactory: () => ({ create: hubCreate, approve: vi.fn(), reject: vi.fn() }) as any
    });
    const result = await invoke(handlers.create, {
      headers: { authorization: 'Bearer requester-token' },
      body: { ownerEmail: 'owner@example.com', userId: 'attacker', organizationId: 'attacker-org', role: 'owner' }
    });
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ success: true, requestId: 'requester-1' });
    expect(auth.verifyIdToken).toHaveBeenCalledWith('requester-token', true);
    expect(hubCreate).toHaveBeenCalledTimes(1);
    expect(store.writeAttempts).toEqual([]);
  });

  it('approve and reject only verify caller and delegate exact path ids to Hub', async () => {
    const store = fakeDb([]);
    const auth = fakeAuth();
    const approve = vi.fn(async (bearer, orgId, requestId) => ({ success: true, reasonCode: 'JOIN_REQUEST_APPROVED', organizationId: orgId, requestId, generation: 1 }));
    const reject = vi.fn(async (bearer, orgId, requestId) => ({ success: true, reasonCode: 'JOIN_REQUEST_REJECTED', organizationId: orgId, requestId, generation: 1 }));
    const handlers = createJoinRequestCompatibilityHandlers({ db: store.db, auth, hubFactory: () => ({ create: vi.fn(), approve, reject }) as any });

    const approved = await invoke(handlers.approve, { headers: { authorization: 'Bearer actor-token' }, params: { organizationId: 'org-1', requestId: 'requester-1' } });
    const rejected = await invoke(handlers.reject, { headers: { authorization: 'Bearer actor-token' }, params: { organizationId: 'org-1', requestId: 'requester-2' } });

    expect(approved.statusCode).toBe(200);
    expect(rejected.statusCode).toBe(200);
    expect(approve).toHaveBeenCalledWith('Bearer actor-token', 'org-1', 'requester-1');
    expect(reject).toHaveBeenCalledWith('Bearer actor-token', 'org-1', 'requester-2');
    expect(store.queryCalls).toEqual([]);
    expect(store.writeAttempts).toEqual([]);
  });

  it('Hub timeout/5xx/malformed errors fail closed with no legacy or local fallback', async () => {
    for (const error of [
      new HubJoinRequestError(503, 'HUB_UNAVAILABLE', true),
      new HubJoinRequestError(500, 'INTERNAL_ERROR', true),
      new HubJoinRequestError(502, 'INVALID_HUB_RESPONSE', true)
    ]) {
      const store = fakeDb([{ id: 'org-1', data: { status: 'active', ownerUid: 'owner-1' } }]);
      const handlers = createJoinRequestCompatibilityHandlers({
        db: store.db,
        auth: fakeAuth(),
        hubFactory: () => ({ create: vi.fn(async () => { throw error; }), approve: vi.fn(), reject: vi.fn() }) as any
      });
      const result = await invoke(handlers.create, { headers: { authorization: 'Bearer requester-token' }, body: { ownerEmail: 'owner@example.com' } });
      expect(result.statusCode).toBe(error.status);
      expect(result.body.reasonCode).toBe(error.reasonCode);
      expect(store.writeAttempts).toEqual([]);
    }
  });

  it('invalid or missing bearer and malformed resolution path fail before Hub call', async () => {
    const store = fakeDb([]);
    const hub = { create: vi.fn(), approve: vi.fn(), reject: vi.fn() };
    const handlers = createJoinRequestCompatibilityHandlers({ db: store.db, auth: fakeAuth(), hubFactory: () => hub as any });
    expect((await invoke(handlers.create, { headers: {}, body: { ownerEmail: 'owner@example.com' } })).statusCode).toBe(401);
    expect((await invoke(handlers.approve, { headers: { authorization: 'Bearer actor-token' }, params: { organizationId: '../bad', requestId: 'u1' } })).statusCode).toBe(400);
    expect(hub.create).not.toHaveBeenCalled();
    expect(hub.approve).not.toHaveBeenCalled();
    expect(store.writeAttempts).toEqual([]);
  });
});
