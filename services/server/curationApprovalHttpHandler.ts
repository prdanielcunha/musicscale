import { CurationApprovalService, CurationError } from './curationApprovalService.js';

export function createCurationApprovalHttpHandler(deps: { db: any, admin: any, logger: any }) {
    const service = new CurationApprovalService(deps);

    return async (req: any, res: any) => {
        try {
            const { candidateId, occurrenceId, idempotencyKey } = req.body;
            const decodedToken = req.ecosystemContext;

            if (!decodedToken || !decodedToken.hasCurationAccess) {
                return res.status(403).json({ 
                    error: "CURATION_ACCESS_DENIED", 
                    message: "User does not have curation access" 
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
            deps.logger.error("Curation approval HTTP error", { error: error.message, stack: error.stack });
            
            if (error instanceof CurationError) {
                return res.status(error.httpStatus).json({
                    error: error.code,
                    message: error.safeMessage,
                    duplicateGlobalSongId: error.duplicateGlobalSongId
                });
            }

            return res.status(500).json({ error: "TRANSACTION_FAILED", message: "Erro inesperado na aprovação." });
        }
    };
}
