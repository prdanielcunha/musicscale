export interface BulkImportEligibleCandidate {
  status?: string | null;
  classification?: string | null;
}

export const BULK_IMPORT_ELIGIBLE_STATUS = 'pending_review';
export const BULK_IMPORT_ELIGIBLE_CLASSIFICATION = 'likely_unique';

export function isBulkImportEligibleCandidate(candidate: BulkImportEligibleCandidate): boolean {
  return candidate.status === BULK_IMPORT_ELIGIBLE_STATUS
    && candidate.classification === BULK_IMPORT_ELIGIBLE_CLASSIFICATION;
}
