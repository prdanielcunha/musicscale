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
    expect(pageSource).toContain('const handleCandidateResolved =');
    expect(pageSource).toContain('setSelectedCandidateIds(prev => prev.filter(candidateId => candidateId !== id))');
    expect(pageSource).toContain('prev.filter(candidate => candidate.candidateId !== id)');
    expect(pageSource).toContain('candidate.candidateId === id ? { ...candidate, status } : candidate');
    expect(pageSource).toContain("handleCandidateResolved(id, 'approved')");
    expect(pageSource).toContain("handleCandidateResolved(id, 'linked')");
    expect(pageSource).toContain("handleCandidateResolved(id, 'rejected')");
    expect(pageSource).not.toMatch(/candidate\.id === id \? \{ \.\.\.candidate, status/);
  });
});
