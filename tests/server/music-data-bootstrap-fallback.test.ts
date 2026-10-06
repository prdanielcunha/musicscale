import { describe, expect, it, vi } from 'vitest';
import { createMusicDataBootstrapHandler } from '../../services/server/musicDataBootstrap.js';

const makeResponse = () => {
  const response: any = {
    statusCode: 200,
    body: null,
    headers: {},
  };
  response.status = vi.fn((statusCode: number) => {
    response.statusCode = statusCode;
    return response;
  });
  response.json = vi.fn((body: any) => {
    response.body = body;
    return response;
  });
  response.set = vi.fn((key: string, value: string) => {
    response.headers[key] = value;
    return response;
  });
  return response;
};

const makeDb = (organizationId = 'org-1') => {
  const calls: Array<{ collection: string; field: string; op: string; value: string }> = [];
  const payloads: Record<string, any[]> = {
    songs: [{ id: 'song-1', organizationId, title: 'Song' }],
    scales: [{ id: 'scale-1', organizationId, songIds: ['song-1'] }],
    bandScales: [{ id: 'band-1', organizationId, assignments: [] }],
    fixedBandScales: [{ id: 'fixed-1', organizationId, name: 'Banda Principal', assignments: [] }],
    eventTypes: [{ id: 'type-1', organizationId, name: 'Culto' }],
    locations: [{ id: 'location-1', organizationId, name: 'Templo' }],
  };

  return {
    calls,
    collection: vi.fn((collection: string) => ({
      where: vi.fn((field: string, op: string, value: string) => {
        calls.push({ collection, field, op, value });
        return {
          get: vi.fn(async () => ({
            docs: (payloads[collection] || []).map((item) => ({
              id: item.id,
              data: () => {
                const { id, ...data } = item;
                return data;
              },
            })),
          })),
        };
      }),
    })),
  };
};

describe('MusicData server bootstrap fallback', () => {
  it('reads every critical collection with the exact authorized organization filter', async () => {
    const db = makeDb('org-1');
    const resolveAuthorization = vi.fn(async () => ({
      context: {
        uid: 'user-1',
        systemRole: null,
        organizationRole: 'member',
        isActive: true,
        isOwner: false,
        capabilities: [],
      },
    }));
    const handler = createMusicDataBootstrapHandler({
      db,
      auth: {},
      resolveAuthorization: resolveAuthorization as any,
    });
    const res = makeResponse();

    await handler({
      query: { organizationId: 'org-1' },
      headers: { authorization: 'Bearer token' },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.organizationId).toBe('org-1');
    expect(Object.keys(res.body.data).sort()).toEqual(
      ['bandScales', 'eventTypes', 'fixedBandScales', 'locations', 'scales', 'songs'].sort()
    );
    expect(db.calls).toHaveLength(6);
    for (const call of db.calls) {
      expect(call).toEqual(expect.objectContaining({
        field: 'organizationId',
        op: '==',
        value: 'org-1',
      }));
    }
    expect(res.headers['Cache-Control']).toContain('no-store');
  });

  it('fails closed before any tenant data read when canonical authorization is inactive', async () => {
    const db = makeDb('org-1');
    const handler = createMusicDataBootstrapHandler({
      db,
      auth: {},
      resolveAuthorization: vi.fn(async () => ({
        context: {
          uid: 'user-1',
          systemRole: null,
          organizationRole: 'member',
          isActive: false,
          isOwner: false,
          capabilities: [],
        },
      })) as any,
    });
    const res = makeResponse();

    await handler({
      query: { organizationId: 'org-1' },
      headers: { authorization: 'Bearer token' },
    }, res);

    expect(res.statusCode).toBe(403);
    expect(db.calls).toHaveLength(0);
  });

  it('propagates authentication/authorization failures without reading Firestore collections', async () => {
    const db = makeDb('org-1');
    const handler = createMusicDataBootstrapHandler({
      db,
      auth: {},
      resolveAuthorization: vi.fn(async () => ({
        statusCode: 401,
        error: 'INVALID_ID_TOKEN',
      })) as any,
    });
    const res = makeResponse();

    await handler({
      query: { organizationId: 'org-1' },
      headers: { authorization: 'Bearer expired' },
    }, res);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('INVALID_ID_TOKEN');
    expect(db.calls).toHaveLength(0);
  });

  it('allows a canonical global role to recover reads without tenant membership', async () => {
    const db = makeDb('org-1');
    const handler = createMusicDataBootstrapHandler({
      db,
      auth: {},
      resolveAuthorization: vi.fn(async () => ({
        context: {
          uid: 'global-1',
          systemRole: 'global_admin',
          organizationRole: null,
          isActive: true,
          isOwner: false,
          capabilities: [],
        },
      })) as any,
    });
    const res = makeResponse();

    await handler({
      query: { organizationId: 'org-1' },
      headers: { authorization: 'Bearer token' },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(db.calls).toHaveLength(6);
  });
});
