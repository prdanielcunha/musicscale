import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

function extractBlock(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('P4 curation candidate details single-fetch contract', () => {
  const pageSource = readSource('pages/CurationPage.tsx');
  const modalSource = readSource('components/curation/CandidateDetailsModal.tsx');

  it('keeps CurationPage.openDetails free of candidate detail reads', () => {
    const openDetails = extractBlock(pageSource, 'const openDetails', 'const closeDetails');

    expect(openDetails).toContain('setSelectedCandidateId(id)');
    expect(openDetails).not.toContain('fetchCandidateDetails');
    expect(openDetails).not.toContain('fetchOccurrences');
    expect(openDetails).not.toContain('fetchMatches');
    expect(pageSource).not.toContain('detailsLoading');
    expect(pageSource).not.toContain('candidateDetails');
    expect(pageSource).not.toContain('setOccurrences');
    expect(pageSource).not.toContain('setMatches');
  });

  it('keeps CandidateDetailsModal as the single owner of detail fetching', () => {
    expect(modalSource).toContain('curationService.fetchCandidateDetails(candidateId)');
    expect(modalSource).toContain('curationService.fetchOccurrences(candidateId)');
    expect(modalSource).toContain('curationService.fetchMatches(candidateId)');
    expect(modalSource).toContain('curationService.fetchReviewLogs(candidateId)');
  });

  it('opens the modal through selectedCandidateId and passes it as candidateId', () => {
    expect(pageSource).toContain('const [selectedCandidateId, setSelectedCandidateId]');
    expect(pageSource).toContain('{selectedCandidateId && (');
    expect(pageSource).toContain('candidateId={selectedCandidateId}');
  });
});
