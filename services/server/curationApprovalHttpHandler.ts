import { CurationApprovalService, CurationError } from './curationApprovalService.js';
import * as crypto from 'crypto';

function normalizedOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function createCurationApprovalHttpHandler(deps: { db: any, admin: any, logger: any }) {
    const service = new CurationApprovalService(deps);

    return async (req: any, res: any) => {
        try {
            const { candidateId, occurrenceId, idempotencyKey } = req.body;
            const decodedToken = req.ecosystemContext;

            if (!decodedToken || !normalizedOptionalString(decodedToken.uid)) {
                return res.status(401).json({
                    error: "Contexto de usuário ausente ou inválido.",
                    code: "ACTOR_CONTEXT_MISSING"
                });
            }

            if (decodedToken.hasCurationAccess !== true) {
                return res.status(403).json({ 
                    error: "Acesso de curadoria negado.",
                    code: "CURATION_ACCESS_DENIED"
                });
            }
            
            const result = await service.approve({
                candidateId,
                occurrenceId,
                idempotencyKey,
                decodedToken
            });
            
            return res.status(200).json(result);
        } catch (error: any) {
            if (error instanceof CurationError) {
                const logPayload: any = {
                    code: error.code,
                    candidateId: req.body?.candidateId,
                    occurrenceId: req.body?.occurrenceId
                };
                if (error.code === 'TRANSACTION_FAILED') {
                    logPayload.message = "Falha inesperada na transação de curadoria";
                    logPayload.correlationId = req.body?.idempotencyKey ? crypto.createHash('sha256').update(req.body.idempotencyKey).digest('hex') : 'unknown';
                } else {
                    logPayload.safeMessage = error.safeMessage;
                    if (req.body?.idempotencyKey) {
                        logPayload.correlationId = crypto.createHash('sha256').update(req.body.idempotencyKey).digest('hex');
                    }
                }
                deps.logger.error("Curation approval HTTP error", logPayload);
                
                const responsePayload: any = {
                    error: error.safeMessage,
                    code: error.code
                };
                if (error.duplicateGlobalSongId) {
                    responsePayload.duplicateGlobalSongId = error.duplicateGlobalSongId;
                }
                return res.status(error.httpStatus).json(responsePayload);
            }

            const correlationId = crypto.randomUUID?.() || req.body?.idempotencyKey || 'unknown';
            deps.logger.error("Curation approval HTTP error", { 
                code: "TRANSACTION_FAILED",
                message: "Falha inesperada na transação de curadoria",
                candidateId: req.body?.candidateId,
                occurrenceId: req.body?.occurrenceId,
                correlationId
            });

            return res.status(500).json({ error: "Erro inesperado na transação de curadoria.", code: "TRANSACTION_FAILED" });
        }
    };
}
