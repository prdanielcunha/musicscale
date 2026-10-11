import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/server/organizationAuthorization.js', () => ({
  resolveOrganizationAuthorization: vi.fn(async () => ({
    context: { uid: 'actor', organizationRole: 'member', isOwner: false, isActive: true, systemRole: null },
  })),
}));
import { medleyTemplateRoutes } from '../../services/server/medleyTemplateRoutes.js';

function fixture(role = 'leader', status = 'active', songOrganization = 'org-a') {
  const records = new Map<string, any>([
    ['organizations/org-a', { status: 'active', apps: { musicscale: { status: 'active' } } }],
    ['subscriptions/org-a', { status: 'active' }],
    ['organizations/org-a/members/actor', { status, role, organizationRole: role }],
    ['songs/song1', { organizationId: songOrganization }],
    ['users/actor', { displayName: 'Worship Leader' }],
  ]);
  let sequence = 0;
  const doc = (path: string): any => ({
    id: path.split('/').pop(),
    get: async () => ({ exists: records.has(path), data: () => records.get(path) }),
    collection: (sub: string) => collection(path + '/' + sub),
  });
  const collection = (path: string): any => ({
    doc: (id?: string) => doc(path + '/' + (id || 'auto-' + (++sequence))),
    where: (_field: string, _op: string, value: string) => ({
      limit: (_size: number) => ({
        get: async () => ({
          docs: [...records.entries()]
            .filter(([key, data]) => key.startsWith(path + '/') && data.organizationId === value)
            .map(([key, data]) => ({ id: key.split('/').pop(), data: () => data })),
        }),
      }),
    }),
  });
  const db: any = {
    collection,
    runTransaction: async (callback: any) => callback({
      get: async (ref: any) => {
        const key = 'medleyTemplates/' + ref.id;
        return { exists: records.has(key), data: () => records.get(key) };
      },
      create: (ref: any, value: any) => {
        const path = String(ref.id).startsWith('ms_') ? 'medleyTemplates/' + ref.id : 'audits/' + ref.id;
        records.set(path, value);
      },
    }),
  };
  const req = (payload: unknown = null): any => ({
    headers: { authorization: 'Bearer valid', 'x-organization-id': 'org-a', 'idempotency-key': 'medley-test-1234' },
    body: payload,
  });
  const res = (): any => {
    const output: any = { code: 0, body: null, status(code: number) { this.code = code; return this; },
      set() { return this; }, json(data: unknown) { this.body = data; return this; } };
    return output;
  };
  return { db, records, req, res };
}

const draft = { name: 'João viu + Além do rio azul', arrangement: { id: 'medley', steps: [{ id: 'step1', songId: 'song1' }] } };

describe('MusicScale medley server fallback permissions', () => {
  for (const role of ['owner', 'admin', 'leader', 'worship_leader', 'minister', 'ministro', 'Líder']) {
    it('saves for active ' + role + ' and preserves tenant', async () => {
      const f = fixture(role);
      const handler = medleyTemplateRoutes(f.db, {});
      const result = f.res();
      await handler.create(f.req(draft), result);
      expect(result.code).toBe(201);
      expect(f.records.get('medleyTemplates/' + result.body.id)).toMatchObject({
        organizationId: 'org-a', name: draft.name,
      });
    });
  }
  it('rejects an ordinary member and suspended leaders', async () => {
    for (const f of [fixture('member'), fixture('leader', 'suspended')]) {
      const res = f.res();
      await medleyTemplateRoutes(f.db, {}).create(f.req(draft), res);
      expect(res.code).toBe(403);
      expect([...f.records.keys()].filter(key => key.startsWith('medleyTemplates/'))).toEqual([]);
    }
  });
  it('rejects references to songs in other organizations', async () => {
    const f = fixture('leader', 'active', 'org-b');
    const res = f.res();
    await medleyTemplateRoutes(f.db, {}).create(f.req(draft), res);
    expect(res.code).toBe(403);
    expect(res.body.error).toBe('CROSS_TENANT_SONG');
  });
  it('rejects invalid or empty templates', async () => {
    const f = fixture();
    const res = f.res();
    await medleyTemplateRoutes(f.db, {}).create(f.req({ name: ' ', arrangement: draft.arrangement }), res);
    expect(res.code).toBe(400);
  });
});
