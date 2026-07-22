import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CurationApprovalService, CurationError } from '../../services/server/curationApprovalService.js';
import { createCurationApprovalHttpHandler } from '../../services/server/curationApprovalHttpHandler.js';
import * as matcher from '../../utils/songDiscovery/matcher.js';

class StrictTransactionMock {
    writeStarted = false;
    gets: any[] = [];
    sets: any[] = [];
    updates: any[] = [];
    private _registeredDocs = new Map<string, any>();
    private _registeredQueries = new Map<string, any[]>();
    private _failures = new Map<string, Error>();

    registerDocument(path: string, snapshot: any) {
        this._registeredDocs.set(path, snapshot);
    }
    registerQuery(path: string, snapshots: any[]) {
        this._registeredQueries.set(path, snapshots);
    }
    failOnPath(path: string, error: Error) {
        this._failures.set(path, error);
    }

    private async _get(ref: any) {
        if (this.writeStarted) throw new Error("FIRESTORE_READ_AFTER_WRITE_FORBIDDEN");
        this.gets.push(ref);
        const path = ref.path || ref.id;
        
        if (this._failures.has(path)) {
            throw this._failures.get(path);
        }

        if (ref._isCollection) {
            if (this._registeredQueries.has(path)) {
                return { docs: this._registeredQueries.get(path) };
            }
            if (ref._mockGetData) return ref._mockGetData();
            return { docs: [] };
        }
        
        if (this._registeredDocs.has(path)) {
            return this._registeredDocs.get(path);
        }
        if (ref._mockGetData) return ref._mockGetData();
        return { exists: false, data: () => null, id: ref.id, ref };
    }

    private _set(ref: any, data: any) {
        this.writeStarted = true;
        this.sets.push({ ref, data });
    }

    private _update(ref: any, data: any) { 
        this.writeStarted = true;
        this.updates.push({ ref, data });
    }

    get get() { return this._get.bind(this); }
    set get(val: any) { throw new Error("OVERRIDE_FORBIDDEN"); }
    get set() { return this._set.bind(this); }
    set set(val: any) { throw new Error("OVERRIDE_FORBIDDEN"); }
    get update() { return this._update.bind(this); }
    set update(val: any) { throw new Error("OVERRIDE_FORBIDDEN"); }
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
        expect(mockRes.status).toHaveBeenCalledWith(401);
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
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockResolvedValue({ success: true, globalSongId: 'g1', alreadyApproved: true });
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(200);
        expect(mockRes.json).toHaveBeenCalledWith({ success: true, globalSongId: 'g1', alreadyApproved: true });
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
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockRejectedValue(new CurationError('DUPLICATE_GLOBAL_SONG', 'Dup', 409, 'g2'));
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
        vi.spyOn(CurationApprovalService.prototype, 'approve').mockRejectedValue(new Error('crash'));
        await handler(mockReq, mockRes);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({ error: "Erro inesperado na transação de curadoria.", code: "TRANSACTION_FAILED" });
    });
    it('12. body não pode substituir o ator autenticado', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        mockReq.body.decodedToken = { uid: 'hacker', hasCurationAccess: true };
        const approveSpy = vi.spyOn(CurationApprovalService.prototype, 'approve').mockResolvedValue({ success: true, globalSongId: 'g1' });
        await handler(mockReq, mockRes);
        expect(approveSpy).toHaveBeenCalledWith(expect.objectContaining({ decodedToken: mockReq.ecosystemContext }));
    });

    it('13. parâmetros inválidos', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        const cases = [
            { candidateId: 1, occurrenceId: 'o1', idempotencyKey: 'idk1' },
            { candidateId: {}, occurrenceId: 'o1', idempotencyKey: 'idk1' },
            { candidateId: [], occurrenceId: 'o1', idempotencyKey: 'idk1' },
            { candidateId: '   ', occurrenceId: 'o1', idempotencyKey: 'idk1' },
            { candidateId: 'c1', occurrenceId: 1, idempotencyKey: 'idk1' },
            { candidateId: 'c1', occurrenceId: {}, idempotencyKey: 'idk1' },
            { candidateId: 'c1', occurrenceId: [], idempotencyKey: 'idk1' },
            { candidateId: 'c1', occurrenceId: '   ', idempotencyKey: 'idk1' },
            { candidateId: 'c1', occurrenceId: 'o1', idempotencyKey: 1 },
            { candidateId: 'c1', occurrenceId: 'o1', idempotencyKey: {} },
            { candidateId: 'c1', occurrenceId: 'o1', idempotencyKey: [] },
            { candidateId: 'c1', occurrenceId: 'o1', idempotencyKey: true },
            { candidateId: 'c1', occurrenceId: 'o1', idempotencyKey: '   ' },
            { candidateId: 'c1', occurrenceId: 'o1', idempotencyKey: 'a\u0000b' },
            { candidateId: 'c1', occurrenceId: 'o1', idempotencyKey: 'a'.repeat(201) },
        ];
        
        for (const c of cases) {
            mockReq.body = c;
            await handler(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: "Parâmetros obrigatórios ausentes ou inválidos.",
                code: "VALIDATION_ERROR"
            });
            mockRes.status.mockClear();
            mockRes.json.mockClear();
        }
    });

    it('14. log de erro inesperado com payload malformado sanitiza chaves', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        mockReq.body = { candidateId: 1, occurrenceId: {}, idempotencyKey: [] };
        mockRes.status.mockImplementationOnce(() => { throw new Error('crash'); }).mockReturnThis();
        await handler(mockReq, mockRes);
        expect(mockDeps.logger.error).toHaveBeenCalledWith(
            "Curation approval HTTP error", 
            expect.objectContaining({
                candidateId: null,
                occurrenceId: null,
                correlationId: expect.any(String)
            })
        );
        expect(mockDeps.logger.error.mock.calls[0][1].correlationId).not.toEqual([]);
    });

    it('15. log de CurationError sanitiza identificadores e inclui safeMessage', async () => {
        const handler = createCurationApprovalHttpHandler(mockDeps);
        mockReq.body = { candidateId: 1, occurrenceId: {}, idempotencyKey: [] };
        mockRes.status.mockImplementationOnce(() => { throw new CurationError('DUPLICATE_GLOBAL_SONG', 'Duplicata encontrada', 409, 'g2'); }).mockReturnThis();
        await handler(mockReq, mockRes);
        expect(mockDeps.logger.error).toHaveBeenCalledWith(
            "Curation approval HTTP error",
            expect.objectContaining({
                candidateId: null,
                occurrenceId: null,
                correlationId: expect.any(String),
                code: 'DUPLICATE_GLOBAL_SONG',
                safeMessage: 'Duplicata encontrada'
            })
        );
    });

});

describe('CurationApprovalService', () => {
    it('tentar reatribuir transaction.get lança OVERRIDE_FORBIDDEN', async () => {
        await expect(mockDb.runTransaction(async (t: any) => {
            t.get = () => {};
        })).rejects.toThrow('OVERRIDE_FORBIDDEN');
    });

    it('tentar reatribuir transaction.set lança OVERRIDE_FORBIDDEN', async () => {
        await expect(mockDb.runTransaction(async (t: any) => {
            t.set = () => {};
        })).rejects.toThrow('OVERRIDE_FORBIDDEN');
    });

    it('tentar reatribuir transaction.update lança OVERRIDE_FORBIDDEN', async () => {
        await expect(mockDb.runTransaction(async (t: any) => {
            t.update = () => {};
        })).rejects.toThrow('OVERRIDE_FORBIDDEN');
    });

    it('500 error security - log does not leak, message is safe', async () => {
        const customDb = {
            collection: mockDb.collection.bind(mockDb),
            runTransaction: async () => {
                throw new Error("Detailed technical error with path /collections/secrets");
            }
        };
        const customDeps = {
            db: customDb,
            admin: { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIME' } } },
            logger: { error: vi.fn(), info: vi.fn() }
        };
        
        const service = new CurationApprovalService(customDeps as any);
        const { createCurationApprovalHttpHandler } = await import('../../services/server/curationApprovalHttpHandler.js');
        const handler = createCurationApprovalHttpHandler(customDeps as any);
        
        const req = {
            body: { candidateId: 'c1', occurrenceId: 'o1', idempotencyKey: 'idemp1' },
            ecosystemContext: { uid: 'user1', hasCurationAccess: true }
        };
        const res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        
        await handler(req as any, res as any);
        
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'Erro inesperado na transação de curadoria.', code: 'TRANSACTION_FAILED' });
        
        expect(customDeps.logger.error).toHaveBeenCalledWith("Curation approval HTTP error", expect.objectContaining({
            code: "TRANSACTION_FAILED",
            message: "Falha inesperada na transação de curadoria"
        }));
        expect(customDeps.logger.error.mock.calls[0][1]).not.toHaveProperty("stack");
        expect(customDeps.logger.error.mock.calls[0][1]).not.toHaveProperty("snapshot");
    });
    let mockDb: any;
    let mockAdmin: any;
    let service: CurationApprovalService;
    let defaultParams: any;
    let myT: StrictTransactionMock;

    const createRef = (id: string, dataFn: () => any) => {
    const parts = id.split('/');
    const docId = parts[parts.length - 1];
    return {
        id: docId,
        path: id,
        _mockGetData: dataFn,
        collection: (name: string) => ({
                _isCollection: true,
                path: id + "/" + name,
                doc: (subId: string) => createRef(id + "/" + name + "/" + subId, () => ({ exists: false, data: () => null }))
        })
    };
};

    const createQuery = (path: string, docs: any[]) => {
        return docs.map(d => ({
            id: d.id,
            path: `${path}/${d.id}`,
            data: d.data
        }));
    };

    beforeEach(() => {
        myT = new StrictTransactionMock();
        mockDb = {
            runTransaction: async (cb: any) => cb(myT),
            collection: (name: string) => ({
                doc: (id: string) => createRef(name + "/" + id, () => ({ exists: false, data: () => null })),
                where: () => ({ _isCollection: true, _isTitleQuery: true, path: name + '_query' })
            })
        };
        mockAdmin = { firestore: { FieldValue: { serverTimestamp: () => 'SERVER_TIME' } } };
        service = new CurationApprovalService({ db: mockDb, admin: mockAdmin, logger: { error: vi.fn(), info: vi.fn() } });
        defaultParams = {
            candidateId: 'c1',
            occurrenceId: 'o1',
            idempotencyKey: 'idk1',
            decodedToken: { uid: 'u1', hasCurationAccess: true }
        };
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const stdCandidate = { status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } };
    const stdOccurrence = { snapshot: { title: 'T' } };

    it('1. parâmetros ausentes falha antes da transação', async () => {
        await expect(service.approve({} as any)).rejects.toThrow('Parâmetros obrigatórios ausentes');
    });
    it('2. ator ausente falha antes da transação', async () => {
        await expect(service.approve({ candidateId: 'c1', occurrenceId: 'o1', idempotencyKey: 'i' } as any)).rejects.toThrow('Contexto de usuário (ator) ausente');
    });
    it('3. candidata inexistente (CANDIDATE_NOT_FOUND)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: false });
        await expect(service.approve(defaultParams)).rejects.toThrow('Candidata não encontrada');
    });
    it('4. estado inválido (CANDIDATE_STATE_INVALID)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'rejected' }) });
        await expect(service.approve(defaultParams)).rejects.toThrow('Estado da candidata não permite aprovação');
    });
    it('5. ocorrência inexistente (OCCURRENCE_NOT_FOUND)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: false });
        await expect(service.approve(defaultParams)).rejects.toThrow('Ocorrência-base não encontrada');
    });
    it('6. canonicalIdentity inexistente (CANONICAL_IDENTITY_INVALID)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review' }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await expect(service.approve(defaultParams)).rejects.toThrow('Identidade da candidata inválida ou ausente');
    });
    it('7. aprovação idempotente sucesso', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'approved', approvalIdempotencyKey: 'idk1', resultingGlobalSongId: 'g1' }) });
        const res = await service.approve(defaultParams);
        expect(res.success).toBe(true);
        expect(res.globalSongId).toBe('g1');
        expect((res as any).alreadyApproved).toBe(true);
    });
    it('8. conflito de idempotência (IDEMPOTENCY_CONFLICT)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'approved', approvalIdempotencyKey: 'other-key', resultingGlobalSongId: 'g1' }) });
        await expect(service.approve(defaultParams)).rejects.toThrow('já foi aprovada por outra requisição');
    });
    it('9. reserva ausente (Criação de reserva)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerDocument('globalSongs_reservations/A_', { exists: false });
        await service.approve(defaultParams);
        expect(myT.sets.some(s => s.ref.id === 'A_')).toBe(true);
    });
    it('10. reserva de outra candidata (RESERVATION_COLLISION)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerDocument('globalSongs_reservations/A_', { exists: true, data: () => ({ candidateId: 'c2' }) });
        await expect(service.approve(defaultParams)).rejects.toThrow('Colisão de reserva');
    });
    it('11. duplicata exata (DUPLICATE_GLOBAL_SONG)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        vi.spyOn(matcher, 'compareSongs').mockReturnValue({ classification: 'exact_match' } as any);
        myT.registerQuery('globalSongs_query', [{ id: 'dup1', data: () => ({ normalizedTitle: 'A' }) }]);
        await expect(service.approve(defaultParams)).rejects.toThrow('Música duplicada encontrada na rechecagem');
    });
    it('12. documento local inexistente aborta (SOURCE_SONG_NOT_FOUND)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerQuery('globalLibraryCandidates/c1/occurrences', [{ id: 'occ2', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) }]);
        myT.registerDocument('songs/song1', { exists: false }); // Missing
        await expect(service.approve(defaultParams)).rejects.toThrow('Música de origem não encontrada');
    });
    it('13. organização divergente aborta (SOURCE_ORGANIZATION_MISMATCH)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerQuery('globalLibraryCandidates/c1/occurrences', [{ id: 'occ2', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) }]);
        myT.registerDocument('songs/song1', { exists: true, data: () => ({ organizationId: 'org-HACKER' }) });
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
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await service.approve(defaultParams);
    });
    it('16. criação do review log, criação da música global e update da candidata', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await service.approve(defaultParams);
        expect(myT.sets.length).toBe(3); // reservation, globalSong, reviewLog
        expect(myT.updates.length).toBe(1); // candidate status
    });
    it('17. review log já existente não é duplicado', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerDocument('globalLibraryCandidates/c1/reviewLogs/approve_idk1', { exists: true, data: () => ({}) }); // log exists!
        await service.approve(defaultParams);
        expect(myT.sets.length).toBe(2); // reservation, globalSong
    });
    it('18. duplicidade de ocorrências atualiza o local song apenas uma vez', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerDocument('songs/song1', { exists: true, data: () => ({ organizationId: 'org1' }) });
        myT.registerQuery('globalLibraryCandidates/c1/occurrences', [
            { id: 'o1', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) },
            { id: 'o2', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) }
        ]);
        await service.approve(defaultParams);
        expect(myT.updates.length).toBe(2); // 1 candidate + 1 local song
    });

    // NOVOS TESTES (25 testes independentes)
    it('19. hasCurationAccess false no serviço (Req 12.1)', async () => {
        defaultParams.decodedToken.hasCurationAccess = false;
        await expect(service.approve(defaultParams)).rejects.toThrow('Acesso de curadoria negado no serviço');
    });
    it('20. uid vazio (Req 12.2)', async () => {
        defaultParams.decodedToken.uid = '';
        await expect(service.approve(defaultParams)).rejects.toThrow('Contexto de usuário (ator) ausente');
    });
    it('21. normalizedArtists ausente (Req 12.3)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) }); // No normalizedArtists
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await service.approve(defaultParams); // Should fall back to empty array and not crash
        expect(myT.sets.some(s => s.ref.id === 'A_')).toBe(true);
    });
    it('22. normalizedArtists com tipo inválido (Req 12.4)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A', normalizedArtists: 'NotAnArray' } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });
    it('23. externalReferences ausente (Req 12.5)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await service.approve(defaultParams); // Should map to {}
        expect(myT.sets.some(s => s.data.externalReferences && typeof s.data.externalReferences === 'object')).toBe(true);
    });
    it('24. normalizedTitle apenas com espaços (Req 12.6)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: '   ' } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await expect(service.approve(defaultParams)).rejects.toThrow('título normalizado ausente');
    });
    it('25. snapshot ausente (Req 12.7)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({}) }); // No snapshot
        await expect(service.approve(defaultParams)).rejects.toThrow('Snapshot da ocorrência ausente');
    });
    it('26. snapshot sem título (Req 12.8)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: '   ' } }) });
        await expect(service.approve(defaultParams)).rejects.toThrow('Snapshot não possui título');
    });
    it('27. duplicata de alta confiança real (Req 12.9)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        vi.spyOn(matcher, 'compareSongs').mockReturnValue({ classification: 'high_confidence_match' } as any);
        myT.registerQuery('globalSongs_query', [{ id: 'dup1', data: () => ({ normalizedTitle: 'A' }) }]);
        await expect(service.approve(defaultParams)).rejects.toThrow('Música duplicada encontrada na rechecagem');
    });
    it('28. duplicata por youtubeVideoId usando compareSongs real (Req 12.10)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'Somewhat Similar', externalReferences: { youtubeVideoId: 'ABC123XYZ' } } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'Somewhat Similar' } }) });
        myT.registerQuery('globalSongs_query', [{ id: 'dup1', data: () => ({ normalizedTitle: 'Somewhat Similar', externalReferences: { youtubeVideoId: 'ABC123XYZ' } }) }]);
        // NOT mock compareSongs, let it run the real one.
        // It should identify it as high_confidence_match because youtubeVideoId matches and titles are identical.
        await expect(service.approve(defaultParams)).rejects.toThrow('Música duplicada encontrada na rechecagem');
    });
    it('29. música global com normalizedArtists em array (Req 12.11)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerQuery('globalSongs_query', [{ id: 'dup1', data: () => ({ normalizedTitle: 'A', normalizedArtists: ['Art1'] }) }]); // Real array
        vi.spyOn(matcher, 'compareSongs').mockReturnValue({ classification: 'no_match' } as any);
        await service.approve(defaultParams); // Should not crash
        expect(myT.sets.length).toBeGreaterThan(0);
    });
    it('30. source song válido e atualização correta (Req 12.12)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerQuery('globalLibraryCandidates/c1/occurrences', [{ id: 'o1', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) }]);
        myT.registerDocument('songs/song1', { exists: true, data: () => ({ organizationId: 'org1' }) });
        await service.approve(defaultParams);
        expect(myT.updates.some(u => u.ref.id === 'song1')).toBe(true);
    });
    it('31. path exato da música local (Req 12.13)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerQuery('globalLibraryCandidates/c1/occurrences', [{ id: 'o1', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) }]);
        myT.registerDocument('songs/song1', { exists: true, data: () => ({ organizationId: 'org1' }) });
        await service.approve(defaultParams);
        const songUpdate = myT.updates.find(u => u.ref.id === 'song1');
        expect(songUpdate.ref.path).toBe('songs/song1');
    });
    it('32. payload exato de originGlobalSongId (Req 12.14)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerQuery('globalLibraryCandidates/c1/occurrences', [{ id: 'o1', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) }]);
        myT.registerDocument('songs/song1', { exists: true, data: () => ({ organizationId: 'org1' }) });
        const res = await service.approve(defaultParams);
        const songUpdate = myT.updates.find(u => u.ref.id === 'song1');
        expect(songUpdate.data.originGlobalSongId).toBe(res.globalSongId);
        expect(songUpdate.data.updatedAt).toBe('SERVER_TIME');
    });
    it('33. duas ocorrências iguais geram uma leitura e um update (Req 12.15)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerQuery('globalLibraryCandidates/c1/occurrences', [
            { id: 'o1', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) },
            { id: 'o2', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) }
        ]);
        myT.registerDocument('songs/song1', { exists: true, data: () => ({ organizationId: 'org1' }) });
        await service.approve(defaultParams);
        const getCount = myT.gets.filter(g => g.id === 'song1').length;
        const updateCount = myT.updates.filter(u => u.ref.id === 'song1').length;
        expect(getCount).toBe(1);
        expect(updateCount).toBe(1);
    });
    it('34. mesmo songId com duas organizações aborta (Req 12.16)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerQuery('globalLibraryCandidates/c1/occurrences', [
            { id: 'o1', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) },
            { id: 'o2', data: () => ({ source: { organizationId: 'org2', songId: 'song1' }}) }
        ]);
        await expect(service.approve(defaultParams)).rejects.toThrow('Mesmo songId com múltiplas');
    });
    it('35. duas organizações com songIds diferentes permanecem isoladas (Req 12.17)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerQuery('globalLibraryCandidates/c1/occurrences', [
            { id: 'o1', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) },
            { id: 'o2', data: () => ({ source: { organizationId: 'org2', songId: 'song2' }}) }
        ]);
        myT.registerDocument('songs/song1', { exists: true, data: () => ({ organizationId: 'org1' }) });
        myT.registerDocument('songs/song2', { exists: true, data: () => ({ organizationId: 'org2' }) });
        await service.approve(defaultParams);
        expect(myT.updates.filter(u => u.ref.id === 'song1').length).toBe(1);
        expect(myT.updates.filter(u => u.ref.id === 'song2').length).toBe(1);
    });
    it('36. falha em leitura não produz writes (Req 12.18)', async () => {
        myT.failOnPath('globalLibraryCandidates/c1', new Error('Read crash'));
        await expect(service.approve(defaultParams)).rejects.toThrow('Erro inesperado na transação de curadoria.');
        expect(myT.sets.length).toBe(0);
        expect(myT.updates.length).toBe(0);
    });
    it('37. falha de validação não produz writes (Req 12.19)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({}) }); // Causes OCCURRENCE_SNAPSHOT_INVALID
        await expect(service.approve(defaultParams)).rejects.toThrow('Snapshot');
        expect(myT.sets.length).toBe(0);
        expect(myT.updates.length).toBe(0);
    });
    it('38. falha transacional vira TRANSACTION_FAILED (Req 12.20)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        // Simular falha nativa na escrita
        mockDb.runTransaction = async () => { throw new Error('DB Crash'); };
        await expect(service.approve(defaultParams)).rejects.toThrow('Erro inesperado na transação');
    });
    it('39. review log contém ator e procedência (Req 12.21)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' }, source: { organizationId: 'org1', songId: 'song1' } }) });
        await service.approve(defaultParams);
        const log = myT.sets.find(s => s.ref.id.includes('approve_idk1'));
        expect(log.data.actorId).toBe('u1');
        expect(log.data.metadata.sourceOrganizationId).toBe('org1');
        expect(log.data.metadata.sourceSongId).toBe('song1');
    });
    it('40. música global não recebe campos internos proibidos (Req 12.22)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T', _internalField: 'secret' } }) });
        await service.approve(defaultParams);
        const gs = myT.sets.find(s => !s.ref.id.includes('_'));
        expect(gs.data._internalField).toBeUndefined();
    });
    it('41. reserva contém candidateId correto (Req 12.23)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await service.approve(defaultParams);
        const rsv = myT.sets.find(s => s.ref.id === 'A_');
        expect(rsv.data.candidateId).toBe('c1');
    });
    it('42. candidato recebe chave de idempotência (Req 12.24)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        await service.approve(defaultParams);
        const cUpdate = myT.updates.find(u => u.ref.id === 'c1');
        expect(cUpdate.data.approvalIdempotencyKey).toBe('idk1');
    });
    it('43. nenhuma leitura acontece após escrita em fluxo com músicas locais e log existente (Req 12.25)', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => stdCandidate });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => stdOccurrence });
        myT.registerQuery('globalLibraryCandidates/c1/occurrences', [{ id: 'o1', data: () => ({ source: { organizationId: 'org1', songId: 'song1' }}) }]);
        myT.registerDocument('songs/song1', { exists: true, data: () => ({ organizationId: 'org1' }) });
        myT.registerDocument('globalLibraryCandidates/c1/reviewLogs/approve_idk1', { exists: true, data: () => ({}) });
        
        await service.approve(defaultParams);
        // If there was a read after write, myT.get would throw FIRESTORE_READ_AFTER_WRITE_FORBIDDEN.
        expect(myT.sets.length).toBe(2);
    });

    it('12.1. uid numérico', async () => {
        await expect(service.approve({
            ...defaultParams,
            decodedToken: { uid: 123 as any, hasCurationAccess: true }
        })).rejects.toMatchObject({ code: 'ACTOR_CONTEXT_MISSING' });
    });

    it('12.2. uid objeto', async () => {
        await expect(service.approve({
            ...defaultParams,
            decodedToken: { uid: {} as any, hasCurationAccess: true }
        })).rejects.toMatchObject({ code: 'ACTOR_CONTEXT_MISSING' });
    });

    it('12.3. uid somente com espaços', async () => {
        await expect(service.approve({
            ...defaultParams,
            decodedToken: { uid: '   ', hasCurationAccess: true }
        })).rejects.toMatchObject({ code: 'ACTOR_CONTEXT_MISSING' });
    });

    it('12.4. normalizedTitle numérico', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 123 } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    it('12.5. normalizedTitle objeto', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: {} } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    it('12.6. contentFingerprint objeto', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A', contentFingerprint: {} } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    it('12.7. lyricsFingerprint array', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A', lyricsFingerprint: [] } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    it('12.8. snapshot.title numérico', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 123 } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'OCCURRENCE_SNAPSHOT_INVALID' });
    });

    it('12.9. source.organizationId numérico', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' }, source: { organizationId: 123 } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'OCCURRENCE_SNAPSHOT_INVALID' });
    });

    it('12.10. source.songId objeto', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A' } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' }, source: { organizationId: 'org1', songId: {} } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'OCCURRENCE_SNAPSHOT_INVALID' });
    });

    it('12.11. externalReferences array', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A', externalReferences: [] } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });

    it('12.12. normalizedArtists não array', async () => {
        myT.registerDocument('globalLibraryCandidates/c1', { exists: true, data: () => ({ status: 'pending_review', canonicalIdentity: { normalizedTitle: 'A', normalizedArtists: 'artist' } }) });
        myT.registerDocument('globalLibraryCandidates/c1/occurrences/o1', { exists: true, data: () => ({ snapshot: { title: 'T' } }) });
        await expect(service.approve(defaultParams)).rejects.toMatchObject({ code: 'CANONICAL_IDENTITY_INVALID' });
    });
});
