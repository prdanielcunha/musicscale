import { CurationApprovalService, CurationError } from './curationApprovalService.js';

export function createCurationApprovalHttpHandler(deps: { db: any, admin: any, logger: any }) {
    const service = new CurationApprovalService(deps);
    return async (req: any, res: any) => {
        try {
            const { candidateId, occurrenceId, idempotencyKey } = req.body;
            const decodedToken = req.ecosystemContext;
            
            if (!decodedToken || !decodedToken.hasCurationAccess) {
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
            deps.logger.error("Curation approval HTTP error", { 
                code: error instanceof CurationError ? error.code : "TRANSACTION_FAILED",
                message: error.message,
                candidateId: req.body?.candidateId,
                occurrenceId: req.body?.occurrenceId
            });
            
            if (error instanceof CurationError) {
                const responsePayload: any = {
                    error: error.safeMessage,
                    code: error.code
                };
                if (error.duplicateGlobalSongId) {
                    responsePayload.duplicateGlobalSongId = error.duplicateGlobalSongId;
                }
                return res.status(error.httpStatus).json(responsePayload);
            }
            return res.status(500).json({ error: "Erro inesperado na aprovação.", code: "TRANSACTION_FAILED" });
        }
    };
}
