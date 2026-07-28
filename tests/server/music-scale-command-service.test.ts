import { describe, it, expect, vi } from 'vitest';
import { MusicScaleCommandService } from '../../services/server/scale/musicScaleCommandService';
import { IdempotencyService } from '../../services/server/bandScale/idempotencyService';

const mockTransaction = {
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn()
};
const mockDb = {
  runTransaction: vi.fn((cb) => cb(mockTransaction)),
  collection: vi.fn(() => ({
    doc: vi.fn(() => ({ id: 'test-idemp' }))
  }))
};

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => mockDb),
  FieldValue: {
    serverTimestamp: vi.fn(() => 'server-timestamp')
  }
}));

describe('MusicScaleCommandService', () => {
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
});
