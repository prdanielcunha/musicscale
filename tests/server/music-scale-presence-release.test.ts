import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicScaleResponseService, RespondOwnParams } from '../../services/server/scale/musicScaleResponseService.js';
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
  set(ref: TestDocumentRef, data: Record<string, unknown>, options?: { merge?: boolean }): this;
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
  var mockDbPresenceRelease: TestFirestore;
  var setConflictPath: (p: string | null) => void;
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

    set(ref: TestDocumentRef, data: Record<string, unknown>, _options?: { merge?: boolean }) {
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
    where: (field: string, _op: string, value: unknown): TestQueryRef => ({
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
  globalThis.mockDbPresenceRelease = mockDb;
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
  getFirestore: () => globalThis.mockDbPresenceRelease,
  FieldValue: {
    serverTimestamp: () => 'server-timestamp'
  }
}));

const dbState = globalThis.dbState;
const txStats = globalThis.txStats;

function setupMockScale(orgId: string, scaleId: string, assignments: Array<Record<string, unknown>>, date = '2026-12-25', time = '19:00', timeZone = 'America/Sao_Paulo') {
  dbState.set(`scales/${scaleId}`, {
    data: {
      organizationId: orgId,
      date,
      time,
      timeZone,
      status: 'published',
      eventAssignments: assignments,
    },
    version: 1
  });
}

describe('MusicScale Presence Tracking (MusicScaleResponseService)', () => {
  beforeEach(() => {
    globalThis.resetMocks();
  });

  const validParams = (status: 'accepted' | 'maybe' | 'declined', reason: string | null = null): RespondOwnParams => ({
    authUid: 'user-1',
    orgId: 'org-1',
    musicScaleId: 'scale-1',
    idempotencyKey: 'idem-1',
    payload: { status, reason },
    correlationId: 'corr-1'
  });

  it('1. Default unresponded state before interaction', async () => {
    const assignments = [
      { eventAssignmentId: 'assign-1', userId: 'user-1', active: true, functionId: 'inst-1', functionName: 'Guitar' }
    ];
    setupMockScale('org-1', 'scale-1', assignments);

    // Initial state check - there should be no responses yet or default empty response
    const response = dbState.get('scales/scale-1/responses/assign-1');
    expect(response).toBeUndefined(); // Starts unresponded
  });

  it('2. Responded Accepted successfully updates status', async () => {
    const assignments = [
      { eventAssignmentId: 'assign-1', userId: 'user-1', active: true, functionId: 'inst-1', functionName: 'Guitar', assignmentRevision: 1 }
    ];
    setupMockScale('org-1', 'scale-1', assignments);

    const result = await MusicScaleResponseService.respondOwn(validParams('accepted'));

    expect(result.success).toBe(true);
    expect(result.status).toBe('accepted');
    expect(result.fromCache).toBe(false);

    // Verify response document in database
    const dbResponse = dbState.get('scales/scale-1/responses/assign-1')?.data;
    expect(dbResponse).toBeDefined();
    expect(dbResponse?.status).toBe('accepted');
    expect(dbResponse?.respondedBy).toBe('user-1');
    expect(dbResponse?.respondedAgainstRevision).toBe(1);

    // Verify Audit History is generated
    let historyCount = 0;
    dbState.forEach((val, key) => {
      if (key.startsWith('scales/scale-1/responseHistory/')) {
        historyCount++;
        expect(val.data.newStatus).toBe('accepted');
        expect(val.data.userId).toBe('user-1');
      }
    });
    expect(historyCount).toBe(1);
  });

  it('3. Responded Maybe successfully updates status', async () => {
    const assignments = [
      { eventAssignmentId: 'assign-1', userId: 'user-1', active: true, functionId: 'inst-1', functionName: 'Guitar', assignmentRevision: 1 }
    ];
    setupMockScale('org-1', 'scale-1', assignments);

    const result = await MusicScaleResponseService.respondOwn(validParams('maybe'));

    expect(result.success).toBe(true);
    expect(result.status).toBe('maybe');

    const dbResponse = dbState.get('scales/scale-1/responses/assign-1')?.data;
    expect(dbResponse?.status).toBe('maybe');
  });

  it('4. Responded Declined with justification/reason updates status', async () => {
    const assignments = [
      { eventAssignmentId: 'assign-1', userId: 'user-1', active: true, functionId: 'inst-1', functionName: 'Guitar', assignmentRevision: 1 }
    ];
    setupMockScale('org-1', 'scale-1', assignments);

    const result = await MusicScaleResponseService.respondOwn(validParams('declined', 'Vou viajar no feriado'));

    expect(result.success).toBe(true);
    expect(result.status).toBe('declined');
    expect(result.reason).toBe('Vou viajar no feriado');

    const dbResponse = dbState.get('scales/scale-1/responses/assign-1')?.data;
    expect(dbResponse?.status).toBe('declined');
    expect(dbResponse?.reason).toBe('Vou viajar no feriado');
  });

  it('5. Temporal validation: cannot respond once the event has started', async () => {
    const assignments = [
      { eventAssignmentId: 'assign-1', userId: 'user-1', active: true, functionId: 'inst-1', functionName: 'Guitar', assignmentRevision: 1 }
    ];
    // Event is on 2026-01-01, but the current test is happening in 2026-07-30 (past event)
    setupMockScale('org-1', 'scale-1', assignments, '2026-01-01', '19:00');

    await expect(
      MusicScaleResponseService.respondOwn(validParams('accepted'))
    ).rejects.toEqual(
      expect.objectContaining({
        errorCode: 'RESPONSE_DEADLINE_PASSED'
      })
    );

    // Verify database was untouched
    expect(dbState.get('scales/scale-1/responses/assign-1')).toBeUndefined();
  });

  it('5a. Allows a response 6 minutes before the event in the church timezone', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-06T21:54:00.000Z')); // 18:54 in America/Sao_Paulo
    try {
      const assignments = [
        { eventAssignmentId: 'assign-1', userId: 'user-1', active: true, functionId: 'inst-1', functionName: 'Guitar', assignmentRevision: 1 }
      ];
      setupMockScale('org-1', 'scale-1', assignments, '2026-09-06', '19:00', 'America/Sao_Paulo');

      const result = await MusicScaleResponseService.respondOwn(validParams('accepted'));
      expect(result.success).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('5b. Blocks a response exactly 5 minutes before the event in the church timezone', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-06T21:55:00.000Z')); // 18:55 in America/Sao_Paulo
    try {
      const assignments = [
        { eventAssignmentId: 'assign-1', userId: 'user-1', active: true, functionId: 'inst-1', functionName: 'Guitar', assignmentRevision: 1 }
      ];
      setupMockScale('org-1', 'scale-1', assignments, '2026-09-06', '19:00', 'America/Sao_Paulo');

      await expect(
        MusicScaleResponseService.respondOwn(validParams('accepted'))
      ).rejects.toEqual(
        expect.objectContaining({
          errorCode: 'RESPONSE_DEADLINE_PASSED'
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('6. Idempotency handling: repeating same payload returns cached receipt result', async () => {
    const assignments = [
      { eventAssignmentId: 'assign-1', userId: 'user-1', active: true, functionId: 'inst-1', functionName: 'Guitar', assignmentRevision: 1 }
    ];
    setupMockScale('org-1', 'scale-1', assignments);

    // First request
    const result1 = await MusicScaleResponseService.respondOwn(validParams('accepted'));
    expect(result1.fromCache).toBe(false);

    const dbSizeAfterFirst = dbState.size;
    const responseVersionAfterFirst = dbState.get('scales/scale-1/responses/assign-1')?.version;

    // Second identical request
    const result2 = await MusicScaleResponseService.respondOwn(validParams('accepted'));
    expect(result2.fromCache).toBe(true);
    expect(result2.status).toBe('accepted');

    // Ensure database state size and response document version did not change (meaning no writes occurred)
    expect(dbState.size).toBe(dbSizeAfterFirst);
    expect(dbState.get('scales/scale-1/responses/assign-1')?.version).toBe(responseVersionAfterFirst);
  });

  it('7. Idempotency conflict: sending different status with same key triggers IDEMPOTENCY_CONFLICT', async () => {
    const assignments = [
      { eventAssignmentId: 'assign-1', userId: 'user-1', active: true, functionId: 'inst-1', functionName: 'Guitar', assignmentRevision: 1 }
    ];
    setupMockScale('org-1', 'scale-1', assignments);

    // First request
    await MusicScaleResponseService.respondOwn(validParams('accepted'));

    // Second request with different status but identical idempotencyKey
    await expect(
      MusicScaleResponseService.respondOwn(validParams('maybe'))
    ).rejects.toEqual(
      expect.objectContaining({
        errorCode: 'IDEMPOTENCY_CONFLICT'
      })
    );
  });

  it('8. Multi-tenant security: responding on a scale from another organization fails with PERMISSION_DENIED', async () => {
    const assignments = [
      { eventAssignmentId: 'assign-1', userId: 'user-1', active: true, functionId: 'inst-1', functionName: 'Guitar', assignmentRevision: 1 }
    ];
    // Scale is in org-2, but params are in org-1
    setupMockScale('org-2', 'scale-1', assignments);

    await expect(
      MusicScaleResponseService.respondOwn(validParams('accepted'))
    ).rejects.toEqual(
      expect.objectContaining({
        errorCode: 'PERMISSION_DENIED'
      })
    );
  });

  it('9. User not assigned validation: responding fails if user is not in the event assignments', async () => {
    const assignments = [
      { eventAssignmentId: 'assign-1', userId: 'user-other', active: true, functionId: 'inst-1', functionName: 'Guitar', assignmentRevision: 1 }
    ];
    setupMockScale('org-1', 'scale-1', assignments);

    await expect(
      MusicScaleResponseService.respondOwn(validParams('accepted'))
    ).rejects.toEqual(
      expect.objectContaining({
        errorCode: 'NOT_ASSIGNED'
      })
    );
  });

  it('10. Optimistic lock concurrency conflict retry and recovery', async () => {
    const assignments = [
      { eventAssignmentId: 'assign-1', userId: 'user-1', active: true, functionId: 'inst-1', functionName: 'Guitar', assignmentRevision: 1 }
    ];
    setupMockScale('org-1', 'scale-1', assignments);

    // Inject conflict on the scale document once during commit
    globalThis.setConflictPath('scales/scale-1');

    const result = await MusicScaleResponseService.respondOwn(validParams('accepted'));

    expect(result.success).toBe(true);
    expect(txStats.conflicts).toBe(1);
    expect(txStats.callbackExecutions).toBe(2);
    expect(txStats.successfulCommits).toBe(1);

    const dbResponse = dbState.get('scales/scale-1/responses/assign-1')?.data;
    expect(dbResponse?.status).toBe('accepted');
  });
});
