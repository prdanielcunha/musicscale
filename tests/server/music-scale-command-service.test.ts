import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicScaleCommandService } from '../../services/server/scale/musicScaleCommandService';
import { IdempotencyService } from '../../services/server/bandScale/idempotencyService';

const mockTransaction = {
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn()
};

const makeMockDoc = () => {
  const docObj = {
    id: 'test-doc-id',
    collection: vi.fn(),
    where: vi.fn(),
    get: vi.fn()
  };
  const mockQuery = {
    where: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({ docs: [] })
  };
  docObj.collection.mockReturnValue({
    doc: vi.fn().mockImplementation(makeMockDoc),
    where: vi.fn().mockReturnValue(mockQuery),
    get: vi.fn().mockResolvedValue({ docs: [] })
  });
  return docObj;
};

const mockResponsesQuery = {
  where: vi.fn().mockReturnThis()
};

const mockScaleDocRef = makeMockDoc();
mockScaleDocRef.collection = vi.fn((subcol) => {
  if (subcol === 'responses') {
    return mockResponsesQuery;
  }
  return {
    doc: vi.fn().mockImplementation(makeMockDoc),
    where: vi.fn().mockReturnThis()
  };
});

const mockDb = {
  runTransaction: vi.fn((cb) => cb(mockTransaction)),
  collection: vi.fn((colName) => {
    if (colName === 'scales') {
      return {
        doc: vi.fn().mockReturnValue(mockScaleDocRef),
        where: vi.fn().mockReturnThis()
      };
    }
    return {
      doc: vi.fn().mockImplementation(makeMockDoc),
      where: vi.fn().mockReturnThis()
    };
  })
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
  });

  it('re-uses idempotency key', async () => {
    
    const idempotencyDoc = {
      exists: true,
      data: () => ({ 
        status: 'completed', 
        requestFingerprint: IdempotencyService.getRequestFingerprint({ bandScaleId: null }),
        result: { version: 1, fromCache: true } 
      })
    };
    
    mockTransaction.get.mockResolvedValueOnce(idempotencyDoc);

    const result = await MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'test-idemp',
      payload: { bandScaleId: null },
      correlationId: 'test-idemp'
    });

    expect(result.fromCache).toBe(true);
    expect(result.version).toBe(1);
    expect(mockTransaction.get).toHaveBeenCalledTimes(1); 
  });

  it('atomically deactivates previous active responses and applies patch on republish', async () => {
    // 1. First get is the idempotency key check (does not exist)
    const idempotencyDoc = { exists: false };
    
    // 2. Second get is the caller membership check
    const membershipDoc = {
      exists: true,
      data: () => ({ name: 'Membro Teste' })
    };

    // 3. Third get is the scale document
    const scaleDoc = {
      exists: true,
      data: () => ({
        organizationId: 'org-1',
        status: 'published',
        publishRevision: 1,
        date: '2026-07-28',
        time: '18:00',
        songIds: ['song-1']
      })
    };

    // 4. Fourth get inside republication is responses query
    const oldResponseDoc1 = {
      ref: { id: 'resp-1' }
    };
    const oldResponseDoc2 = {
      ref: { id: 'resp-2' }
    };
    const responsesSnap = {
      docs: [oldResponseDoc1, oldResponseDoc2]
    };

    mockTransaction.get
      .mockResolvedValueOnce(idempotencyDoc) // idempotency check
      .mockResolvedValueOnce(membershipDoc)  // membership check
      .mockResolvedValueOnce(scaleDoc)       // current scale check
      .mockResolvedValueOnce(responsesSnap);  // active responses check

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
    expect(result.version).toBe(2);

    // Verify that the responses were queried
    expect(mockResponsesQuery.where).toHaveBeenCalledWith('active', '==', true);

    // Verify that both old responses were deactivated
    expect(mockTransaction.update).toHaveBeenCalledWith(oldResponseDoc1.ref, {
      active: false,
      updatedAt: 'server-timestamp'
    });
    expect(mockTransaction.update).toHaveBeenCalledWith(oldResponseDoc2.ref, {
      active: false,
      updatedAt: 'server-timestamp'
    });

    // Verify that the scale document was updated with the patch
    expect(mockTransaction.update).toHaveBeenCalledWith(mockScaleDocRef, expect.objectContaining({
      status: 'published',
      publishRevision: 2,
      time: '20:00',
      observations: 'Mudança de horário'
    }));
  });
});
