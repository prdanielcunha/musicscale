import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BULK_IMPORT_ELIGIBLE_CLASSIFICATION,
  BULK_IMPORT_ELIGIBLE_STATUS,
  isBulkImportEligibleCandidate,
} from '../../utils/curation/bulkImportEligibility.js';

describe('curation bulk import eligibility', () => {
  it('allows only pending_review + likely_unique candidates', () => {
    expect(isBulkImportEligibleCandidate({
      status: BULK_IMPORT_ELIGIBLE_STATUS,
      classification: BULK_IMPORT_ELIGIBLE_CLASSIFICATION,
    })).toBe(true);

    for (const status of ['approved', 'linked', 'rejected', 'processing_failed', 'unresolved']) {
      expect(isBulkImportEligibleCandidate({
        status,
        classification: 'likely_unique',
      })).toBe(false);
    }

    expect(isBulkImportEligibleCandidate({
      status: 'pending_review',
      classification: 'possible_duplicate',
    })).toBe(false);
  });

  it('keeps every CurationPage selection path on the canonical eligibility rule', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'pages/CurationPage.tsx'),
      'utf8',
    );

    expect(source).toContain('res.candidates.filter(isBulkImportEligibleCandidate)');
    expect(source).toContain('candidates.filter(isBulkImportEligibleCandidate)');
    expect(source).toContain("filter === 'likely_unique' && isBulkImportEligibleCandidate(candidate)");
    expect(source).toContain('handleCandidateResolved(id,');
    expect(source).not.toContain('filters.status = BULK_IMPORT_ELIGIBLE_STATUS');
  });
});
