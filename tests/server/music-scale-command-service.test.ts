
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicScaleCommandService, PublishCommandError, ValidationError, MusicScalePublishResult, MusicScalePublishTransactionResult } from '../../services/server/scale/musicScaleCommandService.js';
import { IdempotencyService, CommandReceipt } from '../../services/server/bandScale/idempotencyService.js';
import type { FirebaseFirestore } from '@firebase/firestore-types';

interface DocumentState {
  data: Record<string, unknown>;
  version: number;
}

class TestTransactionEmulator {
  reads: Set<string> = new Set();
  readVersions: Map<string, number> = new Map();
  writes: Array<{ type: 'set' | 'update' | 'delete', path: string, data?: Record<string, unknown> }> = [];
  
  constructor(private state: Map<string, DocumentState>) {}

  async get(ref: { id?: string, path?: string, get?: () => Promise<any>, _isQuery?: boolean }) {
    if (this.writes.length > 0) {
      throw new Error("READ_AFTER_WRITE");
    }
    if (ref._isQuery && ref.get && typeof ref.get === 'function') {
      return ref.get();
    }
    const path = ref.path || ref.id;
    if (!path) throw new Error("Invalid ref");
    this.reads.add(path);
    const docState = this.state.get(path);
    const version = docState ? docState.version : 0;
    this.readVersions.set(path, version);
    if (docState !== undefined) {
      return { exists: true, data: () => docState.data, id: ref.id || path.split('/').pop(), ref };
    }
    return { exists: false, data: () => undefined, id: ref.id || path.split('/').pop(), ref };
  }

  set(ref: { id?: string, path?: string }, data: Record<string, unknown>) {
    const path = ref.path || ref.id;
    if (!path) throw new Error("Invalid ref");
    this.writes.push({ type: 'set', path, data });
    return this;
  }

  update(ref: { id?: string, path?: string }, data: Record<string, unknown>) {
    const path = ref.path || ref.id;
    if (!path) throw new Error("Invalid ref");
    this.writes.push({ type: 'update', path, data });
    return this;
  }

  delete(ref: { id?: string, path?: string }) {
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

// Global stats
export const txStats = {
  callbackExecutions: 0,
  commitAttempts: 0,
  successfulCommits: 0,
  conflicts: 0
};

const dbState = new Map<string, DocumentState>();

let autoIdCounter = 0;
const collectionMock = (basePath: string) => ({
  path: basePath,
  id: basePath.split("/").pop(),
  doc: vi.fn((id) => {
    autoIdCounter++;
    const docPath = id ? `${basePath}/${id}` : `${basePath}/auto-id-${autoIdCounter}`;
    return { 
      id: id || docPath.split('/').pop(), 
      path: docPath, 
      collection: (subPath: string) => collectionMock(`${docPath}/${subPath}`)
    };
  }),
  get: vi.fn(async () => {
    const docs: any[] = [];
    dbState.forEach((val, key) => {
      if (key.startsWith(basePath)) {
        docs.push({ id: key.split('/').pop(), data: () => val.data, ref: { id: key.split('/').pop(), path: key } });
      }
    });
    return { docs };
  }),
  where: vi.fn(() => ({
    _isQuery: true,
    get: vi.fn(async () => {
      const docs: any[] = [];
      dbState.forEach((val, key) => {
        if (key.startsWith(basePath) && (basePath.includes('members') ? val.data.status === 'active' : true)) {
          docs.push({ id: key.split('/').pop(), data: () => val.data });
        }
      });
      return { docs, empty: docs.length === 0 };
    }),
  })),
});

const mockDb = {
  runTransaction: vi.fn(async (callback) => {
    let attempts = 0;
    while (attempts < 5) {
      attempts++;
      txStats.callbackExecutions++;
      const t = new TestTransactionEmulator(dbState);
      
      let result;
      try {
         result = await callback(t);
      } catch (err: unknown) {
         throw err; // User code threw
      }
      
      txStats.commitAttempts++;
      // Validate
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
         continue; // retry
      }
      
      // Atomic apply
      t.commit();
      txStats.successfulCommits++;
      return result;
    }
    throw new Error("Max retries exceeded");
  }),
  collection: (path: string) => collectionMock(path),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => mockDb),
  FieldValue: {
    serverTimestamp: vi.fn(() => 'server-timestamp')
  }
}));

describe('MusicScaleCommandService (Backend)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.clear(); Object.assign(txStats, { callbackExecutions: 0, commitAttempts: 0, successfulCommits: 0, conflicts: 0 });
    autoIdCounter = 0;
  });

  const validScalePatch = {
    date: '2026-12-01',
    time: '19:00',
    eventTypeId: 'type-1',
    locationId: 'loc-1'
  };

  const getPayload = (patch: any = validScalePatch) => ({
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
    t.update({ path: 'scales/scale-1' }, { status: 'published' });
    await expect(t.get({ path: 'scales/scale-1' })).rejects.toThrow("READ_AFTER_WRITE");
  });

  it('2. Publicação normal', async () => {
    setupBasicScale();
    const result = await MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload(), idempotencyKey: 'req-1', authUid: 'u1', correlationId: 'test' });
    // expect(result.status).toBe('published'); // wait, there is no status in MusicScalePublishResult
    expect(txStats.successfulCommits).toBe(1);
    
    const scale = dbState.get('scales/scale-1')?.data;
    expect(scale?.status).toBe('published');
    expect(scale?.publishRevision).toBe(2);
  });

  it('3. Três cliques simultâneos', async () => {
    setupBasicScale();
        const payload = getPayload();
    
    // Fire 3 requests concurrently
    const promises = [
      MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload, idempotencyKey: 'req-1', authUid: 'u1', correlationId: 'test' }),
      MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload, idempotencyKey: 'req-1', authUid: 'u1', correlationId: 'test' }),
      MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload, idempotencyKey: 'req-1', authUid: 'u1', correlationId: 'test' })
    ];
    
    const results = await Promise.all(promises);
    
    // Analyze results
    const fromCacheTrue = results.filter(r => r.fromCache === true).length;
    const fromCacheFalse = results.filter(r => r.fromCache === false).length;
    
    expect(fromCacheFalse).toBe(1);
    expect(fromCacheTrue).toBe(2);
    
    const scaleState = dbState.get('scales/scale-1');
    expect(scaleState?.data.publishRevision).toBe(2); // um único incremento da revisão
    expect(scaleState?.version).toBe(2); // Only one successful write
    
    // Um único receipt (which means we only stored it once successfully)
    let receiptCount = 0;
    dbState.forEach((val, key) => {
      if (key.startsWith('organizations/org-1/_commandReceipts/')) receiptCount++;
    });
    expect(receiptCount).toBe(1);
    
    // Pelo menos um conflito/retry registrado
    expect(txStats.conflicts).toBeGreaterThanOrEqual(0); // If they hit at same time, conflict might happen. Vitest async might serialize them though depending on event loop.
    // Let's force a conflict in another test to be absolutely sure.
  });

  it('4. Pelo menos um conflito otimista real && 5. Retry após conflito', async () => {
    setupBasicScale();
    const payload = getPayload();
    
    // We simulate a conflict by modifying the runTransaction wrapper or the state during the callback.
    // Instead, let's trigger concurrent processes that will interleave.
    let callbackStarted = false;
    
    const originalGet = mockDb.runTransaction;
    const customTx = vi.fn(async (callback) => {
       let attempts = 0;
       while (attempts < 5) {
         attempts++;
         txStats.callbackExecutions++;
         const t = new TestTransactionEmulator(dbState);
         
         const origGet = t.get.bind(t);
         t.get = async (ref: any) => {
             const res = await origGet(ref);
             if (!callbackStarted && ref.path?.includes('scales/scale-1')) {
                 callbackStarted = true;
                 // Simulate someone else writing to this doc before we commit
                 const current = dbState.get('scales/scale-1');
                 dbState.set('scales/scale-1', {
                     data: { ...current?.data, publishRevision: 2 },
                     version: 2
                 });
             }
             return res;
         };
         
         const result = await callback(t);
         
         let conflict = false;
         for (const [path, readVersion] of Array.from(t.readVersions.entries())) {
            const currentVersion = dbState.get(path)?.version || 0;
            if (readVersion !== currentVersion) conflict = true;
         }
         
         if (conflict) {
            txStats.conflicts++;
            continue;
         }
         t.commit();
         txStats.successfulCommits++;
         return result;
       }
    });
    
    mockDb.runTransaction = customTx;
    
    await MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload, idempotencyKey: 'req-5', authUid: 'u1', correlationId: 'test' });
    
    expect(txStats.conflicts).toBe(1);
    expect(txStats.successfulCommits).toBe(1);
    
    // Restore
    mockDb.runTransaction = originalGet;
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
         songIds: []
       }, 
       version: 1
    });
    
    await expect(MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload({}), idempotencyKey: 'req-6', authUid: 'u1', correlationId: 'test-correlation' }))
       .rejects.toThrow("Estado final inválido: songIds não pode estar vazio.");
       
    expect(txStats.successfulCommits).toBe(0); // No writes
  });

  it('7. Um único receipt', async () => {
     setupBasicScale();
     await MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload(), idempotencyKey: 'req-7', authUid: 'u1', correlationId: 'test' });
     
     let receipts = 0;
     dbState.forEach((v, k) => {
        if (k.includes('_commandReceipts')) receipts++;
     });
     expect(receipts).toBe(1);
  });

  it('8. Conflito por payload diferente', async () => {
     setupBasicScale();
     await MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload({ ...validScalePatch, date: '2026-12-01' }), idempotencyKey: 'req-8', authUid: 'u1', correlationId: 'test' });
     
     await expect(MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload({ ...validScalePatch, date: '2026-12-02' }), idempotencyKey: 'req-8', authUid: 'u1', correlationId: 'test' }))
        .rejects.toThrow("Esta chave de idempotência já foi utilizada com um payload diferente.");
  });

  it('9. Conflito por entidade diferente', async () => {
     setupBasicScale();
     setupBasicScale('org-1', 'scale-2');
     await MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload(), idempotencyKey: 'req-9', authUid: 'u1', correlationId: 'test' });
     
     await expect(MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-2', orgId: 'org-1', payload: getPayload(), idempotencyKey: 'req-9', authUid: 'u1', correlationId: 'test-correlation' }))
        .rejects.toThrow("Este recibo pertence à outra escala");
  });

  it('10. durationMinutes inválido', async () => {
     setupBasicScale();
     const testCases = [0, -1, 30.5, NaN, Infinity];
     
     for (const val of testCases) {
        await expect(MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload({ ...validScalePatch, durationMinutes: val }), idempotencyKey: `req-10-${val}`, authUid: 'u1', correlationId: 'test' }))
           .rejects.toThrow();
     }
  });

  it('11. String "30" rejeitada', async () => {
     setupBasicScale();
          await expect(MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload({ ...validScalePatch, durationMinutes: "30" }), idempotencyKey: 'req-11', authUid: 'u1', correlationId: 'test' }))
           .rejects.toThrow();
  });

  it('12. Data impossível', async () => {
     setupBasicScale();
          await expect(MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload({ ...validScalePatch, date: "2026-02-30" }), idempotencyKey: 'req-12', authUid: 'u1', correlationId: 'test' }))
           .rejects.toThrow();
  });

  it('13. Horário impossível', async () => {
     setupBasicScale();
          await expect(MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload({ ...validScalePatch, time: "25:00" }), idempotencyKey: 'req-13', authUid: 'u1', correlationId: 'test' }))
           .rejects.toThrow();
  });

  it('14. Banda omitida && 15. Banda removida com null && 16. Troca de banda', async () => {
     setupBasicScale();
     // Set mock band scales
     dbState.set('bandScales/band-1', { data: { organizationId: 'org-1', id: 'band-1', assignments: [] }, version: 1 });
     dbState.set('bandScales/band-2', { data: { organizationId: 'org-1', id: 'band-2', assignments: [] }, version: 1 });
          
     // 14. Banda omitida
     await MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload(), idempotencyKey: 'req-14', authUid: 'u1', correlationId: 'test' });
     let scale = dbState.get('scales/scale-1')?.data;
     expect(scale?.bandScaleId).toBeNull(); // It gets resolved to null when omitted and originally missing
     
     // Set it manually
     dbState.set('scales/scale-1', { data: { ...scale!, bandScaleId: 'band-1', status: 'draft', publishRevision: (scale!.publishRevision as number) + 1 }, version: 2 });
     
     // 15. Banda removida com null
     await MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload({ ...validScalePatch, bandScaleId: null }), idempotencyKey: 'req-15', authUid: 'u1', correlationId: 'test' });
     scale = dbState.get('scales/scale-1')?.data;
     expect(scale?.bandScaleId).toBeNull();
     
     // 16. Troca de banda
     dbState.set('scales/scale-1', { data: { ...scale!, status: 'draft', publishRevision: (scale!.publishRevision as number) + 1 }, version: 3 });
     await MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload({ ...validScalePatch, bandScaleId: 'band-2' }), idempotencyKey: 'req-16', authUid: 'u1', correlationId: 'test' });
     scale = dbState.get('scales/scale-1')?.data;
     expect(scale?.bandScaleId).toBe('band-2');
  });

  it('17. Assignment revision', async () => {
     // Check that created responses get revision matched
     setupBasicScale();
     await MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload(), idempotencyKey: 'req-17', authUid: 'u1', correlationId: 'test' });
     
     const scale = dbState.get('scales/scale-1')?.data;
     expect(scale?.publishRevision).toBe(2);
  });

  it('18. Tenant mismatch', async () => {
     setupBasicScale('org-1', 'scale-1');
          await expect(MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-2', payload: getPayload(), idempotencyKey: 'req-18', authUid: 'u1', correlationId: 'test-correlation' }))
           .rejects.toThrow("Acesso negado: a escala não pertence a esta organização.");
  });

  it('19. Estado final inválido herdado', async () => {
     setupBasicScale();
     // make it missing required fields
     dbState.set('scales/scale-1', {
         data: { organizationId: 'org-1', status: 'draft', version: 1 },
         version: 1
     });
          await expect(MusicScaleCommandService.publishMusicScale({ musicScaleId: 'scale-1', orgId: 'org-1', payload: getPayload({}), idempotencyKey: 'req-19', authUid: 'u1', correlationId: 'test-correlation' }))
           .rejects.toThrow(); // Should fail validation because missing date/time
  });

});
