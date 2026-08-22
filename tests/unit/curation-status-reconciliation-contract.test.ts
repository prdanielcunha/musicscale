import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('P4 curation status reconciliation contract', () => {
  const pageSource = readSource('pages/CurationPage.tsx');
  const serviceSource = readSource('services/curationService.ts');
  const modalSource = readSource('components/curation/CandidateDetailsModal.tsx');

  it('normalizes the canonical candidate identity as candidateId', () => {
    expect(serviceSource).toContain('candidateId: string;');
    expect(serviceSource).toContain('candidateId: data.id || data.candidateId,');
  });

  it('returns the canonical candidateId from all successful review actions', () => {
    expect(modalSource).toContain('onApproveSuccess(candidateId!);');
    expect(modalSource).toContain('onLinkSuccess(candidateId!);');
    expect(modalSource).toContain('onRejectSuccess(candidateId!);');
  });

  it('reconciles approve, link, and reject cards by candidateId', () => {
    expect(pageSource).toContain("c.candidateId === id ? { ...c, status: 'approved' } : c");
    expect(pageSource).toContain("c.candidateId === id ? { ...c, status: 'linked' } : c");
    expect(pageSource).toContain("c.candidateId === id ? { ...c, status: 'rejected' } : c");
    expect(pageSource).not.toMatch(/c\.id === id \? \{ \.\.\.c, status: '(approved|linked|rejected)' \}/);
  });
});
