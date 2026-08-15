import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { MusicScaleCommandService } from '../../services/server/scale/musicScaleCommandService.js';

vi.hoisted(() => {
  process.env.VERCEL = 'true';
});

// Define the mock database state and verifyIdToken mock
const mockDbState = new Map<string, any>();
const mockVerifyIdToken = vi.fn();

vi.mock('firebase-admin', () => {
  class MockDocRef {
    constructor(public path: string) {}
    get id() {
      return this.path.split('/').pop() || '';
    }
    collection(subCol: string) {
      return new MockColRef(`${this.path}/${subCol}`);
    }
    async get() {
      const data = mockDbState.get(this.path);
      return {
        exists: data !== undefined,
        data: () => data,
        id: this.id,
        ref: this,
      };
    }
    async set(data: any) {
      mockDbState.set(this.path, data);
    }
    async update(data: any) {
      const current = mockDbState.get(this.path) || {};
      mockDbState.set(this.path, { ...current, ...data });
    }
    async delete() {
      mockDbState.delete(this.path);
    }
  }

  class MockColRef {
    constructor(public path: string) {}
    get id() {
      return this.path.split('/').pop() || '';
    }
    doc(docId?: string) {
      const actualId = docId || `mock_id_${Math.random().toString(36).substring(7)}`;
      return new MockDocRef(`${this.path}/${actualId}`);
    }
    async add(data: any) {
      const docId = `mock_id_${Math.random().toString(36).substring(7)}`;
      const docRef = this.doc(docId);
      await docRef.set(data);
      return docRef;
    }
    where(field: string, op: string, value: any) {
      return {
        get: async () => {
          const results: any[] = [];
          for (const [key, val] of mockDbState.entries()) {
            const parts = key.split('/');
            const isDirectChild = parts.slice(0, parts.length - 1).join('/') === this.path;
            if (isDirectChild && val[field] === value) {
              results.push({
                exists: true,
                data: () => val,
                id: key.split('/').pop(),
              });
            }
          }
          return {
            docs: results,
            size: results.length,
            empty: results.length === 0,
          };
        }
      };
    }
    async get() {
      const results: any[] = [];
      for (const [key, val] of mockDbState.entries()) {
        const parts = key.split('/');
        const isDirectChild = parts.slice(0, parts.length - 1).join('/') === this.path;
        if (isDirectChild) {
          results.push({
            exists: true,
            data: () => val,
            id: key.split('/').pop(),
          });
        }
      }
      return {
        docs: results,
        size: results.length,
        empty: results.length === 0,
      };
    }
  }

  const mockAuth = {
    verifyIdToken: (token: string) => mockVerifyIdToken(token),
  };

  const mockFirestoreInstance = {
    collection: (colName: string) => new MockColRef(colName),
    doc: (path: string) => new MockDocRef(path),
    runTransaction: async (callback: any) => {
      const transaction = {
        get: async (ref: any) => ref.get(),
        set: async (ref: any, data: any) => {
          mockDbState.set(ref.path, data);
          return transaction;
        },
        update: async (ref: any, data: any) => {
          const current = mockDbState.get(ref.path) || {};
          mockDbState.set(ref.path, { ...current, ...data });
          return transaction;
        },
        delete: async (ref: any) => {
          mockDbState.delete(ref.path);
          return transaction;
        },
      };
      return callback(transaction);
    },
    batch: () => {
      return {
        set: (ref: any, data: any) => {
          mockDbState.set(ref.path, data);
        },
        update: (ref: any, data: any) => {
          const current = mockDbState.get(ref.path) || {};
          mockDbState.set(ref.path, { ...current, ...data });
        },
        commit: async () => {},
      };
    }
  };

  (globalThis as any).mockFirestoreInstance = mockFirestoreInstance;

  const mockFirestoreFunc = () => mockFirestoreInstance;
  (mockFirestoreFunc as any).FieldValue = {
    serverTimestamp: () => 'mock_timestamp',
    arrayUnion: (...elements: any[]) => elements,
    arrayRemove: (...elements: any[]) => elements,
  };

  return {
    default: {
      apps: [ { name: '[DEFAULT]' } ],
      initializeApp: () => {},
      credential: {
        cert: () => ({}),
      },
      auth: () => mockAuth,
      firestore: mockFirestoreFunc,
    }
  };
});

vi.mock('firebase-admin/firestore', () => {
  return {
    getFirestore: () => (globalThis as any).mockFirestoreInstance,
    FieldValue: {
      serverTimestamp: () => 'mock_timestamp',
      arrayUnion: (...elements: any[]) => elements,
      arrayRemove: (...elements: any[]) => elements,
    }
  };
});

// Import our Express application
import app from '../../server.js';

describe('MusicScale Express HTTP Contract with Mocked Firebase Admin', () => {
  beforeEach(() => {
    mockDbState.clear();
    mockVerifyIdToken.mockReset();
  });

  // Helper to pre-seed the mock database
  const seedStandardUserAndOrg = (params: {
    userId?: string;
    orgId?: string;
    role?: string;
    isOwner?: boolean;
    orgStatus?: string;
    flagPublish?: boolean;
    flagResponse?: boolean;
    scaleId?: string;
    scaleOrgId?: string;
    bandScaleId?: string;
    scaleStatus?: 'draft' | 'published' | 'cancelled' | 'completed';
    membership?: boolean;
    systemRole?: string;
  } = {}) => {
    const userId = params.userId || 'user_123';
    const orgId = params.orgId || 'org_123';
    const role = params.role || 'admin';
    const isOwner = params.isOwner !== false;
    const orgStatus = params.orgStatus || 'active';
    const flagPublish = params.flagPublish !== false;
    const flagResponse = params.flagResponse !== false;
    const scaleId = params.scaleId || 'scale_123';
    const scaleOrgId = params.scaleOrgId || orgId;
    const bandScaleId = params.bandScaleId || 'band_scale_123';
    const scaleStatus = params.scaleStatus || 'draft';

    // Seed User
    mockDbState.set(`users/${userId}`, {
      uid: userId,
      email: 'user@test.com',
      displayName: 'Test User',
      systemRole: params.systemRole || 'member',
    });

    // Seed Org
    mockDbState.set(`organizations/${orgId}`, {
      name: 'Test Org',
      status: orgStatus,
      ownerUid: isOwner ? userId : 'other_owner',
      ownerUserId: isOwner ? userId : 'other_owner',
      featureFlags: {
        'musicscale.musicScalePublishCommandV1': flagPublish,
        'musicscale.scaleResponsesV1': flagResponse,
      },
    });

    // Seed Membership
    if (params.membership !== false) {
      mockDbState.set(`organizations/${orgId}/members/${userId}`, {
        userId,
        organizationId: orgId,
        status: 'active',
        role,
        organizationRole: role,
      });
    }

    // Seed Location and Event Type
    mockDbState.set(`locations/loc_123`, { organizationId: scaleOrgId, name: 'Sede', active: true });
    mockDbState.set(`eventTypes/type_123`, { organizationId: scaleOrgId, name: 'Culto', active: true });

    // Seed Instrument
    mockDbState.set(`instruments/instr_vocal`, {
      id: 'instr_vocal',
      organizationId: scaleOrgId,
      name: 'Vocal',
      category: 'Voz',
      active: true,
    });

    // Seed Song
    mockDbState.set(`songs/song_123`, {
      id: 'song_123',
      organizationId: scaleOrgId,
      title: 'Música Sintética',
      artist: 'Artista Teste',
      key: 'C',
    });

    // Seed Scale
    mockDbState.set(`scales/${scaleId}`, {
      id: scaleId,
      organizationId: scaleOrgId,
      title: 'Culto Especial',
      date: '2026-08-10',
      time: '19:00',
      status: scaleStatus,
      songIds: ['song_123'],
      locationId: 'loc_123',
      eventTypeId: 'type_123',
      bandScaleId,
    });

    // Seed BandScale
    mockDbState.set(`bandScales/${bandScaleId}`, {
      id: bandScaleId,
      organizationId: scaleOrgId,
      assignments: [
        { userId: 'user_123', instrumentId: 'instr_vocal', active: true },
      ],
    });
  };

  const patchScale = (payload: Record<string, unknown> = { scalePatch: { observations: 'saved' } }) => request(app)
    .patch('/api/v1/music-scales/scale_123')
    .set('authorization', 'Bearer valid-token')
    .set('x-organization-id', 'org_123')
    .set('idempotency-key', `save_${Math.random()}`)
    .send(payload);

  it.each(['owner', 'admin', 'leader'])('save authorizes canonical active %s', async role => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg({ role, isOwner: role === 'owner' });
    const res = await patchScale();
    expect(res.status).toBe(200);
    expect(mockDbState.get('scales/scale_123')).toMatchObject({ observations: 'saved', status: 'draft', organizationId: 'org_123' });
  });

  it('save authorizes organization owner without membership', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg({ role: 'member', isOwner: true, membership: false });
    expect((await patchScale()).status).toBe(200);
  });

  it.each(['global_admin', 'ecosystem_owner'])('save authorizes canonical %s without membership', async systemRole => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg({ isOwner: false, membership: false, systemRole });
    expect((await patchScale()).status).toBe(200);
  });

  it.each(['member', 'visitor'])('save denies canonical %s without scales.update', async role => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg({ role, isOwner: false });
    expect((await patchScale()).status).toBe(403);
  });

  it('save denies inactive membership and cross-tenant target', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg({ role: 'leader', isOwner: false });
    mockDbState.set('organizations/org_123/members/user_123', { status: 'inactive', organizationRole: 'leader' });
    expect((await patchScale()).status).toBe(403);

    seedStandardUserAndOrg({ role: 'leader', isOwner: false, scaleOrgId: 'org_other' });
    expect((await patchScale()).status).toBe(403);
  });

  it('save denies an unaffiliated ordinary user', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg({ isOwner: false, membership: false });
    expect((await patchScale()).status).toBe(403);
  });

  it('save maps already-linked to 409 and sanitizes unexpected 500 errors', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg({ role: 'leader', isOwner: false });
    mockDbState.set('bandScales/band_scale_123', { organizationId: 'org_123', musicScaleId: 'scale-other', assignments: [] });
    const linked = await patchScale({ scalePatch: {}, bandScaleId: 'band_scale_123' });
    expect(linked.status).toBe(409);
    expect(linked.body).toMatchObject({ error: 'BAND_SCALE_ALREADY_LINKED', code: 'BAND_SCALE_ALREADY_LINKED' });

    const spy = vi.spyOn(MusicScaleCommandService, 'saveMusicScale').mockRejectedValueOnce(new Error('sensitive admin detail'));
    const unexpected = await patchScale();
    spy.mockRestore();
    expect(unexpected.status).toBe(500);
    expect(unexpected.body).toMatchObject({ error: 'SAVE_FAILED', code: 'SAVE_FAILED' });
    expect(JSON.stringify(unexpected.body)).not.toContain('sensitive admin detail');
  });

  it('1. sem Authorization -> deve retornar 401', async () => {
    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_1')
      .send({});
    expect(res.status).toBe(401);
  });

  it('2. token inválido -> deve retornar 401', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Auth Token Expired'));
    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer expired-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_1')
      .send({});
    expect(res.status).toBe(401);
  });

  it('3. sem X-Organization-Id -> deve retornar 400', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('idempotency-key', 'idemp_1')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('X-Organization-Id');
  });

  it('4. organização arquivada -> deve retornar 404', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg({ orgStatus: 'archived' });

    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_1')
      .send({});
    expect(res.status).toBe(404);
  });

  it('5. membership inativa -> deve retornar 403', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg({ role: 'member', isOwner: false });
    // Override membership to inactive
    mockDbState.set('organizations/org_123/members/user_123', {
      userId: 'user_123',
      organizationId: 'org_123',
      status: 'inactive',
      role: 'member',
    });

    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_1')
      .send({});
    expect(res.status).toBe(403);
  });

  it('6. sem capability (papel visitante/member comum para publish) -> deve retornar 403', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    // Visitor cannot publish scales
    seedStandardUserAndOrg({ role: 'visitor', isOwner: false });

    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_1')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Sem permissão');
  });

  it('7. feature flag desligada -> deve retornar 403', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg({ flagPublish: false });

    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_1')
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Feature Flag');
  });

  it('8. payload inválido -> deve retornar 400 ou client error', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg();

    // Trigger error by sending invalid JSON or payload
    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_1')
      .send({ bandScaleId: 'non_existent_band' }); // BandScale does not exist
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('9. escala de outra organização -> deve retornar 403 ou erro de negócio', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    // Seed scale belonging to 'other_org'
    seedStandardUserAndOrg({ scaleOrgId: 'other_org' });

    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_1')
      .send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('10. sucesso -> deve retornar 200/201 e persistir o status como publicado', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg();

    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_success_1')
      .send({});
    expect(res.status).toBe(200);

    // Confirm scale status is updated in db
    const scale = mockDbState.get('scales/scale_123');
    expect(scale.status).toBe('published');
  });

  it('11. mesma Idempotency-Key e mesmo payload -> deve retornar o cache (sucesso repetido)', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg();

    const res1 = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_same_key')
      .send({ bandScaleId: 'band_scale_123' });
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_same_key')
      .send({ bandScaleId: 'band_scale_123' });
    expect(res2.status).toBe(200);
    expect(res2.body.fromCache).toBe(true);
  });

  it('12. mesma chave e payload diferente -> deve lançar conflito de idempotência (400)', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    seedStandardUserAndOrg();

    const res1 = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_diff_payload')
      .send({ bandScaleId: 'band_scale_123' });
    expect(res1.status).toBe(200);

    const res2 = await request(app)
      .post('/api/v1/music-scales/scale_123/publish')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_diff_payload')
      .send({ bandScaleId: 'different_band' });
    expect(res2.status).toBe(409);
    expect(res2.body.error).toContain('idempotência');
  });

  it('13. resposta de presença de usuário não escalado -> deve retornar erro de negócio (400)', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_not_escalado' });
    
    // Seed Org and User (who is not in assignments of band_scale_123)
    seedStandardUserAndOrg({ userId: 'user_not_escalado', role: 'member', isOwner: false, scaleStatus: 'published' });

    // Keep this authorization/business-rule scenario independent from wall-clock time.
    const seededScale = mockDbState.get('scales/scale_123');
    mockDbState.set('scales/scale_123', { ...seededScale, date: '2099-08-10', time: '19:00' });

    // Try to post response
    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/my-response')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_resp_1')
      .send({
        status: 'accepted',
        reason: null,
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('escalado');
  });

  it('14. resposta em escala de outra organização -> deve retornar 403 ou 400', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'user_123' });
    // Scale is in 'other_org'
    seedStandardUserAndOrg({ scaleOrgId: 'other_org', scaleStatus: 'published' });

    const res = await request(app)
      .post('/api/v1/music-scales/scale_123/my-response')
      .set('authorization', 'Bearer valid-token')
      .set('x-organization-id', 'org_123')
      .set('idempotency-key', 'idemp_resp_2')
      .send({
        status: 'accepted',
        reason: null,
      });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
