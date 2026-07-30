import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicScaleCommandService, ValidationError, PublishCommandError } from '../../services/server/scale/musicScaleCommandService.js';
import { IdempotencyService } from '../../services/server/bandScale/idempotencyService.js';

interface DocumentState {
  data: Record<string, unknown>;
  version: number;
}

interface TestDocumentRef {
  id: string;
  path: string;
  collection?: (subPath: string) => CollectionMockResult;
  _isQuery?: boolean;
}

interface TestQueryRef {
  _isQuery: boolean;
  get: () => Promise<TestQuerySnapshot>;
}

interface TestDocumentSnapshot {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
  id: string;
  ref?: TestDocumentRef;
}

interface TestQuerySnapshot {
  docs: TestDocumentSnapshot[];
  empty?: boolean;
}

interface CollectionMockResult {
  path: string;
  id: string;
  doc: (id?: string) => TestDocumentRef;
  get: () => Promise<TestQuerySnapshot>;
  where: (field: string, op: string, value: unknown) => TestQueryRef;
}

interface TestTransaction {
  reads: Set<string>;
  readVersions: Map<string, number>;
  writes: Array<{ type: 'set' | 'update' | 'delete', path: string, data?: Record<string, unknown> }>;
  get(ref: TestDocumentRef | TestQueryRef | CollectionMockResult): Promise<TestDocumentSnapshot | TestQuerySnapshot>;
  set(ref: TestDocumentRef, data: Record<string, unknown>): this;
  update(ref: TestDocumentRef, data: Record<string, unknown>): this;
  delete(ref: TestDocumentRef): this;
  commit(): void;
}

interface TestFirestore {
  runTransaction<T>(callback: (transaction: TestTransaction) => Promise<T>): Promise<T>;
  collection(path: string): CollectionMockResult;
}

function isQueryOrCollection(ref: TestDocumentRef | TestQueryRef | CollectionMockResult): ref is TestQueryRef | CollectionMockResult {
  return ref && 'get' in ref && typeof ref.get === 'function';
}

declare global {
  var dbState: Map<string, DocumentState>;
  var txStats: {
    callbackExecutions: number;
    commitAttempts: number;
    successfulCommits: number;
    conflicts: number;
  };
  var mockDbCycleRelease: TestFirestore;
  var setConflictPath: (path: string | null) => void;
  var getConflictPath: () => string | null;
  var resetMocks: () => void;
}

vi.mock('firebase-admin', () => {
  const dbState = new Map<string, { data: Record<string, unknown>; version: number }>();
  let autoIdCounter = 0;
  let conflictPathToInjectOnce: string | null = null;

  class TestTransactionEmulator implements TestTransaction {
    reads = new Set<string>();
    readVersions = new Map<string, number>();
    writes: { type: 'set' | 'update' | 'delete', path: string, data?: Record<string, unknown> }[] = [];
    
    constructor(private state: Map<string, { data: Record<string, unknown>; version: number }>) {}

    async get(ref: TestDocumentRef | TestQueryRef | CollectionMockResult): Promise<TestDocumentSnapshot | TestQuerySnapshot> {
      if (this.writes.length > 0) {
        throw new Error("READ_AFTER_WRITE");
      }
      if (isQueryOrCollection(ref)) {
        return ref.get();
      }
      const path = ref.path || ref.id;
      if (!path) throw new Error("Invalid ref");
      this.reads.add(path);
      const docState = this.state.get(path);
      const version = docState ? docState.version : 0;
      this.readVersions.set(path, version);
      if (docState !== undefined) {
        return { exists: true, data: () => docState.data, id: ref.id || path.split('/').pop() || '', ref };
      }
      return { exists: false, data: () => undefined, id: ref.id || path.split('/').pop() || '', ref };
    }

    set(ref: TestDocumentRef, data: Record<string, unknown>) {
      const path = ref.path || ref.id;
      if (!path) throw new Error("Invalid ref");
      this.writes.push({ type: 'set', path, data });
      return this;
    }

    update(ref: TestDocumentRef, data: Record<string, unknown>) {
      const path = ref.path || ref.id;
      if (!path) throw new Error("Invalid ref");
      this.writes.push({ type: 'update', path, data });
      return this;
    }

    delete(ref: TestDocumentRef) {
      const path = ref.path || ref.id;
      if (!path) throw new Error("Invalid ref");
      this.writes.push({ type: 'delete', path });
      return this;
    }

    commit() {
      for (const write of this.writes) {
        if (write.type === 'set') {
          this.state.set(write.path, { data: write.data!, version: (this.readVersions.get(write.path) || 0) + 1 });
        } else if (write.type === 'update') {
          const existing = this.state.get(write.path);
          const existingData = existing ? existing.data : {};
          const existingVersion = existing ? existing.version : 0;
          this.state.set(write.path, { data: { ...existingData, ...write.data! }, version: existingVersion + 1 });
        } else if (write.type === 'delete') {
          this.state.delete(write.path);
        }
      }
    }
  }

  const collectionMock = (basePath: string): CollectionMockResult => ({
    path: basePath,
    id: basePath.split("/").pop() || '',
    doc: (id?: string) => {
      autoIdCounter++;
      const docPath = id ? `${basePath}/${id}` : `${basePath}/auto-id-${autoIdCounter}`;
      const docId = id || docPath.split('/').pop() || '';
      return { 
        id: docId, 
        path: docPath, 
        collection: (subPath: string) => collectionMock(`${docPath}/${subPath}`)
      };
    },
    get: async () => {
      const docs: TestDocumentSnapshot[] = [];
      dbState.forEach((val, key) => {
        if (key.startsWith(basePath)) {
          // ensure we don't return nested subcollection docs if only fetching parent level
          const relativeKey = key.slice(basePath.length + 1);
          if (!relativeKey.includes('/')) {
            docs.push({ 
              exists: true, 
              id: key.split('/').pop() || '', 
              data: () => val.data, 
              ref: { id: key.split('/').pop() || '', path: key } 
            });
          }
        }
      });
      return { docs };
    },
    where: (field: string, op: string, value: unknown): TestQueryRef => ({
      _isQuery: true,
      get: async () => {
        const docs: TestDocumentSnapshot[] = [];
        dbState.forEach((val, key) => {
          let match = true;
          if (field === 'status' && val.data.status !== value) {
            match = false;
          }
          if (field === 'organizationId' && val.data.organizationId !== value) {
            match = false;
          }
          if (field === 'active' && val.data.active !== value) {
            match = false;
          }
          if (field === 'recipientId' && val.data.recipientId !== value) {
            match = false;
          }
          if (key.startsWith(basePath) && match) {
            docs.push({ 
              exists: true, 
              id: key.split('/').pop() || '', 
              data: () => val.data,
              ref: { id: key.split('/').pop() || '', path: key }
            });
          }
        });
        return { docs, empty: docs.length === 0 };
      }
    })
  });

  const txStats = {
    callbackExecutions: 0,
    commitAttempts: 0,
    successfulCommits: 0,
    conflicts: 0
  };

  const mockDb: TestFirestore = {
    runTransaction: async <T>(callback: (transaction: TestTransaction) => Promise<T>): Promise<T> => {
      let attempts = 0;
      while (attempts < 5) {
        attempts++;
        txStats.callbackExecutions++;
        const t = new TestTransactionEmulator(dbState);
        
        const result = await callback(t);
        
        txStats.commitAttempts++;

        if (conflictPathToInjectOnce && attempts === 1) {
          const path = conflictPathToInjectOnce;
          conflictPathToInjectOnce = null;
          
          const existing = dbState.get(path);
          if (existing) {
            dbState.set(path, { ...existing, version: existing.version + 1 });
          } else {
            dbState.set(path, { data: {}, version: 1 });
          }
        }

        let conflict = false;
        for (const [path, readVersion] of Array.from(t.readVersions.entries())) {
           const currentState = dbState.get(path);
           const currentVersion = currentState ? currentState.version : 0;
           if (readVersion !== currentVersion) {
              conflict = true;
              break;
           }
        }
        if (conflict) {
           txStats.conflicts++;
           continue;
        }
        
        t.commit();
        txStats.successfulCommits++;
        return result;
      }
      throw new Error("Max retries exceeded");
    },
    collection: (path: string) => collectionMock(path),
  };

  const mockFirestore = () => mockDb;
  mockFirestore.FieldValue = {
    serverTimestamp: () => 'server-timestamp'
  };

  const mockAdmin = {
    apps: { length: 1 },
    firestore: mockFirestore,
    auth: () => ({}),
    credential: {
      cert: () => ({})
    },
    initializeApp: () => {}
  };

  globalThis.dbState = dbState;
  globalThis.txStats = txStats;
  globalThis.mockDbCycleRelease = mockDb;
  globalThis.setConflictPath = (p: string | null) => { conflictPathToInjectOnce = p; };
  globalThis.getConflictPath = () => conflictPathToInjectOnce;
  globalThis.resetMocks = () => {
    dbState.clear();
    txStats.callbackExecutions = 0;
    txStats.commitAttempts = 0;
    txStats.successfulCommits = 0;
    txStats.conflicts = 0;
    conflictPathToInjectOnce = null;
  };

  return {
    admin: mockAdmin,
    default: mockAdmin
  };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => globalThis.mockDbCycleRelease,
  FieldValue: {
    serverTimestamp: () => 'server-timestamp'
  }
}));

// Setup mock state helper functions
function setupBasicEntities(orgId: string) {
  // Memberships
  globalThis.dbState.set(`organizations/${orgId}/members/u1`, {
    data: { name: 'Líder Daniel', status: 'active', userId: 'u1' },
    version: 1
  });
  globalThis.dbState.set(`organizations/${orgId}/members/u2`, {
    data: { name: 'Membro Ayessa', status: 'active', userId: 'u2' },
    version: 1
  });
  globalThis.dbState.set(`organizations/${orgId}/members/u3`, {
    data: { name: 'Membro Removido', status: 'active', userId: 'u3' },
    version: 1
  });

  // Cross memberships
  globalThis.dbState.set(`organization_members/${orgId}_u1`, {
    data: { organizationId: orgId, userId: 'u1', status: 'active' },
    version: 1
  });
  globalThis.dbState.set(`organization_members/${orgId}_u2`, {
    data: { organizationId: orgId, userId: 'u2', status: 'active' },
    version: 1
  });
  globalThis.dbState.set(`organization_members/${orgId}_u3`, {
    data: { organizationId: orgId, userId: 'u3', status: 'active' },
    version: 1
  });

  // Instruments
  globalThis.dbState.set(`instruments/inst-violao`, {
    data: { name: 'Violão', category: 'musical_instrument', organizationId: orgId },
    version: 1
  });
  globalThis.dbState.set(`instruments/inst-vocal`, {
    data: { name: 'Soprano', category: 'vocal', organizationId: orgId },
    version: 1
  });

  // Organization Doc
  globalThis.dbState.set(`organizations/${orgId}`, {
    data: { ownerId: 'u1', name: 'Lagoinha' },
    version: 1
  });
}

function setupBasicScale(orgId: string, scaleId: string, extraData: Record<string, unknown> = {}) {
  globalThis.dbState.set(`scales/${scaleId}`, {
    data: {
      id: scaleId,
      organizationId: orgId,
      date: '2026-08-10',
      time: '19:00',
      eventTypeId: 'culto-domingo',
      locationId: 'templo-principal',
      observations: 'Observações iniciais',
      songIds: ['song-1', 'song-2'],
      status: 'draft',
      publishRevision: 1,
      createdBy: { uid: 'u1', name: 'Líder Daniel' },
      createdAt: '2026-07-30T00:00:00Z',
      eventAssignments: [],
      ...extraData
    },
    version: 1
  });
}

function setupBandScale(orgId: string, bandScaleId: string, assignments: unknown[]) {
  globalThis.dbState.set(`bandScales/${bandScaleId}`, {
    data: {
      id: bandScaleId,
      organizationId: orgId,
      date: '2026-08-10',
      time: '19:00',
      assignments,
      createdBy: { uid: 'u1', name: 'Líder Daniel' },
      createdAt: '2026-07-30T00:00:00Z'
    },
    version: 1
  });
}

const validScalePatch = {
  date: '2026-08-10',
  time: '19:00',
  eventTypeId: 'culto-domingo',
  locationId: 'templo-principal',
  songIds: ['song-1', 'song-2']
};

describe('MusicScale Complete Lifecycle & E2E Release Candidate Certification', () => {
  beforeEach(() => {
    globalThis.resetMocks();
  });

  it('Scenario 1: Primeira Publicação (Draft -> Published)', async () => {
    const orgId = 'org-alpha';
    const scaleId = 'scale-alpha';
    const bandScaleId = 'band-alpha';

    setupBasicEntities(orgId);
    setupBasicScale(orgId, scaleId);
    
    // Escale u2 (Violão) and u1 (Vocal - but u1 is the publisher!)
    setupBandScale(orgId, bandScaleId, [
      { assignmentId: 'assign-u2', userId: 'u2', instrumentId: 'inst-violao', active: true },
      { assignmentId: 'assign-u1', userId: 'u1', instrumentId: 'inst-vocal', active: true }
    ]);

    const result = await MusicScaleCommandService.publishMusicScale({
      musicScaleId: scaleId,
      orgId,
      payload: { bandScaleId, scalePatch: validScalePatch },
      idempotencyKey: 'idemp-s1',
      authUid: 'u1',
      correlationId: 'corr-s1'
    });

    expect(result.version).toBe(2);
    expect(result.eventAssignmentCount).toBe(2);

    const scale = globalThis.dbState.get(`scales/${scaleId}`)?.data;
    expect(scale?.status).toBe('published');
    expect(scale?.publishRevision).toBe(2);
    expect(scale?.bandScaleId).toBe(bandScaleId);

    // Active response pending for each active assignment
    let activeResponses = 0;
    globalThis.dbState.forEach((val, key) => {
      if (key.startsWith(`scales/${scaleId}/responses/`)) {
        expect(val.data.status).toBe('pending');
        expect(val.data.active).toBe(true);
        activeResponses++;
      }
    });
    expect(activeResponses).toBe(2);

    // Notifications generated correctly
    let canonicalNotificationsCount = 0;
    let obsoleteNotificationsCount = 0;

    globalThis.dbState.forEach((val, key) => {
      if (key.startsWith(`organizations/${orgId}/notifications/`)) {
        canonicalNotificationsCount++;
        const notif = val.data;
        expect(notif.recipientId).toBe('u2'); // only u2, u1 is modifier and excluded!
        expect(notif.type).toBe('music_scale_assignment');
        expect(notif.isRead).toBe(false);
        expect(notif.isArchived).toBe(false);
        expect(notif.source).toBe('musicScale');
        expect(notif.sourceEventId).toBe(scaleId);
        expect(notif.idempotencyKey).toBe(IdempotencyService.getReceiptId(orgId, 'idemp-s1'));
      }
      if (key.includes('users/') && key.includes('/notifications')) {
        obsoleteNotificationsCount++;
      }
    });

    expect(canonicalNotificationsCount).toBe(1);
    expect(obsoleteNotificationsCount).toBe(0); // absolutely NO obsolete notification paths!

    // Idempotency receipt written
    let receiptExists = false;
    globalThis.dbState.forEach((val, key) => {
      if (key.includes(`/_commandReceipts/`)) {
        receiptExists = true;
        expect(val.data.entityId).toBe(scaleId);
        expect(val.data.commandType).toBe('musicScale.publish');
      }
    });
    expect(receiptExists).toBe(true);

    // Bidirectional link checked on bandScale
    const bandScale = globalThis.dbState.get(`bandScales/${bandScaleId}`)?.data;
    expect(bandScale?.musicScaleId).toBe(scaleId);
  });

  it('Scenario 2: Republicação ou Mudança de Banda (Reconciliação)', async () => {
    const orgId = 'org-beta';
    const scaleId = 'scale-beta';
    const oldBandScaleId = 'band-old';
    const newBandScaleId = 'band-new';

    setupBasicEntities(orgId);

    // Initial publish setup (Revision 2): u2 is Violão, u3 is Soprano
    setupBasicScale(orgId, scaleId, {
      status: 'published',
      publishRevision: 2,
      bandScaleId: oldBandScaleId,
      eventAssignments: [
        { eventAssignmentId: 'ev-u2', userId: 'u2', functionId: 'inst-violao', active: true, assignmentRevision: 2 },
        { eventAssignmentId: 'ev-u3', userId: 'u3', functionId: 'inst-vocal', active: true, assignmentRevision: 2 }
      ]
    });

    // Populate old responses
    globalThis.dbState.set(`scales/${scaleId}/responses/ev-u2`, {
      data: { userId: 'u2', active: true, status: 'pending', assignmentRevision: 2 },
      version: 1
    });
    globalThis.dbState.set(`scales/${scaleId}/responses/ev-u3`, {
      data: { userId: 'u3', active: true, status: 'accepted', assignmentRevision: 2 },
      version: 1
    });

    // Setup new band scale: u2 is kept (Violão), u3 is removed, and u1 (publisher) is added (Violão)
    setupBandScale(orgId, newBandScaleId, [
      { assignmentId: 'assign-u2', userId: 'u2', instrumentId: 'inst-violao', active: true },
      { assignmentId: 'assign-u1', userId: 'u1', instrumentId: 'inst-violao', active: true }
    ]);

    const result = await MusicScaleCommandService.publishMusicScale({
      musicScaleId: scaleId,
      orgId,
      payload: { bandScaleId: newBandScaleId, scalePatch: validScalePatch },
      idempotencyKey: 'idemp-s2',
      authUid: 'u1',
      correlationId: 'corr-s2'
    });

    expect(result.version).toBe(3);

    // Assert pre-existing responses are now inactive
    const oldRespU2 = globalThis.dbState.get(`scales/${scaleId}/responses/ev-u2`)?.data;
    const oldRespU3 = globalThis.dbState.get(`scales/${scaleId}/responses/ev-u3`)?.data;
    expect(oldRespU2?.active).toBe(false);
    expect(oldRespU3?.active).toBe(false);

    // Assert only currently active assignments have active responses
    let activeResponsesCount = 0;
    globalThis.dbState.forEach((val, key) => {
      if (key.startsWith(`scales/${scaleId}/responses/`) && val.data.active === true) {
        activeResponsesCount++;
        expect(val.data.userId).toBeOneOf(['u2', 'u1']);
      }
    });
    expect(activeResponsesCount).toBe(2); // u2 and u1

    // Reconciled notifications assertions:
    // - u2 was maintained, and their functions/scale didn't change (no change): receives music_scale_published
    // - u3 was removed: receives music_scale_cancelled
    // - u1 was added but is the publisher: receives NO notification
    let u2Notif: Record<string, unknown> | null = null;
    let u3Notif: Record<string, unknown> | null = null;
    let u1Notif: Record<string, unknown> | null = null;

    globalThis.dbState.forEach((val, key) => {
      if (key.startsWith(`organizations/${orgId}/notifications/`)) {
        const notif = val.data;
        if (notif.recipientId === 'u2') u2Notif = notif;
        if (notif.recipientId === 'u3') u3Notif = notif;
        if (notif.recipientId === 'u1') u1Notif = notif;
      }
    });

    expect(u2Notif).toBeDefined();
    expect(u2Notif.type).toBe('music_scale_published');

    expect(u3Notif).toBeDefined();
    expect(u3Notif.type).toBe('music_scale_cancelled');

    expect(u1Notif).toBeNull(); // modifier u1 got absolutely zero notification!

    // No duplicated notifications for user and revision
    let countU2Notifs = 0;
    globalThis.dbState.forEach((val, key) => {
      if (key.startsWith(`organizations/${orgId}/notifications/`) && val.data.recipientId === 'u2') {
        countU2Notifs++;
      }
    });
    expect(countU2Notifs).toBe(1);
  });

  it('Scenario 3: Líder/Modificador Excluído da Notificação', async () => {
    const orgId = 'org-gamma';
    const scaleId = 'scale-gamma';
    const bandScaleId = 'band-gamma';

    setupBasicEntities(orgId);
    setupBasicScale(orgId, scaleId);
    
    // Both u1 (publisher) and u2 are assigned
    setupBandScale(orgId, bandScaleId, [
      { assignmentId: 'assign-u1', userId: 'u1', instrumentId: 'inst-violao', active: true },
      { assignmentId: 'assign-u2', userId: 'u2', instrumentId: 'inst-vocal', active: true }
    ]);

    await MusicScaleCommandService.publishMusicScale({
      musicScaleId: scaleId,
      orgId,
      payload: { bandScaleId, scalePatch: validScalePatch },
      idempotencyKey: 'idemp-s3',
      authUid: 'u1',
      correlationId: 'corr-s3'
    });

    // Check notifications: u2 receives notification, but publisher u1 does NOT
    let u1NotifCount = 0;
    let u2NotifCount = 0;

    globalThis.dbState.forEach((val, key) => {
      if (key.startsWith(`organizations/${orgId}/notifications/`)) {
        if (val.data.recipientId === 'u1') u1NotifCount++;
        if (val.data.recipientId === 'u2') u2NotifCount++;
      }
    });

    expect(u1NotifCount).toBe(0);
    expect(u2NotifCount).toBe(1);
  });

  it('Scenario 4: Broadcast se nenhuma escala de banda estiver vinculada', async () => {
    const orgId = 'org-delta';
    const scaleId = 'scale-delta';

    setupBasicEntities(orgId);
    setupBasicScale(orgId, scaleId);

    // Publish without linked band scale
    await MusicScaleCommandService.publishMusicScale({
      musicScaleId: scaleId,
      orgId,
      payload: { scalePatch: validScalePatch },
      idempotencyKey: 'idemp-s4',
      authUid: 'u1',
      correlationId: 'corr-s4'
    });

    // Should broadcast music_scale_published to other active organization members: u2 and u3
    let broadcastCount = 0;
    globalThis.dbState.forEach((val, key) => {
      if (key.startsWith(`organizations/${orgId}/notifications/`)) {
        broadcastCount++;
        expect(val.data.type).toBe('music_scale_published');
        expect(val.data.recipientId).toBeOneOf(['u2', 'u3']);
      }
    });

    expect(broadcastCount).toBe(2);
  });

  it('Scenario 5: Multi-tenant Isolation', async () => {
    const org1 = 'org-tenant1';
    const org2 = 'org-tenant2';
    const scaleId = 'scale-tenant1';

    setupBasicEntities(org1);
    setupBasicScale(org1, scaleId);

    // Attempting to publish org1's scale using org2 context must fail immediately
    await expect(
      MusicScaleCommandService.publishMusicScale({
        musicScaleId: scaleId,
        orgId: org2,
        payload: { scalePatch: validScalePatch },
        idempotencyKey: 'idemp-s5',
        authUid: 'u1',
        correlationId: 'corr-s5'
      })
    ).rejects.toThrowError(/Acesso negado/);

    // Verify absolutely nothing changed in org1's scale status
    const scale = globalThis.dbState.get(`scales/${scaleId}`)?.data;
    expect(scale?.status).toBe('draft');
  });
});
