import { describe, expect, it } from 'vitest';

import { validateReviewerHighStatuses } from '../../scripts/verify-reviewer-high-attestation.mjs';

const expected = {
  sha: 'b2211c623a9313d967cf910fe2bfac5efea9fb1e',
  authorizedSha: 'b2211c623a9313d967cf910fe2bfac5efea9fb1e',
  repository: 'prdanielcunha/musicscale',
  workflowPath: '.github/workflows/controlled-global-song-metrics-backfill-executor.yml',
  workflowRef: 'refs/heads/production',
};

function status(attestation = {}) {
  const target = new URL(`https://github.com/${expected.repository}/commit/${expected.sha}`);
  for (const [field, value] of Object.entries({
    schema: 'musicscale.reviewer-high.v1',
    certification_report: 'APPROVED',
    reviewed_sha: expected.sha,
    authorized_sha: expected.authorizedSha,
    workflow_path: expected.workflowPath,
    workflow_ref: expected.workflowRef,
    ...attestation,
  })) target.searchParams.set(field, value);

  return {
    id: 123,
    context: 'reviewer-high',
    state: 'success',
    description: 'reviewer-high: APPROVED; attestation=target-url',
    target_url: target.toString(),
  };
}

describe('reviewer-high attestation', () => {
  it('accepts exactly one successful reviewer-high status bound to the execution', () => {
    expect(validateReviewerHighStatuses([status()], expected).statusId).toBe(123);
  });

  it('rejects an attestation that was reviewed for another SHA', () => {
    expect(() => validateReviewerHighStatuses([status({ reviewed_sha: 'a'.repeat(40) })], expected))
      .toThrow(/REVIEWER_HIGH_REVIEWED_SHA_MISMATCH/);
  });

  it('rejects missing, competing, or non-success reviewer-high statuses', () => {
    expect(() => validateReviewerHighStatuses([], expected)).toThrow(/REVIEWER_HIGH_CANONICAL_STATUS_NOT_UNIQUE/);
    expect(() => validateReviewerHighStatuses([status(), status()], expected)).toThrow(/REVIEWER_HIGH_CANONICAL_STATUS_NOT_UNIQUE/);
    expect(() => validateReviewerHighStatuses([{ ...status(), state: 'failure' }], expected))
      .toThrow(/REVIEWER_HIGH_CANONICAL_STATUS_NOT_UNIQUE/);
  });

  it('rejects a status whose target does not bind the executor workflow ref', () => {
    expect(() => validateReviewerHighStatuses([status({ workflow_ref: 'refs/heads/main' })], expected))
      .toThrow(/REVIEWER_HIGH_WORKFLOW_REF_MISMATCH/);
  });
});
