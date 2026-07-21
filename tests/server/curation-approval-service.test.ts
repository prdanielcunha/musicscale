import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CurationApprovalService } from '../../services/server/curationApprovalService';

describe('CurationApprovalService', () => {
    let mockDb: any;
    let mockAdmin: any;
    let mockLogger: any;
    let service: CurationApprovalService;

    const createMockDocRef = (id: string = 'mock-id') => {
        const ref: any = { id };
        ref.collection = vi.fn().mockReturnValue({
            doc: vi.fn().mockReturnValue({ id: 'sub-doc' })
        });
        return ref;
    };

    beforeEach(() => {
        mockDb = {
            collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockImplementation((id) => createMockDocRef(id)),
                where: vi.fn().mockReturnThis()
            }),
            runTransaction: vi.fn(),
        };
        
        mockAdmin = {
            firestore: {
                FieldValue: {
                    serverTimestamp: vi.fn(() => 'MOCK_TIMESTAMP'),
                },
            },
        };
        
        mockLogger = {
            error: vi.fn(),
            info: vi.fn(),
        };

        service = new CurationApprovalService({
            db: mockDb,
            admin: mockAdmin,
            logger: mockLogger,
        });
    });

    const createMockDoc = (exists: boolean, data: any = {}, id = 'mock-id') => ({
        exists,
        id,
        data: vi.fn(() => data),
    });

    const createMockQuery = (docs: any[]) => ({
        docs,
    });

    it('1. Missing required parameters', async () => {
        await expect(service.approve({
            candidateId: '',
            occurrenceId: 'occ-1',
            idempotencyKey: 'idemp-1',
            decodedToken: { uid: 'user-1' }
        })).rejects.toThrow("Parâmetros obrigatórios ausentes.");
    });

    it('2. Unauthenticated user or missing token', async () => {
        await expect(service.approve({
            candidateId: 'cand-1',
            occurrenceId: 'occ-1',
            idempotencyKey: 'idemp-1',
            decodedToken: null as any
        })).rejects.toThrow("Contexto de usuário (ator) ausente ou inválido.");
    });

    it('4. Candidate not found', async () => {
        mockDb.runTransaction.mockImplementation(async (cb: any) => {
            const mockT = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
            mockT.get.mockResolvedValueOnce(createMockDoc(false));
            return await cb(mockT);
        });

        await expect(service.approve({
            candidateId: 'cand-1',
            occurrenceId: 'occ-1',
            idempotencyKey: 'idemp-1',
            decodedToken: { uid: 'user-1' }
        })).rejects.toThrow("Candidata não encontrada.");
    });

    it('5. Candidate in non-approvable state', async () => {
        mockDb.runTransaction.mockImplementation(async (cb: any) => {
            const mockT = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { status: 'rejected' }));
            return await cb(mockT);
        });
        await expect(service.approve({
            candidateId: 'cand-1',
            occurrenceId: 'occ-1',
            idempotencyKey: 'idemp-1',
            decodedToken: { uid: 'user-1' }
        })).rejects.toThrow("Estado da candidata não permite aprovação. (Estado atual: rejected)");
    });

    it('6. Base occurrence missing', async () => {
        mockDb.runTransaction.mockImplementation(async (cb: any) => {
            const mockT = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { status: 'pending_review' }));
            mockT.get.mockResolvedValueOnce(createMockDoc(false));
            return await cb(mockT);
        });
        await expect(service.approve({
            candidateId: 'cand-1',
            occurrenceId: 'occ-1',
            idempotencyKey: 'idemp-1',
            decodedToken: { uid: 'user-1' }
        })).rejects.toThrow("Ocorrência-base não encontrada.");
    });

    it('7. Invalid canonical identity', async () => {
        mockDb.runTransaction.mockImplementation(async (cb: any) => {
            const mockT = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { 
                status: 'pending_review',
                canonicalIdentity: { normalizedTitle: "" } 
            }));
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { snapshot: {} })); // occSnap
            mockT.get.mockResolvedValueOnce(createMockQuery([])); // occurrencesSnap
            return await cb(mockT);
        });
        await expect(service.approve({
            candidateId: 'cand-1',
            occurrenceId: 'occ-1',
            idempotencyKey: 'idemp-1',
            decodedToken: { uid: 'user-1' }
        })).rejects.toThrow("Identidade da candidata inválida.");
    });

    it('8. Idempotent approval with same key', async () => {
        mockDb.runTransaction.mockImplementation(async (cb: any) => {
            const mockT = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { 
                status: 'approved',
                approvalIdempotencyKey: 'idemp-1',
                resultingGlobalSongId: 'global-123'
            }));
            return await cb(mockT);
        });
        const result = await service.approve({
            candidateId: 'cand-1',
            occurrenceId: 'occ-1',
            idempotencyKey: 'idemp-1',
            decodedToken: { uid: 'user-1' }
        });
        expect(result).toEqual({ success: true, alreadyApproved: true, globalSongId: 'global-123' });
    });

    it('9. Conflict with different idempotency key', async () => {
        mockDb.runTransaction.mockImplementation(async (cb: any) => {
            const mockT = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { 
                status: 'approved',
                approvalIdempotencyKey: 'diff-key',
                resultingGlobalSongId: 'global-123'
            }));
            return await cb(mockT);
        });
        await expect(service.approve({
            candidateId: 'cand-1',
            occurrenceId: 'occ-1',
            idempotencyKey: 'idemp-1',
            decodedToken: { uid: 'user-1' }
        })).rejects.toThrow("Candidata já foi aprovada por outra operação/token.");
    });

    it('10. Reservation collision from another candidate', async () => {
        mockDb.runTransaction.mockImplementation(async (cb: any) => {
            const mockT = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { 
                status: 'pending_review',
                canonicalIdentity: { contentFingerprint: 'res-id' }
            }));
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { snapshot: {} })); // occSnap
            mockT.get.mockResolvedValueOnce(createMockQuery([])); // occurrencesSnap
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { candidateId: 'another-cand' })); // reservationSnap
            return await cb(mockT);
        });
        await expect(service.approve({
            candidateId: 'cand-1',
            occurrenceId: 'occ-1',
            idempotencyKey: 'idemp-1',
            decodedToken: { uid: 'user-1' }
        })).rejects.toThrow("ABORT_RESERVATION_COLLISION");
    });

    it('12/13. Duplicate global song detected', async () => {
        mockDb.runTransaction.mockImplementation(async (cb: any) => {
            const mockT = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { 
                status: 'pending_review',
                canonicalIdentity: { contentFingerprint: 'res-id', normalizedTitle: 'test', normalizedArtists: ['a'], externalReferences: {} }
            }));
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { snapshot: {} })); // occSnap
            mockT.get.mockResolvedValueOnce(createMockQuery([])); // occurrencesSnap
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { candidateId: 'cand-1' })); // reservationSnap (same cand)
            
            // For the where query
            mockT.get.mockResolvedValueOnce(createMockQuery([
                createMockDoc(true, { normalizedTitle: 'test', normalizedArtist: 'a' }, 'duplicate-1')
            ]));
            
            return await cb(mockT);
        });
        await expect(service.approve({
            candidateId: 'cand-1',
            occurrenceId: 'occ-1',
            idempotencyKey: 'idemp-1',
            decodedToken: { uid: 'user-1' }
        })).rejects.toThrow("ABORT_DUPLICATE|duplicate-1");
    });

    it('14-24. Full successful approval flow', async () => {
        const globalSongDoc = createMockDocRef('new-global-song-id');
        mockDb.collection.mockImplementation((path: string) => {
            if (path === 'globalSongs') {
                return {
                    where: vi.fn().mockReturnThis(),
                    doc: vi.fn().mockReturnValue(globalSongDoc)
                };
            }
            return { 
                doc: vi.fn().mockImplementation((id) => createMockDocRef(id)) 
            };
        });

        mockDb.runTransaction.mockImplementation(async (cb: any) => {
            const mockT = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
            
            // 1. candidate
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { 
                status: 'pending_review',
                canonicalIdentity: { contentFingerprint: 'res-id', normalizedTitle: 'test', normalizedArtists: ['a'], externalReferences: {} }
            }));
            
            // 2. occSnap
            mockT.get.mockResolvedValueOnce(createMockDoc(true, { 
                snapshot: { title: 'Test Song' },
                source: { organizationId: 'org-1', songId: 'local-1' }
            }));
            
            // 3. occurrencesSnap
            mockT.get.mockResolvedValueOnce(createMockQuery([
                createMockDoc(true, { source: { organizationId: 'org-1', songId: 'local-1' } })
            ]));
            
            // 4. reservationSnap
            mockT.get.mockResolvedValueOnce(createMockDoc(false));
            
            // 5. titleQuery
            mockT.get.mockResolvedValueOnce(createMockQuery([]));
            
            // 6. logSnap
            mockT.get.mockResolvedValueOnce(createMockDoc(false));

            return await cb(mockT);
        });

        const result = await service.approve({
            candidateId: 'cand-1',
            occurrenceId: 'occ-1',
            idempotencyKey: 'idemp-1',
            decodedToken: { uid: 'user-1' }
        });

        expect(result.success).toBe(true);
        expect(result.globalSongId).toBe('new-global-song-id');
    });
});
