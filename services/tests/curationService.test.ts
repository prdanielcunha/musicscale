// @ts-ignore
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { curationService } from '../curationService';
import { db } from '../firebase';
import { getDocs, query, collection, doc, getDoc } from 'firebase/firestore';

// Mocking Firebase
vi.mock('../firebase', () => ({
  db: {}
}));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  getDocs: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn()
}));

describe('curationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should fetch candidates without filters', async () => {
        const mockSnapshot = {
            docs: [
                { id: '1', data: () => ({ name: 'test1' }) },
                { id: '2', data: () => ({ name: 'test2' }) }
            ]
        };
        (getDocs as any).mockResolvedValue(mockSnapshot);

        const res = await curationService.fetchCandidates({ limitMsgs: 20 });
        expect(res.candidates).toHaveLength(2);
        expect(res.hasMore).toBe(false); // only 2 < 20
    });

    it('should fetch candidate details', async () => {
        const mockSnapshot = {
            exists: () => true,
            id: '1',
            data: () => ({ classification: 'exact_match' })
        };
        (getDoc as any).mockResolvedValue(mockSnapshot);

        const res = await curationService.fetchCandidateDetails('1');
        expect(res).toBeDefined();
        expect((res as any)?.classification).toBe('exact_match');
    });
});
