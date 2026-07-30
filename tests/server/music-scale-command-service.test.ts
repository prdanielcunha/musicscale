import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicScaleCommandService, ValidationError, PublishCommandError } from '../../services/server/scale/musicScaleCommandService.js';

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

interface TestPayloadPatch {
  date?: string;
  time?: string;
  eventTypeId?: string;
  locationId?: string;
  bandScaleId?: string | null;
  songIds?: string[];
  [key: string]: unknown;
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
  var mockDb: TestFirestore;
  var setConflictPath: (path: string | null) => void;
  var getConflictPath: () => string | null;
  var resetMocks: () => void;
  var TestTransactionEmulatorClass: new (state: Map<string, DocumentState>) => TestTransaction;
}

// -----------------------------------------------------------------------------
// Hoisted Unified Mock Factory
// -----------------------------------------------------------------------------
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
          docs.push({ 
            exists: true, 
            id: key.split('/').pop() || '', 
            data: () => val.data, 
            ref: { id: key.split('/').pop() || '', path: key } 
          });
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
  globalThis.mockDb = mockDb;
  globalThis.setConflictPath = (path: string | null) => { conflictPathToInjectOnce = path; };
  globalThis.getConflictPath = () => conflictPathToInjectOnce;
  globalThis.resetMocks = () => {
    autoIdCounter = 0;
    conflictPathToInjectOnce = null;
  };
  globalThis.TestTransactionEmulatorClass = TestTransactionEmulator;

  return {
    default: mockAdmin,
    ...mockAdmin
  };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: () => globalThis.mockDb,
  FieldValue: {
    serverTimestamp: () => 'server-timestamp'
  }
}));

// Expose type-safe bindings for the test cases
const dbState = globalThis.dbState;
export const txStats = globalThis.txStats;
const mockDb = globalThis.mockDb;
const TestTransactionEmulator = globalThis.TestTransactionEmulatorClass;

export function injectConflictBeforeCommitOnce(path: string): void {
  globalThis.setConflictPath(path);
}

describe('MusicScaleCommandService (Backend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.clear(); 
    Object.assign(txStats, { callbackExecutions: 0, commitAttempts: 0, successfulCommits: 0, conflicts: 0 });
    ((globalThis as Record<string, unknown>).resetMocks as () => void)();
  });

  const validScalePatch: TestPayloadPatch = {
    date: '2026-12-01',
    time: '19:00',
    eventTypeId: 'type-1',
    locationId: 'loc-1'
  };

  const getPayload = (patch: TestPayloadPatch = validScalePatch) => ({
    scalePatch: patch
  });

  const setupBasicScale = (orgId = 'org-1', scaleId = 'scale-1') => {
    dbState.set(`scales/${scaleId}`, {
      data: {
        organizationId: orgId,
        date: '2026-12-01',
        time: '19:00',
        eventTypeId: 'type-1',
        locationId: 'loc-1',
        songIds: ['song-1'],
        publishRevision: 1,
        version: 1,
        status: 'draft'
      },
      version: 1
    });
  };

  it('1. fails with READ_AFTER_WRITE if a read is attempted after write', async () => {
    setupBasicScale();
    const t = new TestTransactionEmulator(dbState);
    t.update({ path: 'scales/scale-1', id: 'scale-1' }, { status: 'published' });
    await expect(t.get({ path: 'scales/scale-1', id: 'scale-1' })).rejects.toThrow("READ_AFTER_WRITE");
  });

  it('2. Publicação normal', async () => {
    setupBasicScale();
    const result = await MusicScaleCommandService.publishMusicScale({ 
      musicScaleId: 'scale-1', 
      orgId: 'org-1', 
      payload: getPayload(), 
      idempotencyKey: 'req-1', 
      authUid: 'u1', 
      correlationId: 'test' 
    });
    expect(txStats.successfulCommits).toBe(1);
    expect(result.fromCache).toBe(false);
    
    const scale = dbState.get('scales/scale-1')?.data;
    expect(scale?.status).toBe('published');
    expect(scale?.publishRevision).toBe(2);
  });

  it('3. Três cliques simultâneos', async () => {
    setupBasicScale();
    
    // Configurar cardinalidade completa
    dbState.set('bandScales/band-1', {
      data: {
        organizationId: 'org-1',
        id: 'band-1',
        assignments: [
          { assignmentId: 'assign-1', userId: 'user-escalado', instrumentId: 'instrument-1', active: true }
        ]
      },
      version: 1
    });

    dbState.set('instruments/instrument-1', {
      data: { organizationId: 'org-1', name: 'Guitar', category: 'musical_instrument' },
      version: 1
    });
    dbState.set('organizations/org-1/members/user-escalado', {
      data: { status: 'active', name: 'User Escalado', userId: 'user-escalado' },
      version: 1
    });
    dbState.set('organizations/org-1/members/u1', {
      data: { status: 'active', name: 'Publisher', userId: 'u1' },
      version: 1
    });
    dbState.set('organizations/org-1', {
      data: { ownerUid: 'u1' },
      version: 1
    });

    const payload = getPayload({ ...validScalePatch, bandScaleId: 'band-1' });

    // Barreiras determinísticas de concorrência
    let reachedCommitCount = 0;
    let barrierResolve: (() => void) | null = null;
    const barrierPromise = new Promise<void>((resolve) => {
      barrierResolve = resolve;
    });

    const originalRunTransaction = mockDb.runTransaction;
    
    mockDb.runTransaction = async <T>(callback: (transaction: TestTransaction) => Promise<T>): Promise<T> => {
      let attempts = 0;
      while (attempts < 5) {
        attempts++;
        txStats.callbackExecutions++;
        const t = new TestTransactionEmulator(dbState);
        
        const result = await callback(t);
        
        if (attempts === 1) {
          reachedCommitCount++;
          if (reachedCommitCount < 3) {
            await barrierPromise;
          } else {
            if (barrierResolve) {
              barrierResolve();
            }
          }
        }
        
        txStats.commitAttempts++;
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
    };

    try {
      const promises = [
        MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload, idempotencyKey: 'req-3', authUid: 'u1', correlationId: 'test-correlation-cliques' }),
        MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload, idempotencyKey: 'req-3', authUid: 'u1', correlationId: 'test-correlation-cliques' }),
        MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload, idempotencyKey: 'req-3', authUid: 'u1', correlationId: 'test-correlation-cliques' })
      ];
      
      const results = await Promise.all(promises);
      
      const fromCacheTrue = results.filter(r => r.fromCache === true).length;
      const fromCacheFalse = results.filter(r => r.fromCache === false).length;
      
      expect(fromCacheFalse).toBe(1);
      expect(fromCacheTrue).toBe(2);
      
      const scaleState = dbState.get('scales/scale-1');
      expect(scaleState?.data.publishRevision).toBe(2); // único incremento da revisão
      expect(scaleState?.version).toBe(2); // única gravação de alteração de escala de música

      // Comprovação de cardinalidade exata (sem duplicações)
      let responseCount = 0;
      let notifCount = 0;
      let receiptCount = 0;
      dbState.forEach((val, key) => {
        if (key.includes('/responses/')) responseCount++;
        if (key.includes('/notifications/')) notifCount++;
        if (key.includes('/_commandReceipts/')) receiptCount++;
      });

      expect(responseCount).toBe(1); // 1 response
      expect(notifCount).toBe(1); // 1 notificação
      expect(receiptCount).toBe(1); // 1 receipt

      const scale = scaleState?.data;
      const eventAssignments = scale?.eventAssignments;
      expect(Array.isArray(eventAssignments) ? eventAssignments.length : 0).toBe(1); // 1 eventAssignment

      const bandState = dbState.get('bandScales/band-1')?.data;
      expect(bandState?.musicScaleId).toBe('scale-1'); // 1 vínculo da banda

      expect(txStats.conflicts).toBe(2); // 2 conflitos otimistas
      expect(txStats.callbackExecutions).toBe(5); // 3 iniciais + 2 retries
    } finally {
      mockDb.runTransaction = originalRunTransaction;
    }
  });

  it('4. Conflito otimista real && 5. Retry após conflito', async () => {
    setupBasicScale();
    const payload = getPayload();
    
    injectConflictBeforeCommitOnce('scales/scale-1');
    
    await MusicScaleCommandService.publishMusicScale({ 
      musicScaleId: 'scale-1', 
      orgId: 'org-1', 
      payload, 
      idempotencyKey: 'req-5', 
      authUid: 'u1', 
      correlationId: 'test' 
    });
    
    expect(txStats.conflicts).toBe(1);
    expect(txStats.callbackExecutions).toBe(2);
    expect(txStats.successfulCommits).toBe(1);

    const scale = dbState.get('scales/scale-1')?.data;
    expect(scale?.status).toBe('published');
    expect(scale?.publishRevision).toBe(2);

    let receiptCount = 0;
    let responseCount = 0;
    let notifCount = 0;
    dbState.forEach((val, key) => {
      if (key.includes('/_commandReceipts/')) receiptCount++;
      if (key.includes('/responses/')) responseCount++;
      if (key.includes('/notifications/')) notifCount++;
    });
    expect(receiptCount).toBe(1);
    expect(responseCount).toBe(0); // sem banda, logo sem responses individuais (apenas notificações de broadcast)
    expect(notifCount).toBe(0); // u1 é o publicador, então não há notificação para si próprio
  });

  it('6. Transação abortada sem writes', async () => {
    setupBasicScale();
    dbState.set('scales/scale-1', {
       data: { 
         status: 'draft', 
         version: 1, 
         organizationId: 'org-1',
         date: '2026-12-01',
         time: '19:00',
         eventTypeId: 'type-1',
         locationId: 'loc-1',
         songIds: [],
         publishRevision: 1
       }, 
       version: 1
    });

    dbState.set('bandScales/band-1', {
      data: { organizationId: 'org-1', id: 'band-1', musicScaleId: null, assignments: [] },
      version: 1
    });

    const originalScaleJson = JSON.stringify(dbState.get('scales/scale-1'));
    const originalBandJson = JSON.stringify(dbState.get('bandScales/band-1'));
    
    await expect(
      MusicScaleCommandService.publishMusicScale({ 
        musicScaleId: 'scale-1', 
        orgId: 'org-1', 
        payload: getPayload({}), 
        idempotencyKey: 'req-6', 
        authUid: 'u1', 
        correlationId: 'test-correlation' 
      })
    ).rejects.toThrow("Estado final inválido: songIds não pode estar vazio.");
       
    expect(txStats.successfulCommits).toBe(0); // Zero commits com writes
    
    let receiptCount = 0;
    let responseCount = 0;
    let notifCount = 0;
    dbState.forEach((val, key) => {
      if (key.includes('/_commandReceipts/')) receiptCount++;
      if (key.includes('/responses/')) responseCount++;
      if (key.includes('/notifications/')) notifCount++;
    });
    expect(receiptCount).toBe(0); // zero receipts
    expect(responseCount).toBe(0); // zero responses
    expect(notifCount).toBe(0); // zero notificações

    // Estado original e banda original perfeitamente idênticos
    expect(JSON.stringify(dbState.get('scales/scale-1'))).toBe(originalScaleJson);
    expect(JSON.stringify(dbState.get('bandScales/band-1'))).toBe(originalBandJson);
  });

  it('7. Um único receipt', async () => {
     setupBasicScale();
     await MusicScaleCommandService.publishMusicScale({ 
       musicScaleId: 'scale-1', 
       orgId: 'org-1', 
       payload: getPayload(), 
       idempotencyKey: 'req-7', 
       authUid: 'u1', 
       correlationId: 'test' 
     });
     
     let receipts = 0;
     dbState.forEach((v, k) => {
        if (k.includes('_commandReceipts')) receipts++;
     });
     expect(receipts).toBe(1);
  });

  it('8. Conflito por payload diferente', async () => {
     setupBasicScale();
     
     await MusicScaleCommandService.publishMusicScale({ 
       musicScaleId: 'scale-1', 
       orgId: 'org-1', 
       payload: getPayload({ ...validScalePatch, date: '2026-12-01' }), 
       idempotencyKey: 'req-8', 
       authUid: 'u1', 
       correlationId: 'test' 
     });

     const commitsBeforeConflict = txStats.successfulCommits;
     
     await expect(
       MusicScaleCommandService.publishMusicScale({ 
         musicScaleId: 'scale-1', 
         orgId: 'org-1', 
         payload: getPayload({ ...validScalePatch, date: '2026-12-02' }), 
         idempotencyKey: 'req-8', 
         authUid: 'u1', 
         correlationId: 'test' 
       })
     ).rejects.toThrowError(
       expect.objectContaining({
         code: 'IDEMPOTENCY_CONFLICT'
       })
     );

     expect(txStats.successfulCommits).toBe(commitsBeforeConflict); // Zero writes adicionais
     
     let receipts = 0;
     dbState.forEach((v, k) => {
        if (k.includes('_commandReceipts')) receipts++;
     });
     expect(receipts).toBe(1); // Receipt original preservado
  });

  it('9. Conflito por entidade diferente', async () => {
     setupBasicScale();
     setupBasicScale('org-1', 'scale-2');
     
     await MusicScaleCommandService.publishMusicScale({ 
       musicScaleId: 'scale-1', 
       orgId: 'org-1', 
       payload: getPayload(), 
       idempotencyKey: 'req-9', 
       authUid: 'u1', 
       correlationId: 'test' 
     });

     const commitsBeforeConflict = txStats.successfulCommits;
     
     await expect(
       MusicScaleCommandService.publishMusicScale({ 
         musicScaleId: 'scale-2', 
         orgId: 'org-1', 
         payload: getPayload(), 
         idempotencyKey: 'req-9', 
         authUid: 'u1', 
         correlationId: 'test-correlation' 
       })
     ).rejects.toThrowError(
       expect.objectContaining({
         code: 'IDEMPOTENCY_CONFLICT'
       })
     );

     expect(txStats.successfulCommits).toBe(commitsBeforeConflict); // Zero writes adicionais
  });

  it('10. durationMinutes inválido', async () => {
     setupBasicScale();
     const testCases = [0, -1, 30.5, NaN, Infinity];
     
     for (const val of testCases) {
        await expect(
          MusicScaleCommandService.publishMusicScale({ 
            musicScaleId: 'scale-1', 
            orgId: 'org-1', 
            payload: getPayload({ ...validScalePatch, durationMinutes: val }), 
            idempotencyKey: `req-10-${val}`, 
            authUid: 'u1', 
            correlationId: 'test' 
          })
        ).rejects.toThrow();
     }
  });

  it('11. String "30" rejeitada', async () => {
     setupBasicScale();
     await expect(
       MusicScaleCommandService.publishMusicScale({ 
         musicScaleId: 'scale-1', 
         orgId: 'org-1', 
         payload: getPayload({ ...validScalePatch, durationMinutes: "30" }), 
         idempotencyKey: 'req-11', 
         authUid: 'u1', 
         correlationId: 'test' 
       })
     ).rejects.toThrow();
  });

  it('12. Data impossível', async () => {
     setupBasicScale();
     await expect(
       MusicScaleCommandService.publishMusicScale({ 
         musicScaleId: 'scale-1', 
         orgId: 'org-1', 
         payload: getPayload({ ...validScalePatch, date: "2026-02-30" }), 
         idempotencyKey: 'req-12', 
         authUid: 'u1', 
         correlationId: 'test' 
       })
     ).rejects.toThrow();
  });

  it('13. Horário impossível', async () => {
     setupBasicScale();
     await expect(
       MusicScaleCommandService.publishMusicScale({ 
         musicScaleId: 'scale-1', 
         orgId: 'org-1', 
         payload: getPayload({ ...validScalePatch, time: "25:00" }), 
         idempotencyKey: 'req-13', 
         authUid: 'u1', 
         correlationId: 'test' 
       })
     ).rejects.toThrow();
  });

  it('14. Banda omitida', async () => {
    setupBasicScale();
    const scaleData = dbState.get('scales/scale-1')?.data;
    dbState.set('scales/scale-1', {
      data: { ...scaleData!, bandScaleId: 'band-1' },
      version: 1
    });
    dbState.set('bandScales/band-1', {
      data: { organizationId: 'org-1', id: 'band-1', musicScaleId: 'scale-1', assignments: [] },
      version: 1
    });

    await MusicScaleCommandService.publishMusicScale({
      musicScaleId: 'scale-1',
      orgId: 'org-1',
      payload: getPayload(), // sem alterar bandScaleId (mantendo o existente)
      idempotencyKey: 'req-14',
      authUid: 'u1',
      correlationId: 'test'
    });

    const scale = dbState.get('scales/scale-1')?.data;
    const band = dbState.get('bandScales/band-1')?.data;
    expect(scale?.bandScaleId).toBe('band-1');
    expect(band?.musicScaleId).toBe('scale-1');
  });

  it('15. Banda removida com null', async () => {
    setupBasicScale();
    const scaleData = dbState.get('scales/scale-1')?.data;
    dbState.set('scales/scale-1', {
      data: { ...scaleData!, bandScaleId: 'band-1' },
      version: 1
    });
    dbState.set('bandScales/band-1', {
      data: { organizationId: 'org-1', id: 'band-1', musicScaleId: 'scale-1', assignments: [] },
      version: 1
    });

    await MusicScaleCommandService.publishMusicScale({
      musicScaleId: 'scale-1',
      orgId: 'org-1',
      payload: getPayload({ ...validScalePatch, bandScaleId: null }),
      idempotencyKey: 'req-15',
      authUid: 'u1',
      correlationId: 'test'
    });

    const scale = dbState.get('scales/scale-1')?.data;
    const band = dbState.get('bandScales/band-1')?.data;
    expect(scale?.bandScaleId).toBeNull();
    expect(band?.musicScaleId).toBeNull();
  });

  it('16. Troca de banda', async () => {
    setupBasicScale();
    const scaleData = dbState.get('scales/scale-1')?.data;
    dbState.set('scales/scale-1', {
      data: { ...scaleData!, bandScaleId: 'band-1' },
      version: 1
    });
    dbState.set('bandScales/band-1', {
      data: { organizationId: 'org-1', id: 'band-1', musicScaleId: 'scale-1', assignments: [] },
      version: 1
    });
    dbState.set('bandScales/band-2', {
      data: { organizationId: 'org-1', id: 'band-2', assignments: [] },
      version: 1
    });

    await MusicScaleCommandService.publishMusicScale({
      musicScaleId: 'scale-1',
      orgId: 'org-1',
      payload: getPayload({ ...validScalePatch, bandScaleId: 'band-2' }),
      idempotencyKey: 'req-16',
      authUid: 'u1',
      correlationId: 'test'
    });

    const scale = dbState.get('scales/scale-1')?.data;
    const band1 = dbState.get('bandScales/band-1')?.data;
    const band2 = dbState.get('bandScales/band-2')?.data;

    expect(scale?.bandScaleId).toBe('band-2');
    expect(band1?.musicScaleId).toBeNull();
    expect(band2?.musicScaleId).toBe('scale-1');
  });

  it('17. Assignment revision', async () => {
    setupBasicScale();

    dbState.set('bandScales/band-1', {
      data: {
        organizationId: 'org-1',
        id: 'band-1',
        assignments: [
          { assignmentId: 'assign-1', userId: 'user-escalado', instrumentId: 'instrument-1', active: true }
        ]
      },
      version: 1
    });

    dbState.set('instruments/instrument-1', {
      data: { organizationId: 'org-1', name: 'Guitar', category: 'musical_instrument' },
      version: 1
    });
    dbState.set('organizations/org-1/members/user-escalado', {
      data: { status: 'active', name: 'User Escalado', userId: 'user-escalado' },
      version: 1
    });
    dbState.set('organizations/org-1/members/u1', {
      data: { status: 'active', name: 'Publisher', userId: 'u1' },
      version: 1
    });
    dbState.set('organizations/org-1', {
      data: { ownerUid: 'u1' },
      version: 1
    });

    await MusicScaleCommandService.publishMusicScale({
      musicScaleId: 'scale-1',
      orgId: 'org-1',
      payload: getPayload({ ...validScalePatch, bandScaleId: 'band-1' }),
      idempotencyKey: 'req-17',
      authUid: 'u1',
      correlationId: 'test-assign-revision'
    });

    const scale = dbState.get('scales/scale-1')?.data;
    expect(scale?.publishRevision).toBe(2);

    const eventAssignments = scale?.eventAssignments;
    expect(Array.isArray(eventAssignments) ? eventAssignments.length : 0).toBe(1);
    const eventAssignment = Array.isArray(eventAssignments) ? (eventAssignments[0] as Record<string, unknown>) : null;

    let responses: Record<string, unknown>[] = [];
    dbState.forEach((val, key) => {
      if (key.startsWith('scales/scale-1/responses/')) {
        responses.push(val.data);
      }
    });
    expect(responses.length).toBe(1);
    const scaleResponse = responses[0];

    expect(eventAssignment?.assignmentRevision).toBe(2);
    expect(scaleResponse.assignmentRevision).toBe(2);
    expect(scaleResponse.respondedAgainstRevision).toBeNull();
    expect(scaleResponse.status).toBe('pending');

    let notifications: Record<string, unknown>[] = [];
    dbState.forEach((val, key) => {
      if (key.startsWith('organizations/org-1/notifications/')) {
        notifications.push(val.data);
      }
    });
    expect(notifications.length).toBe(1);
  });

  it('18. Tenant Scope Mismatch', async () => {
    setupBasicScale('org-1', 'scale-1');
    
    const originalState = JSON.stringify(dbState.get('scales/scale-1'));
    const originalDbSize = dbState.size;

    await expect(
      MusicScaleCommandService.publishMusicScale({
        musicScaleId: 'scale-1',
        orgId: 'org-2',
        payload: getPayload(),
        idempotencyKey: 'req-18',
        authUid: 'u1',
        correlationId: 'test-correlation'
      })
    ).rejects.toThrowError(
      expect.objectContaining({
        code: 'TENANT_SCOPE_MISMATCH'
      })
    );

    expect(JSON.stringify(dbState.get('scales/scale-1'))).toBe(originalState);
    expect(dbState.size).toBe(originalDbSize);

    let receiptCount = 0;
    dbState.forEach((val, key) => {
      if (key.includes('_commandReceipts')) receiptCount++;
    });
    expect(receiptCount).toBe(0);
  });

  it('19. Estado final inválido herdado', async () => {
    setupBasicScale();
    const originalScale = dbState.get('scales/scale-1')?.data;
    dbState.set('scales/scale-1', {
      data: { ...originalScale!, durationMinutes: -10 },
      version: 1
    });

    const originalStateJson = JSON.stringify(dbState.get('scales/scale-1'));
    const originalDbSize = dbState.size;

    await expect(
      MusicScaleCommandService.publishMusicScale({
        musicScaleId: 'scale-1',
        orgId: 'org-1',
        payload: getPayload({}),
        idempotencyKey: 'req-19',
        authUid: 'u1',
        correlationId: 'test-invalid-inherited'
      })
    ).rejects.toThrow("Estado final inválido: durationMinutes inválido.");

    expect(txStats.successfulCommits).toBe(0);

    let receiptCount = 0;
    dbState.forEach((val, key) => {
      if (key.includes('_commandReceipts')) receiptCount++;
    });
    expect(receiptCount).toBe(0);

    expect(JSON.stringify(dbState.get('scales/scale-1'))).toBe(originalStateJson);
    expect(dbState.size).toBe(originalDbSize);
  });

});
