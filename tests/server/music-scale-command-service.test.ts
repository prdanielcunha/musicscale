import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicScaleCommandService, PublishCommandError, ValidationError, MusicScalePublishResult, MusicScalePublishTransactionResult } from '../../services/server/scale/musicScaleCommandService.js';
import { IdempotencyService, CommandReceipt } from '../../services/server/bandScale/idempotencyService.js';
import type { FirebaseFirestore } from '@firebase/firestore-types';

// Real transaction emulator matching all requirements
const dbState = new Map<string, Record<string, unknown>>();

class TestTransactionEmulator {
  reads: string[] = [];
  writes: Array<{ type: 'set' | 'update' | 'delete', path: string, data?: Record<string, unknown> }> = [];
  
  constructor(private state: Map<string, Record<string, unknown>>) {}

  async get(ref: { id?: string, path?: string, get?: () => Promise<unknown> } ) {
    if (this.writes.length > 0) {
      throw new Error("READ_AFTER_WRITE");
    }
    if (ref.get && typeof ref.get === 'function') {
      return ref.get();
    }
    const path = ref.path || ref.id;
    this.reads.push(path);
    const data = this.state.get(path);
    if (data !== undefined) {
      return { exists: true, data: () => data, id: ref.id || path.split('/').pop(), ref };
    }
    return { exists: false, data: () => undefined, id: ref.id || path.split('/').pop(), ref };
  }

  set(ref: { id?: string, path?: string } , data: Record<string, unknown>) {
    const path = ref.path || ref.id;
    this.writes.push({ type: 'set', path, data });
  }

  update(ref: { id?: string, path?: string } , data: Record<string, unknown>) {
    const path = ref.path || ref.id;
    this.writes.push({ type: 'update', path, data });
  }

  commit() {
    for (const write of this.writes) {
      if (write.type === 'set') {
        this.state.set(write.path, write.data);
      } else if (write.type === 'update') {
        const existing = this.state.get(write.path) || {};
        this.state.set(write.path, { ...existing, ...write.data });
      }
    }
  }
}

let transactionMutex = Promise.resolve();
let mockRetryCount = 0;


const collectionMock = (basePath) => ({
  path: basePath,
  id: basePath.split("/").pop(),
  doc: vi.fn((id) => {
    const docPath = id ? `${basePath}/${id}` : `${basePath}/auto-id-${Math.random()}`;
    return { 
      id: id || docPath.split('/').pop(), 
      path: docPath, 
      collection: (subPath) => collectionMock(`${docPath}/${subPath}`)
    };
  }),
  get: vi.fn(async () => {
    const docs = [];
    dbState.forEach((val, key) => {
      if (key.startsWith(basePath)) {
        docs.push({ id: key.split('/').pop(), data: () => val, ref: { id: key.split('/').pop(), path: key } });
      }
    });
    return { docs };
  }),
  where: vi.fn(() => ({
    get: vi.fn(async () => {
      const docs = [];
      dbState.forEach((val, key) => {
        if (key.startsWith(basePath) && (basePath.includes('members') ? val.status === 'active' : true)) {
          docs.push({ id: key.split('/').pop(), data: () => val });
        }
      });
      return { docs };
    }),
  })),
});

const mockDb = {
  runTransaction: vi.fn(async (callback) => {
    return new Promise((resolve, reject) => {
      transactionMutex = transactionMutex.then(async () => {
        let attempts = 0;
        while (attempts < 5) {
          try {
            attempts++;
            const t = new TestTransactionEmulator(dbState);
            
            if (mockRetryCount > 0) {
              mockRetryCount--;
              const res = await callback(t);
              throw new Error("TRANSIENT_ERROR");
            }

            const result = await callback(t);
            t.commit();
            resolve(result);
            return;
          } catch (e) {
            if (e.message !== "TRANSIENT_ERROR") {
              reject(e);
              return;
            }
          }
        }
        reject(new Error("Max retries exceeded"));
      });
    });
  }),
  collection: (path) => collectionMock(path),
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
    dbState.clear();
    mockRetryCount = 0;
    transactionMutex = Promise.resolve();

    vi.spyOn(IdempotencyService, 'getReceiptInTransaction').mockImplementation(
      async (transaction: FirebaseFirestore.Transaction, orgId: string, receiptId: string) => {
        const ref = mockDb.collection('organizations').doc(orgId).collection('_commandReceipts').doc(receiptId);
        const doc = await transaction.get(ref as unknown as FirebaseFirestore.DocumentReference);
        return doc.exists ? doc.data() as CommandReceipt<unknown> : null;
      }
    );
    
    vi.spyOn(IdempotencyService, 'writeReceiptInTransaction').mockImplementation(
      (transaction: FirebaseFirestore.Transaction, orgId: string, receiptId: string, receipt: Omit<CommandReceipt<unknown>, 'completedAt'>) => {
        const ref = mockDb.collection('organizations').doc(orgId).collection('_commandReceipts').doc(receiptId);
        transaction.set(ref as unknown as FirebaseFirestore.DocumentReference, receipt as Record<string, unknown>);
      }
    );
  });

  const validScalePatch = {
    date: '2026-07-28',
    time: '18:00',
    eventTypeId: 'event-type-1',
    locationId: 'loc-1',
    songIds: ['song-1']
  };

  const validScaleData = {
    ...validScalePatch,
    organizationId: 'org-1',
    status: 'draft',
    publishRevision: 0,
  };

  it('fails with READ_AFTER_WRITE if a read is attempted after write', async () => {
    // Note: We test the emulator itself here as a negative proof
    const t = new TestTransactionEmulator(dbState);
    t.set({ path: 'test/1', id: '1' }, { a: 1 });
    await expect(t.get({ path: 'test/2', id: '2' })).rejects.toThrow('READ_AFTER_WRITE');
  });

  // F. Idempotência
  // 1. Mesma chave + mesma escala + mesmo payload:
  //    * primeira chamada grava;
  //    * chamadas posteriores retornam fromCache;
  //    * nenhuma escrita adicional ocorre.
  // H. Retry e duplo clique
  // 1. Duplo clique simultâneo:
  it('handles concurrent attempts safely returning from cache for subsequent requests (duplo clique)', async () => {
    dbState.set('scales/scale-1', validScaleData);
    dbState.set('organizations/org-1/members/u1', { name: 'User 1', status: 'active', userId: 'u1' });

    const payload = { scalePatch: validScalePatch };
    
    // Fire all three concurrently
    const results = await Promise.all([
      MusicScaleCommandService.publishMusicScale({ authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'dup-click', payload, correlationId: 'req-1' }),
      MusicScaleCommandService.publishMusicScale({ authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'dup-click', payload, correlationId: 'req-2' }),
      MusicScaleCommandService.publishMusicScale({ authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'dup-click', payload, correlationId: 'req-3' })
    ]);

    const [res1, res2, res3] = results as MusicScalePublishResult[];

    expect(res1.fromCache).toBe(false);
    expect(res1.version).toBe(1);

    expect(res2.fromCache).toBe(true);
    expect(res2.version).toBe(1);

    expect(res3.fromCache).toBe(true);
    expect(res3.version).toBe(1);

    // Assert only one write sequence occurred (since the subsequent ones return early)
    // The emulator commits are reflected in dbState size.
    const receiptsCount = Array.from(dbState.keys()).filter(k => k.includes('_commandReceipts')).length;
    expect(receiptsCount).toBe(1); // Exact 1 receipt written
  });

  // H. 2. Retry após erro recuperável
  // I. 5. Nenhum receipt é gravado após transação abortada
  it('retries successfully if transient error occurs during transaction, aborting earlier writes', async () => {
    dbState.set('scales/scale-1', validScaleData);
    dbState.set('organizations/org-1/members/u1', { name: 'User 1', status: 'active' });

    const payload = { scalePatch: validScalePatch };
    mockRetryCount = 1; // It will fail the first time

    const res = await MusicScaleCommandService.publishMusicScale({ 
      authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'retry-test', payload, correlationId: 'req-1' 
    });

    expect(res.fromCache).toBe(false);
    expect(res.version).toBe(1);
    
    const receiptsCount = Array.from(dbState.keys()).filter(k => k.includes('_commandReceipts')).length;
    expect(receiptsCount).toBe(1); // The aborted one didn't persist!
  });

  // B. Payload e validação
  // 6. Rejeitar durationMinutes NaN, Infinity, decimal, zero, negativo.
  it('fails if durationMinutes is invalid', async () => {
    const invalidValues = [NaN, Infinity, 10.5, 0, -5];
    for (const val of invalidValues) {
      await expect(MusicScaleCommandService.publishMusicScale({
        authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'id1', correlationId: 'c1',
        payload: { scalePatch: { ...validScalePatch, durationMinutes: val } } as unknown
      })).rejects.toThrow(ValidationError);
    }
  });

  // B. 4, 5. Rejeitar data impossível, horário impossível
  it('rejects impossible date and time', async () => {
    await expect(MusicScaleCommandService.publishMusicScale({
      authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'id1', correlationId: 'c1',
      payload: { scalePatch: { ...validScalePatch, date: '2026-02-30' } } as unknown
    })).rejects.toThrow(ValidationError);

    await expect(MusicScaleCommandService.publishMusicScale({
      authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'id1', correlationId: 'c1',
      payload: { scalePatch: { ...validScalePatch, time: '24:00' } } as unknown
    })).rejects.toThrow(ValidationError);
  });

  // D. Bandas
  it('preserves existing bandScaleId when omitted (undefined) in patch and payload', async () => {
    dbState.set('scales/scale-1', { ...validScaleData, bandScaleId: 'band-old' });
    dbState.set('bandScales/band-old', { musicScaleId: 'scale-1', organizationId: 'org-1' });
    dbState.set('organizations/org-1/members/u1', { name: 'User 1', status: 'active' });

    const payload = { scalePatch: { ...validScalePatch } }; // omitted bandScaleId
    await MusicScaleCommandService.publishMusicScale({ 
      authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'band-test', payload, correlationId: 'req-1' 
    });

    const mutatedScale = dbState.get('scales/scale-1') as { publishRevision?: number, eventAssignments?: Record<string, unknown>[], bandScaleId?: string | null, musicScaleId?: string | null };
    expect(mutatedScale.bandScaleId).toBe('band-old'); // Preserved
  });
  
  it('null removes the band (banda anterior recebe null, escala recebe null)', async () => {
    dbState.set('scales/scale-1', { ...validScaleData, bandScaleId: 'band-old' });
    dbState.set('bandScales/band-old', { musicScaleId: 'scale-1', organizationId: 'org-1' });
    dbState.set('organizations/org-1/members/u1', { name: 'User 1', status: 'active' });

    const payload = { scalePatch: { ...validScalePatch, bandScaleId: null } }; 
    await MusicScaleCommandService.publishMusicScale({ 
      authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'band-test2', payload, correlationId: 'req-1' 
    });

    const mutatedScale = dbState.get('scales/scale-1') as { publishRevision?: number, eventAssignments?: Record<string, unknown>[], bandScaleId?: string | null, musicScaleId?: string | null };
    expect(mutatedScale.bandScaleId).toBe(null); 
    
    const oldBand = dbState.get('bandScales/band-old') as { musicScaleId?: string | null };
    expect(oldBand.musicScaleId).toBe(null);
  });

  it('string nova troca a banda', async () => {
    dbState.set('scales/scale-1', { ...validScaleData, bandScaleId: 'band-old' });
    dbState.set('bandScales/band-old', { musicScaleId: 'scale-1', organizationId: 'org-1' });
    dbState.set('bandScales/band-new', { musicScaleId: null, organizationId: 'org-1' });
    dbState.set('organizations/org-1/members/u1', { name: 'User 1', status: 'active' });

    const payload = { scalePatch: { ...validScalePatch, bandScaleId: 'band-new' } }; 
    await MusicScaleCommandService.publishMusicScale({ 
      authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'band-test3', payload, correlationId: 'req-1' 
    });

    const mutatedScale = dbState.get('scales/scale-1') as { publishRevision?: number, eventAssignments?: Record<string, unknown>[], bandScaleId?: string | null, musicScaleId?: string | null };
    expect(mutatedScale.bandScaleId).toBe('band-new'); 
    
    const oldBand = dbState.get('bandScales/band-old') as { musicScaleId?: string | null };
    expect(oldBand.musicScaleId).toBe(null);
    
    const newBand = dbState.get('bandScales/band-new') as { musicScaleId?: string | null };
    expect(newBand.musicScaleId).toBe('scale-1');
  });

  // E. Assignment revision
  it('creates responses and eventAssignments with matching revision', async () => {
    dbState.set('scales/scale-1', { ...validScaleData, publishRevision: 5 }); // previous is 5
    dbState.set('organizations/org-1/members/u1', { name: 'User 1', status: 'active' });
    dbState.set('instruments/role-1', { id: 'role-1', name: 'Guitar', category: 'musical_instrument', organizationId: 'org-1' });
    dbState.set('bandScales/band-1', {
      bandScaleId: 'band-1',
      organizationId: 'org-1', 
      musicScaleId: null,
      assignments: [
        { instrumentId: 'role-1', userId: 'u1', assignmentId: 'a1' }
      ] 
    });

    const payload = { scalePatch: { ...validScalePatch, bandScaleId: 'band-1' } };
    const res = await MusicScaleCommandService.publishMusicScale({ 
      authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'rev-test', payload, correlationId: 'req-1' 
    });

    expect(res.version).toBe(6);
    
    const mutatedScale = dbState.get('scales/scale-1') as { publishRevision?: number, eventAssignments?: Record<string, unknown>[], bandScaleId?: string | null, musicScaleId?: string | null };
    expect(mutatedScale.publishRevision).toBe(6);

    const responses = Array.from(dbState.keys()).filter(k => k.startsWith('scales/scale-1/responses/'));
    expect(responses.length).toBe(1);
    expect(mutatedScale.eventAssignments.length).toBe(1);
    expect(mutatedScale.eventAssignments[0].assignmentRevision).toBe(6);
    expect((dbState.get(responses[0]) as { status: string }).status.toUpperCase()).toBe('PENDING');
  });

  // I. Provas negativas
  it('throws tenant scope mismatch error if scale belongs to another organization (prova negativa de vazamento de tenant)', async () => {
    dbState.set('scales/scale-1', { ...validScaleData, organizationId: 'org-2' }); // different org!
    
    await expect(MusicScaleCommandService.publishMusicScale({
      authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey: 'tenant-test', correlationId: 'c1',
      payload: { scalePatch: validScalePatch }
    })).rejects.toThrow("Acesso negado: a escala não pertence a esta organização.");
  });

});
