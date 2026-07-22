import { CurationApprovalService, CurationError } from './curationApprovalService.js';
import * as crypto from 'crypto';

function safeLogIdentifier(value: unknown, maxLength = 200): string | null {
    if (typeof value !== "string") return null;

    const trimmed = value.trim();

    if (
        !trimmed ||
        trimmed.length > maxLength ||
        /[\x00-\x1F\x7F]/.test(trimmed)
    ) {
        return null;
    }

    return trimmed;
}

function createSafeCorrelationId(value: unknown): string {
    const safeValue = safeLogIdentifier(value);

    if (safeValue) {
        return crypto
            .createHash("sha256")
            .update(safeValue)
            .digest("hex");
    }

    return crypto.randomUUID();
}

function normalizedOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function createCurationApprovalHttpHandler(deps: { db: any, admin: any, logger: any }) {
    const service = new CurationApprovalService(deps);
    return async (req: any, res: any) => {
        try {
            const { candidateId, occurrenceId, idempotencyKey } = req.body || {};

            const safeCandidateId = safeLogIdentifier(candidateId);
            const safeOccurrenceId = safeLogIdentifier(occurrenceId);
            const safeIdempotencyKey = safeLogIdentifier(idempotencyKey);

            if (!safeCandidateId || !safeOccurrenceId || !safeIdempotencyKey) {
                return res.status(400).json({
                    error: "Parâmetros obrigatórios ausentes ou inválidos.",
                    code: "VALIDATION_ERROR"
                });
            }

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
                candidateId: safeCandidateId,
                occurrenceId: safeOccurrenceId,
                idempotencyKey: safeIdempotencyKey,
                decodedToken
            });
            
            return res.status(200).json(result);
        } catch (error: any) {
            const safeCandidate = safeLogIdentifier(req.body?.candidateId);
            const safeOccurrence = safeLogIdentifier(req.body?.occurrenceId);
            const safeCorrelation = createSafeCorrelationId(req.body?.idempotencyKey);

            if (error instanceof CurationError) {
                const logPayload: any = {
                    code: error.code,
                    candidateId: safeCandidate,
                    occurrenceId: safeOccurrence
                };
                if (error.code === 'TRANSACTION_FAILED') {
                    logPayload.message = "Falha inesperada na transação de curadoria";
                    logPayload.correlationId = safeCorrelation;
                } else {
                    logPayload.safeMessage = error.safeMessage;
                    logPayload.correlationId = safeCorrelation;
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

            deps.logger.error("Curation approval HTTP error", { 
                code: "TRANSACTION_FAILED",
                message: "Falha inesperada na transação de curadoria",
                candidateId: safeCandidate,
                occurrenceId: safeOccurrence,
                correlationId: safeCorrelation
            });

            return res.status(500).json({ error: "Erro inesperado na transação de curadoria.", code: "TRANSACTION_FAILED" });
        }
    };
}
