import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MusicScaleCommandService } from '../../services/server/scale/musicScaleCommandService';
import { IdempotencyService } from '../../services/server/bandScale/idempotencyService';

// Strict Two-Phase Transaction Emulator
let writeHappened = false;

const mockTransaction = {
  get: vi.fn().mockImplementation((ref) => {
    if (writeHappened) {
      throw new Error("Firestore read-after-write violation: Cannot read after a write has been performed in a transaction.");
    }
    return Promise.resolve({ exists: false });
  }),
  set: vi.fn().mockImplementation((ref, data) => {
    writeHappened = true;
    return mockTransaction;
  }),
  update: vi.fn().mockImplementation((ref, data) => {
    writeHappened = true;
    return mockTransaction;
  }),
  delete: vi.fn().mockImplementation((ref) => {
    writeHappened = true;
    return mockTransaction;
  })
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
  where: vi.fn().mockReturnThis(),
  doc: vi.fn().mockImplementation(makeMockDoc)
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
    writeHappened = false; // Reset the transaction tracker for each test
  });

  it('re-uses idempotency key', async () => {
    const idempotencyDoc = {
      exists: true,
      data: () => ({ 
        status: 'completed', 
        entityId: 'scale-1',
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
    const idempotencyDoc = { exists: false };
    const membershipDoc = {
      exists: true,
      data: () => ({ name: 'Membro Teste' })
    };
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
    const oldResponseDoc1 = { ref: { id: 'resp-1' } };
    const oldResponseDoc2 = { ref: { id: 'resp-2' } };
    const responsesSnap = { docs: [oldResponseDoc1, oldResponseDoc2] };

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

    expect(mockResponsesQuery.where).toHaveBeenCalledWith('active', '==', true);

    expect(mockTransaction.update).toHaveBeenCalledWith(oldResponseDoc1.ref, {
      active: false,
      updatedAt: 'server-timestamp'
    });
    expect(mockTransaction.update).toHaveBeenCalledWith(oldResponseDoc2.ref, {
      active: false,
      updatedAt: 'server-timestamp'
    });

    expect(mockTransaction.update).toHaveBeenCalledWith(mockScaleDocRef, expect.objectContaining({
      status: 'published',
      publishRevision: 2,
      time: '20:00',
      observations: 'Mudança de horário'
    }));
  });

  it('rejects idempotency key if entityId is different', async () => {
    const idempotencyDoc = {
      exists: true,
      data: () => ({ 
        status: 'completed', 
        entityId: 'another-scale-id',
        requestFingerprint: IdempotencyService.getRequestFingerprint({ bandScaleId: null }),
        result: { version: 1 } 
      })
    };
    
    mockTransaction.get.mockResolvedValueOnce(idempotencyDoc);

    await expect(MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'test-idemp',
      payload: { bandScaleId: null },
      correlationId: 'test-idemp'
    })).rejects.toThrow("Este recibo pertence à outra escala (another-scale-id).");
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
        }
      } as any,
      correlationId: 'test-idemp'
    })).rejects.toThrow("Campo não permitido no scalePatch: organizationId");
  });

  it('throws tenant scope mismatch error if scale belongs to another organization', async () => {
    const idempotencyDoc = { exists: false };
    const membershipDoc = { exists: true, data: () => ({ name: 'Membro Teste' }) };
    const scaleDoc = {
      exists: true,
      data: () => ({
        organizationId: 'different-org-id',
        status: 'draft',
        publishRevision: 0,
        date: '2026-07-28',
        songIds: ['song-1']
      })
    };

    mockTransaction.get
      .mockResolvedValueOnce(idempotencyDoc)
      .mockResolvedValueOnce(membershipDoc)
      .mockResolvedValueOnce(scaleDoc);

    await expect(MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'my-real-org',
      musicScaleId: 'scale-1',
      idempotencyKey: 'test-idemp',
      payload: { bandScaleId: null },
      correlationId: 'test-idemp'
    })).rejects.toThrow("Acesso negado: a escala não pertence a esta organização.");
  });

  it('successfully binds bandScale and updates bidirectional links atomically', async () => {
    const idempotencyDoc = { exists: false };
    const membershipDoc = { exists: true, data: () => ({ name: 'Membro Teste' }) };
    const scaleDoc = {
      exists: true,
      data: () => ({
        organizationId: 'org-1',
        status: 'draft',
        publishRevision: 0,
        date: '2026-07-28',
        songIds: ['song-1'],
        bandScaleId: null
      })
    };

    const bandScaleDoc = {
      exists: true,
      data: () => ({
        organizationId: 'org-1',
        assignments: [
          { userId: 'user-1', instrumentId: 'inst-1', active: true, assignmentId: 'assign-1' }
        ],
        musicScaleId: null
      })
    };

    const instrumentSnap = {
      docs: [
        { id: 'inst-1', data: () => ({ name: 'Guitarra', category: 'Instrumento', organizationId: 'org-1' }) }
      ]
    };

    const membersSnap = {
      docs: [
        { id: 'user-1', data: () => ({ name: 'Guitarrista', status: 'active' }) }
      ]
    };

    const crossMembersSnap = { docs: [] };
    const orgSnap = { exists: true, data: () => ({ ownerUid: 'owner-1' }) };

    mockTransaction.get
      .mockResolvedValueOnce(idempotencyDoc)
      .mockResolvedValueOnce(membershipDoc)
      .mockResolvedValueOnce(scaleDoc)
      .mockResolvedValueOnce(bandScaleDoc) // for resolvedBandScaleId
      .mockResolvedValueOnce(instrumentSnap)
      .mockResolvedValueOnce(membersSnap)
      .mockResolvedValueOnce(crossMembersSnap)
      .mockResolvedValueOnce(orgSnap);

    const result = await MusicScaleCommandService.publishMusicScale({
      authUid: 'u1',
      orgId: 'org-1',
      musicScaleId: 'scale-1',
      idempotencyKey: 'new-idemp-key',
      payload: { bandScaleId: 'band-scale-1' },
      correlationId: 'new-correlation'
    });

    expect(result.version).toBe(1);
    expect(result.eventAssignmentCount).toBe(1);

    // Verify bidirectional link updates are in progress atomically
    expect(mockTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-doc-id' }), // represents bandScaleRef doc
      expect.objectContaining({ musicScaleId: 'scale-1' })
    );
  });
});
