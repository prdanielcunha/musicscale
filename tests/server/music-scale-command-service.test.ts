import { CommandReceipt } from "../../services/server/bandScale/idempotencyService";
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicScaleCommandService, PublishCommandError, ValidationError } from '../../services/server/scale/musicScaleCommandService.js';
import { IdempotencyService } from '../../services/server/bandScale/idempotencyService.js';

// Mock getFirestore
const mockTransactionUpdate = vi.fn();
const mockTransactionSet = vi.fn();
let getQueue: any[] = [];
let writesOccurred = false;

const mockTransaction = {
  get: vi.fn((ref) => {
    if (writesOccurred) {
      throw new Error("READ_AFTER_WRITE");
    }
    if (getQueue.length === 0) {
      throw new Error(`Unexpected read of ${ref?.path || 'unknown'}`);
    }
    const next = getQueue.shift();
    return Promise.resolve(next);
  }),
  update: vi.fn((...args) => {
    writesOccurred = true;
    mockTransactionUpdate(...args);
  }),
  set: vi.fn((...args) => {
    writesOccurred = true;
    mockTransactionSet(...args);
  })
};

const mockDb = {
  runTransaction: vi.fn((callback) => callback(mockTransaction)),
  collection: vi.fn((path) => ({
    doc: vi.fn((id) => ({ id, path: `${path}/${id}`, collection: mockDb.collection })),
    where: vi.fn(() => ({
      get: vi.fn(),
    })),
  })),
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => mockDb),
  FieldValue: {
    serverTimestamp: vi.fn(() => 'server-timestamp')
  }
}));

describe('MusicScaleCommandService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getQueue = [];
    writesOccurred = false;

    // Spy on IdempotencyService static methods instead of full module mock
    vi.spyOn(IdempotencyService, 'getReceiptInTransaction').mockImplementation(async (transaction: any, orgId: string, receiptId: string) => {
      const ref = mockDb.collection('organizations').doc(orgId).collection('_commandReceipts').doc(receiptId);
      const doc = await transaction.get(ref);
      return doc.exists ? doc.data() : null;
    });

    vi.spyOn(IdempotencyService, 'writeReceiptInTransaction').mockImplementation((transaction: any, orgId: string, receiptId: string, receipt: any) => {
      transaction.set({ path: `organizations/${orgId}/_commandReceipts/${receiptId}` }, receipt);
    });
  });

  const validScaleData = {
    organizationId: 'org-1',
    status: 'draft',
    publishRevision: 0,
    date: '2026-07-28',
    eventTypeId: 'event-type-1',
    locationId: 'loc-1',
    songIds: ['song-1']
  };

  it('re-uses idempotency key', async () => {
    const fingerprint = IdempotencyService.getRequestFingerprint({ scalePatch: { bandScaleId: null } });
    getQueue = [
      {
        exists: true,
        data: () => ({
          status: 'completed',
          entityId: 'scale-1',
          requestFingerprint: fingerprint,
          result: { version: 1 }
        })
      } // Idempotency
    ];

    const result = await MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'test-idemp',
      payload: { bandScaleId: null },
      correlationId: 'test-idemp'
    });

    expect(result.fromCache).toBe(true);
    expect((result as unknown as { version: number, eventAssignmentCount: number }).version).toBe(1);
    expect(writesOccurred).toBe(false);
  });

  it('atomically deactivates previous active responses and applies patch on republish', async () => {
    getQueue = [
      { exists: false }, // Idempotency
      { exists: true, data: () => ({ name: 'Membro Teste' }) }, // Modifier
      { exists: true, data: () => ({ ...validScaleData, publishRevision: 1, status: 'published', time: '19:00' }) }, // Current Scale
      { docs: [{ ref: { path: 'resp-1' } }, { ref: { path: 'resp-2' } }] }, // active responses
      { docs: [{ id: 'user-2', data: () => ({ name: 'Membro Teste', status: 'active' }) }] } // Active members fallback query
    ];

    const patchPayload = {
      scalePatch: {
        time: '20:00',
        observations: 'Mudança de horário'
      }
    };

    const result = await MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'new-idemp-key',
      payload: patchPayload,
      correlationId: 'new-correlation-id'
    });

    expect(result.fromCache).toBe(false);
    expect((result as unknown as { version: number, eventAssignmentCount: number }).version).toBe(2);
    expect(mockTransactionUpdate).toHaveBeenCalledWith({ path: 'resp-1' }, expect.objectContaining({ active: false }));
    expect(mockTransactionUpdate).toHaveBeenCalledWith({ path: 'resp-2' }, expect.objectContaining({ active: false }));
    expect(mockTransactionUpdate).toHaveBeenCalledWith(expect.objectContaining({ path: 'scales/scale-1' }), expect.objectContaining({
      status: 'published',
      publishRevision: 2,
      time: '20:00',
      observations: 'Mudança de horário'
    }));
  });

  it('rejects idempotency key if entityId is different', async () => {
    getQueue = [
      {
        exists: true,
        data: () => ({
          status: 'completed',
          entityId: 'another-scale-id',
          requestFingerprint: IdempotencyService.getRequestFingerprint({ scalePatch: { bandScaleId: null } }),
          result: { version: 1 }
        })
      } // Idempotency
    ];

    await expect(MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'test-idemp',
      payload: { bandScaleId: null },
      correlationId: 'test-idemp'
    })).rejects.toThrowError(PublishCommandError);
  });

  it('throws validation error if scalePatch contains unauthorized keys', async () => {
    await expect(MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'test-idemp',
      payload: {
        scalePatch: {
          organizationId: 'malicious-org-inject',
          status: 'completed'
        } as any
      },
      correlationId: 'test-idemp'
    })).rejects.toThrowError(ValidationError);
  });

  it('throws tenant scope mismatch error if scale belongs to another organization', async () => {
    getQueue = [
      { exists: false }, // Idempotency
      { exists: true, data: () => ({ name: 'Membro Teste' }) }, // Modifier
      { exists: true, data: () => ({ ...validScaleData, organizationId: 'different-org-id' }) } // Current Scale
    ];

    await expect(MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'my-real-org',
      musicScaleId: 'scale-1',
      idempotencyKey: 'test-idemp',
      payload: { bandScaleId: null },
      correlationId: 'test-idemp'
    })).rejects.toThrowError(PublishCommandError);
  });

  it('successfully binds bandScale and updates bidirectional links atomically', async () => {
    getQueue = [
      { exists: false }, // Idempotency
      { exists: true, data: () => ({ name: 'Membro Teste' }) }, // Modifier
      { exists: true, data: () => ({ ...validScaleData, bandScaleId: null }) }, // Current Scale
      { exists: true, ref: { path: 'bandScales/band-scale-1' }, data: () => ({ organizationId: 'org-1', assignments: [{ userId: 'user-1', instrumentId: 'inst-1', active: true, assignmentId: 'assign-1' }], musicScaleId: null }) }, // nextBandScaleDoc
      { docs: [{ id: 'inst-1', data: () => ({ name: 'Guitarra', category: 'Instrumento', organizationId: 'org-1' }) }] }, // instrumentSnap
      { docs: [{ id: 'user-1', data: () => ({ name: 'Guitarrista', status: 'active' }) }] }, // membersSnap
      { docs: [] }, // crossMembersSnap
      { exists: true, data: () => ({ ownerUid: 'owner-1' }) } // orgSnap
    ];

    const result = await MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'new-idemp-key',
      payload: { bandScaleId: 'band-scale-1' },
      correlationId: 'new-correlation'
    });

    expect((result as unknown as { version: number, eventAssignmentCount: number }).version).toBe(1);
    expect((result as unknown as { version: number, eventAssignmentCount: number }).eventAssignmentCount).toBe(1);
    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'bandScales/band-scale-1' }),
      expect.objectContaining({ musicScaleId: 'scale-1' })
    );
  });

  it('throws validation error if payload.bandScaleId and scalePatch.bandScaleId diverge', async () => {
    await expect(MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'test-idemp',
      payload: {
        bandScaleId: 'band-1',
        scalePatch: { bandScaleId: 'band-2' }
      },
      correlationId: 'test-idemp'
    })).rejects.toThrowError(PublishCommandError);
  });

  it('preserves existing bandScaleId when omitted (undefined) in patch and payload', async () => {
    getQueue = [
      { exists: false }, // Idempotency
      { exists: true, data: () => ({ name: 'Membro Teste' }) }, // Modifier
      { exists: true, data: () => ({ ...validScaleData, bandScaleId: 'existing-band-scale-id' }) }, // Current Scale
      { exists: true, data: () => ({ organizationId: 'org-1', assignments: [], musicScaleId: null }) }, // previousBandScaleDoc (also nextBandScaleDoc)
      { docs: [] }, // instrumentSnap
      { docs: [] }, // membersSnap
      { docs: [] }, // crossMembersSnap
      { exists: true, data: () => ({ ownerUid: 'owner-1' }) } // orgSnap
    ];

    const result = await MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'preserve-idemp-key',
      payload: { scalePatch: { time: '19:00' } },
      correlationId: 'preserve-correlation'
    });

    expect((result as unknown as { version: number, eventAssignmentCount: number }).version).toBe(1);
    expect(mockTransactionUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ path: 'scales/scale-1' }),
      expect.objectContaining({ bandScaleId: 'existing-band-scale-id', time: '19:00' })
    );
  });

  it('fails with READ_AFTER_WRITE if a read is attempted after write', async () => {
    // Forcing a mock setup to write early to test the queue assertion logic
    const db = (await import('firebase-admin/firestore')).getFirestore();
    await expect(db.runTransaction(async (t: any) => {
      const ref = { path: 'some-path' };
      t.update(ref, {});
      await t.get(ref);
    })).rejects.toThrow('READ_AFTER_WRITE');
  });

  it('fails if durationMinutes is invalid', async () => {
    await expect(MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'test-idemp',
      payload: {
        scalePatch: {
          durationMinutes: -10
        }
      },
      correlationId: 'test-idemp'
    })).rejects.toThrowError(ValidationError);
  });

  it('fails if songSettings contain unknown keys', async () => {
    await expect(MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'test-idemp',
      payload: {
        scalePatch: {
          songSettings: {
            'song-1': { key: 'C', invalidKey: true } as any
          }
        }
      },
      correlationId: 'test-idemp'
    })).rejects.toThrowError(ValidationError);
  });

  it('handles concurrent attempts (bug das três tentativas) safely returning from cache for subsequent requests', async () => {
    // This test simulates 3 rapid clicks with the same idempotency key.
    // In a real environment, Firestore transactions lock the document and retry.
    // With our mock, we will simulate the behavior: the first request succeeds,
    // and subsequent ones read the newly written receipt and return fromCache.
    
    const idempotencyKey = 'triple-click-idemp';
    const payload = { scalePatch: { time: '18:00' } };
    const fingerprint = IdempotencyService.getRequestFingerprint(payload);
    let mockReceiptWritten = false;

    // We'll mock the IdempotencyService methods dynamically for this test
    vi.spyOn(IdempotencyService, 'getReceiptInTransaction').mockImplementation(async (transaction: any, orgId: string, receiptId: string) => {
      if (mockReceiptWritten) {
        return {
          status: 'completed',
          entityId: 'scale-1',
          requestFingerprint: fingerprint,
          result: { version: 1 },
          commandType: 'musicScale.publish',
          organizationId: orgId,
          completedAt: 'server-timestamp'
        } as any;
      }
      return null;
    });

    vi.spyOn(IdempotencyService, 'writeReceiptInTransaction').mockImplementation((transaction: any, orgId: string, receiptId: string, receipt: any) => {
      mockReceiptWritten = true;
    });

    // The first execution will perform normal reads
    getQueue = [
      { exists: true, data: () => ({ name: 'Membro Teste' }) }, // Modifier
      { exists: true, data: () => ({ ...validScaleData, bandScaleId: null }) }, // Current Scale
      { docs: [{ id: 'user-2', data: () => ({ name: 'Membro Teste', status: 'active' }) }] } // activeMembersSnap
    ];

    const res1 = await MusicScaleCommandService.publishMusicScale({
      authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey, payload, correlationId: 'req-1'
    });
    const res2 = await MusicScaleCommandService.publishMusicScale({
      authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey, payload, correlationId: 'req-2'
    });
    const res3 = await MusicScaleCommandService.publishMusicScale({
      authUid: 'u1', orgId: 'org-1', musicScaleId: 'scale-1', idempotencyKey, payload, correlationId: 'req-3'
    });

    expect(res1.fromCache).toBe(false);
    expect((res1 as unknown as { version: number, eventAssignmentCount: number }).version).toBe(1);

    expect(res2.fromCache).toBe(true);
    expect((res2 as unknown as { version: number, eventAssignmentCount: number }).version).toBe(1);

    expect(res3.fromCache).toBe(true);
    expect((res3 as unknown as { version: number, eventAssignmentCount: number }).version).toBe(1);
  });
});
