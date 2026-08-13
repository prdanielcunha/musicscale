import { describe, expect, it, vi } from 'vitest';
import { createMemberRemovalCompatibilityHandler } from '../../services/server/musicScaleMemberRemovalCompatibility';
import { HubMemberRemovalError } from '../../services/server/hubMemberRemovalAdapter';

function responseRecorder() {
  const state: any = { statusCode: 200, body: undefined };
  return {
    state,
    res: {
      status(code: number) { state.statusCode = code; return this; },
      json(body: any) { state.body = body; return body; }
    }
  };
}

function fakeDb(options: { deleteFails?: boolean } = {}) {
  const deletes: string[] = [];
  const ref = (path: string): any => ({
    collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }),
    delete: async () => {
      deletes.push(path);
      if (options.deleteFails) throw new Error('projection delete failed');
    }
  });
  return {
    db: { collection: (name: string) => ({ doc: (id: string) => ref(`${name}/${id}`) }) },
    deletes
  };
}

const validHub = (reasonCode = 'MEMBER_REMOVED') => ({
  success: true as const,
  reasonCode,
  organizationId: 'org-1',
  memberId: 'member-1',
  activeOrganizationId: null,
  primaryOrganizationId: null
});

async function invoke(options: {
  bearer?: string;
  uid?: string;
  organizationId?: string;
  memberId?: string;
  hubRemove?: any;
  deleteFails?: boolean;
} = {}) {
  const store = fakeDb({ deleteFails: options.deleteFails });
  const hubRemove = options.hubRemove || vi.fn(async () => validHub());
  const logger = { error: vi.fn(), warn: vi.fn() };
  const auth = {
    verifyIdToken: vi.fn(async (token: string) => {
      if (token === 'invalid') throw new Error('invalid');
      return { uid: options.uid || 'actor-1' };
    })
  };
  const handler = createMemberRemovalCompatibilityHandler({
    db: store.db,
    auth,
    logger,
    hubFactory: () => ({ remove: hubRemove })
  });
  const out = responseRecorder();
  await handler({
    headers: { authorization: options.bearer === undefined ? 'Bearer token' : options.bearer },
    params: {
      organizationId: options.organizationId || 'org-1',
      memberId: options.memberId || 'member-1'
    }
  }, out.res);
  return { ...out.state, store, hubRemove, auth, logger };
}

describe('02D MusicScale member-removal compatibility handler', () => {
  it('denies missing bearer before Hub call', async () => {
    const result = await invoke({ bearer: '' });
    expect(result.statusCode).toBe(401);
    expect(result.body.reasonCode).toBe('UNAUTHORIZED');
    expect(result.hubRemove).not.toHaveBeenCalled();
    expect(result.store.deletes).toEqual([]);
  });

  it('denies invalid Firebase token before Hub call', async () => {
    const result = await invoke({ bearer: 'Bearer invalid' });
    expect(result.statusCode).toBe(401);
    expect(result.hubRemove).not.toHaveBeenCalled();
    expect(result.store.deletes).toEqual([]);
  });

  it('denies unsafe path before Hub call', async () => {
    const result = await invoke({ organizationId: '../bad' });
    expect(result.statusCode).toBe(400);
    expect(result.body.reasonCode).toBe('INVALID_REQUEST_PATH');
    expect(result.hubRemove).not.toHaveBeenCalled();
  });

  it('forwards exact Bearer and path to Hub then deletes only MusicScale projection', async () => {
    const result = await invoke({ bearer: 'Bearer exact-token' });
    expect(result.statusCode).toBe(200);
    expect(result.hubRemove).toHaveBeenCalledWith('Bearer exact-token', 'org-1', 'member-1');
    expect(result.store.deletes).toEqual(['organizations/org-1/musicscale_members/member-1']);
    expect(result.body).toMatchObject({ success: true, reasonCode: 'MEMBER_REMOVED', projectionCleanupApplied: true });
  });

  it('replay ALREADY_REMOVED still cleans stale MusicScale projection', async () => {
    const hubRemove = vi.fn(async () => validHub('ALREADY_REMOVED'));
    const result = await invoke({ hubRemove });
    expect(result.statusCode).toBe(200);
    expect(result.body.reasonCode).toBe('ALREADY_REMOVED');
    expect(result.store.deletes).toEqual(['organizations/org-1/musicscale_members/member-1']);
  });

  it('canonical Hub success remains authoritative if projection cleanup fails', async () => {
    const result = await invoke({ deleteFails: true });
    expect(result.statusCode).toBe(200);
    expect(result.body).toMatchObject({ success: true, reasonCode: 'MEMBER_REMOVED', projectionCleanupApplied: false });
    expect(result.logger.warn).toHaveBeenCalledTimes(1);
  });

  it('Hub denial prevents every local projection mutation', async () => {
    const hubRemove = vi.fn(async () => { throw new HubMemberRemovalError(403, 'PERMISSION_DENIED'); });
    const result = await invoke({ hubRemove });
    expect(result.statusCode).toBe(403);
    expect(result.body.reasonCode).toBe('PERMISSION_DENIED');
    expect(result.store.deletes).toEqual([]);
  });

  it('Hub owner-transfer blocker is preserved and causes no local cleanup', async () => {
    const hubRemove = vi.fn(async () => { throw new HubMemberRemovalError(409, 'OWNER_REMOVAL_REQUIRES_TRANSFER'); });
    const result = await invoke({ hubRemove });
    expect(result.statusCode).toBe(409);
    expect(result.store.deletes).toEqual([]);
  });

  it('ambiguous Hub failure is fail-closed and causes no local cleanup', async () => {
    const hubRemove = vi.fn(async () => { throw new HubMemberRemovalError(503, 'HUB_UNAVAILABLE', true); });
    const result = await invoke({ hubRemove });
    expect(result.statusCode).toBe(503);
    expect(result.store.deletes).toEqual([]);
    expect(result.logger.error).toHaveBeenCalledTimes(1);
  });

  it('actor uid is verified locally but never sent as removal authority body', async () => {
    const result = await invoke({ uid: 'actor-from-token' });
    expect(result.auth.verifyIdToken).toHaveBeenCalledWith('token', true);
    expect(result.hubRemove).toHaveBeenCalledWith('Bearer token', 'org-1', 'member-1');
  });
});
