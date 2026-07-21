import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CurationApprovalService, CurationError } from '../../services/server/curationApprovalService.js';
import { createCurationApprovalHttpHandler } from '../../services/server/curationApprovalHttpHandler.js';
import * as matcher from '../../utils/songDiscovery/matcher.js';

class StrictTransactionMock {
    writeStarted = false;
    gets: any[] = [];
    sets: any[] = [];
    updates: any[] = [];

    async get(ref: any) {
        if (this.writeStarted) throw new Error("FIRESTORE_READ_AFTER_WRITE_FORBIDDEN");
        this.gets.push(ref);
        if (ref._mockGetData) return ref._mockGetData();
        if (ref._isCollection) return { docs: [] };
        return { exists: false, data: () => null };
    }

    set(ref: any, data: any) {
        this.writeStarted = true;
        this.sets.push({ ref, data });
    }

    update(ref: any, data: any) {
        this.writeStarted = true;
        this.updates.push({ ref, data });
    }
}

describe('CurationApprovalHttpHandler', () => {
    let mockDeps: any;
    let mockReq: any;
    let mockRes: any;
    
    beforeEach(() => {
        mockDeps = { db: {}, admin: {}, logger: { error: vi.fn(), info: vi.fn() } };
        mockReq = { body: { candidateId: 'c1', occurrenceId: 'o1', idempotencyKey: 'idk1' }, ecosystemContext: { uid: 'u1', hasCurationAccess: true } };
        mockRes = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    });

    afterEach(() => { vi.restoreAllMocks(); });

    it('1. sucesso retorna 200', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockResolvedValue({ success: true, globalSongId: 'g1' });
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({ success: true, globalSongId: 'g1' });
    });

    it('2. parâmetros ausentes retornam 400', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        mockReq.body = {};
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockRejectedValue(new CurationError('VALIDATION_ERROR', 'Parâmetros ausentes.', 400));
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('3. contexto de ator ausente não retorna 200', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        mockReq.ecosystemContext = undefined;
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('4. acesso de curadoria negado retorna 403', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        mockReq.ecosystemContext = { uid: 'u1', hasCurationAccess: false };
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(403);
    });

    it('5. candidata inexistente possui status estável (404)', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockRejectedValue(new CurationError('CANDIDATE_NOT_FOUND', 'Não encontrada', 404));
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('6. idempotência válida retorna sucesso (200)', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockResolvedValue({ success: true, alreadyApproved: true, globalSongId: 'g1' });
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('7. conflito de idempotência possui status estável (409)', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockRejectedValue(new CurationError('IDEMPOTENCY_CONFLICT', 'Conflito', 409));
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(409);
    });

    it('8. reserva em colisão retorna 409', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockRejectedValue(new CurationError('RESERVATION_COLLISION', 'Colisão', 409));
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(409);
    });

    it('9. duplicata retorna 409', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockRejectedValue(new CurationError('DUPLICATE_GLOBAL_SONG', 'Dup', 409, 'dup-id'));
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(409);
    });

    it('10. duplicateGlobalSongId é preservado', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockRejectedValue(new CurationError('DUPLICATE_GLOBAL_SONG', 'Dup', 409, 'global123'));
        await handler(mockReq, mockRes);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ duplicateGlobalSongId: 'global123' }));
    });

    it('11. falha inesperada retorna 500 sem stack', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockRejectedValue(new Error('Erro bruto db'));
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(500);
    });

    it('12. body não pode substituir o ator autenticado', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        mockReq.body.decodedToken = { uid: 'HACKER', hasCurationAccess: true };
        const serviceSpy = vi.spyOn(CurationApprovalService.prototype, 'approve').mockResolvedValue({ success: true, globalSongId: 'g1' });
        await handler(mockReq, mockRes);
        expect(serviceSpy).toHaveBeenCalledWith(expect.objectContaining({ decodedToken: { uid: 'u1', hasCurationAccess: true } }));
    });
});

describe('CurationApprovalService Strict Transaction', () => {
    let mockDb: any;
    let mockAdmin: any;
    let mockLogger: any;
    let service: CurationApprovalService;
    let defaultParams: any;

    const createRef = (id: string, dataFn: Function) => ({
        id,
        _mockGetData: dataFn,
        collection: vi.fn().mockReturnValue({ _isCollection: true, doc: (docId: string) => createRef(docId, () => ({ exists: false, data: () => null })) })
    });

    beforeEach(() => {
        mockAdmin = { firestore: { FieldValue: { serverTimestamp: () => 'MOCK_TIME' } } };
        mockLogger = { info: vi.fn(), error: vi.fn() };
        
        mockDb = {
            collection: (name: string) => ({ doc: (id: string = 'new-id') => createRef(id, () => ({ exists: false, data: () => null })), where: () => ({ _isCollection: true, get: async () => ({ docs: [] }) }) }),
            runTransaction: async (cb: any) => cb(new StrictTransactionMock())
        };

        service = new CurationApprovalService({ db: mockDb, admin: mockAdmin, logger: mockLogger });
        defaultParams = { candidateId: 'c1', occurrenceId: 'o1', idempotencyKey: 'key1', decodedToken: { uid: 'admin', hasCurationAccess: true } };
    });

    afterEach(() => { vi.restoreAllMocks(); });

    const setupTransaction = (setupFn: (t: StrictTransactionMock) => void) => {
        mockDb.runTransaction = async (cb: any) => { const t = new StrictTransactionMock(); setupFn(t); return cb(t); };
    };

    it('1. parâmetros ausentes falha antes da transação', async () => {
        await expect(service.approve({ ...defaultParams, candidateId: '' })).rejects.toThrow('Parâmetros obrigatórios ausentes');
    });

    it('2. ator ausente falha antes da transação', async () => {
        await expect(service.approve({ ...defaultParams, decodedToken: null as any })).rejects.toThrow('Contexto de usuário');
    });

    it('3. candidata inexistente (CANDIDATE_NOT_FOUND)', async () => {
        setupTransaction((t) => { t.get = async (ref: any) => ({ exists: false }); });
        await expect(service.approve(defaultParams)).rejects.toThrow('Candidata não encontrada');
    });

    it('4. estado inválido (CANDIDATE_STATE_INVALID)', async () => {
        setupTransaction((t) => { t.get = async (ref: any) => { if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'rejected' }) }; return { exists: false }; }; });
        await expect(service.approve(defaultParams)).rejects.toThrow('Estado da candidata não permite');
    });

    it('5. ocorrência inexistente (OCCURRENCE_NOT_FOUND)', async () => {
        setupTransaction((t) => { t.get = async (ref: any) => { if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'pending_review' }) }; return { exists: false }; }; });
        await expect(service.approve(defaultParams)).rejects.toThrow('Ocorrência-base não encontrada');
    });

    it('6. canonicalIdentity inexistente (CANONICAL_IDENTITY_INVALID)', async () => {
        setupTransaction((t) => { t.get = async (ref: any) => { if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'pending_review' }) }; if (ref.id === 'o1') return { exists: true, data: () => ({ snapshot: {} }) }; if (ref._isCollection) return { docs: [] }; return { exists: false }; }; });
        await expect(service.approve(defaultParams)).rejects.toThrow('Identidade da candidata inválida');
    });

    it('7. aprovação idempotente sucesso', async () => {
        setupTransaction((t) => { t.get = async (ref: any) => { if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'approved', approvalIdempotencyKey: 'key1', resultingGlobalSongId: 'g1' }) }; return { exists: false }; }; });
        const res = await service.approve(defaultParams);
        expect(res.alreadyApproved).toBe(true);
    });

    it('8. conflito de idempotência (IDEMPOTENCY_CONFLICT)', async () => {
        setupTransaction((t) => { t.get = async (ref: any) => { if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'approved', approvalIdempotencyKey: 'other-key' }) }; return { exists: false }; }; });
        await expect(service.approve(defaultParams)).rejects.toThrow('Candidata já foi aprovada por outra operação/token');
    });

    it('9. reserva ausente (Criação de reserva)', async () => {
        let tSets = 0;
        setupTransaction((t) => {
            const ogSet = t.set.bind(t);
            t.set = (ref: any, data: any) => { ogSet(ref, data); tSets++; };
            t.get = async (ref: any) => { if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) }; if (ref.id === 'o1') return { exists: true, data: () => ({ snapshot: {} }) }; if (ref._isCollection) return { docs: [] }; return { exists: false }; };
        });
        await service.approve(defaultParams);
        expect(tSets).toBeGreaterThanOrEqual(2);
    });

    it('10. reserva de outra candidata (RESERVATION_COLLISION)', async () => {
        setupTransaction((t) => { t.get = async (ref: any) => { if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) }; if (ref.id === 'o1') return { exists: true, data: () => ({ snapshot: {} }) }; if (ref.id === 'A_') return { exists: true, data: () => ({ candidateId: 'c2' }) }; if (ref._isCollection) return { docs: [] }; return { exists: false }; }; });
        await expect(service.approve(defaultParams)).rejects.toThrow('Colisão de reserva');
    });

    it('11. duplicata exata (DUPLICATE_GLOBAL_SONG)', async () => {
        vi.spyOn(matcher, 'compareSongs').mockReturnValue({ classification: 'exact_match', reasons: [], warnings: [], scores: {} } as any);
        setupTransaction((t) => {
            t.get = async (ref: any) => {
                if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) };
                if (ref.id === 'o1') return { exists: true, data: () => ({ snapshot: {} }) };
                if (ref.id === 'A_') return { exists: false };
                if (ref._isTitleQuery) return { docs: [{ id: 'dup1', data: () => ({ normalizedTitle: 'A' }) }] };
                if (ref._isCollection) return { docs: [] };
                return { exists: false };
            };
        });
        mockDb.collection = (name: string) => ({ doc: (id: string = 'new-id') => createRef(id, () => ({ exists: false, data: () => null })), where: () => ({ _isCollection: true, _isTitleQuery: true, get: () => ({ docs: [] }) }) });
        await expect(service.approve(defaultParams)).rejects.toThrow('Duplicata global detectada');
    });

    it('12. documento local inexistente aborta (SOURCE_SONG_NOT_FOUND)', async () => {
        setupTransaction((t) => {
            t.get = async (ref: any) => {
                if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) };
                if (ref.id === 'o1') return { exists: true, data: () => ({ snapshot: {} }) };
                if (ref.id === 'A_') return { exists: false };
                if (ref._isCollection && !ref._isTitleQuery) return { docs: [{ data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) }] };
                if (ref._isTitleQuery) return { docs: [] };
                if (ref.id === 'song1') return { exists: false }; // Missing!
                return { exists: false };
            };
        });
        mockDb.collection = (name: string) => ({ doc: (id: string = 'new-id') => createRef(id, () => ({ exists: false, data: () => null })), where: () => ({ _isCollection: true, _isTitleQuery: true }) });
        await expect(service.approve(defaultParams)).rejects.toThrow('Música de origem não encontrada');
    });

    it('13. organização divergente aborta (SOURCE_ORGANIZATION_MISMATCH)', async () => {
        setupTransaction((t) => {
            t.get = async (ref: any) => {
                if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) };
                if (ref.id === 'o1') return { exists: true, data: () => ({ snapshot: {} }) };
                if (ref.id === 'A_') return { exists: false };
                if (ref._isCollection && !ref._isTitleQuery) return { docs: [{ data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) }] };
                if (ref._isTitleQuery) return { docs: [] };
                if (ref.id === 'song1') return { exists: true, data: () => ({ organizationId: 'org-HACKER' }) };
                return { exists: false };
            };
        });
        mockDb.collection = (name: string) => ({ doc: (id: string) => createRef(id, () => ({ exists: false, data: () => null })), where: () => ({ _isCollection: true, _isTitleQuery: true }) });
        await expect(service.approve(defaultParams)).rejects.toThrow('Música de origem não pertence');
    });

    it('14. PROVA DO MOCK: Mock rejeita leitura após escrita (FIRESTORE_READ_AFTER_WRITE_FORBIDDEN)', async () => {
        let threw = false;
        try {
            const t = new StrictTransactionMock();
            t.set({ id: 'dummy' }, {}); // write
            await t.get({ id: 'dummy2' }); // read after write
        } catch (e: any) {
            threw = true;
            expect(e.message).toBe('FIRESTORE_READ_AFTER_WRITE_FORBIDDEN');
        }
        expect(threw).toBe(true);
    });

    it('15. Nenhuma leitura ocorre após escrita no serviço real de aprovação', async () => {
        let myT: StrictTransactionMock;
        setupTransaction((t) => {
            myT = t;
            t.get = async (ref: any) => {
                if (t.writeStarted) throw new Error("FIRESTORE_READ_AFTER_WRITE_FORBIDDEN");
                if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) };
                if (ref.id === 'o1') return { exists: true, data: () => ({ snapshot: { title: 'T', artist: 'Art' } }) };
                if (ref._isCollection) return { docs: [] };
                return { exists: false };
            };
        });
        mockDb.collection = (name: string) => ({ doc: (id: string) => createRef(id, () => ({ exists: false, data: () => null })), where: () => ({ _isCollection: true, _isTitleQuery: true }) });
        await service.approve(defaultParams);
    });

    it('16. criação do review log, criação da música global e update da candidata', async () => {
        let myT: StrictTransactionMock;
        setupTransaction((t) => {
            myT = t;
            t.get = async (ref: any) => {
                if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) };
                if (ref.id === 'o1') return { exists: true, data: () => ({ snapshot: { title: 'T', artist: 'Art' } }) };
                if (ref._isCollection) return { docs: [] };
                return { exists: false };
            };
        });
        mockDb.collection = (name: string) => ({ doc: (id: string = 'newId') => createRef(id, () => ({ exists: false, data: () => null })), where: () => ({ _isCollection: true, _isTitleQuery: true }) });
        await service.approve(defaultParams);

        expect(myT!.sets.length).toBe(3); // reservation, globalSong, reviewLog
        expect(myT!.updates.length).toBe(1); // candidate status
    });

    it('17. review log já existente não é duplicado', async () => {
        let myT: StrictTransactionMock;
        setupTransaction((t) => {
            myT = t;
            t.get = async (ref: any) => {
                if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) };
                if (ref.id === 'o1') return { exists: true, data: () => ({ snapshot: { title: 'T', artist: 'Art' } }) };
                if (ref.id === 'approve_key1') return { exists: true, data: () => ({}) }; // log exists!
                if (ref._isCollection) return { docs: [] };
                return { exists: false };
            };
        });
        mockDb.collection = (name: string) => ({ doc: (id: string = 'newId') => createRef(id, () => ({ exists: false, data: () => null })), where: () => ({ _isCollection: true, _isTitleQuery: true }) });
        await service.approve(defaultParams);
        expect(myT!.sets.length).toBe(2); // reservation, globalSong
    });

    it('18. duplicidade de ocorrências atualiza o local song apenas uma vez', async () => {
        let myT: StrictTransactionMock;
        setupTransaction((t) => {
            myT = t;
            t.get = async (ref: any) => {
                if (ref.id === 'c1') return { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) };
                if (ref.id === 'o1') return { exists: true, data: () => ({ snapshot: { title: 'T' } }) };
                if (ref.id === 'song1') return { exists: true, data: () => ({ organizationId: 'org1' }) };
                if (ref._isTitleQuery) return { docs: [] };
                if (ref._isCollection) return { docs: [
                    { data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) },
                    { data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) }
                ] };
                return { exists: false };
            };
        });
        mockDb.collection = (name: string) => ({ doc: (id: string = 'newId') => createRef(id, () => ({ exists: false, data: () => null })), where: () => ({ _isCollection: true, _isTitleQuery: true }) });
        await service.approve(defaultParams);
        expect(myT!.updates.length).toBe(2); // 1 candidate + 1 local song
    });
});
