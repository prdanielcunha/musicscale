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

describe('P4.7 global library metrics aggregation contract', () => {
  const source = readSource('services/globalLibraryService.ts');
  const metricsBlock = extractBlock(
    source,
    'export const getGlobalLibraryMetrics',
    'export const submitSong'
  );

  it('uses Firestore aggregate counts instead of scanning globalSongs', () => {
    expect(source).toContain('getCountFromServer');
    expect((metricsBlock.match(/getCountFromServer/g) || []).length).toBe(4);
    expect(metricsBlock).toContain("where('status', '==', 'active')");
    expect(metricsBlock).toContain("where('isComplete', '==', true)");
    expect(metricsBlock).toContain("where('hasChords', '==', true)");
    expect(metricsBlock).toContain("where('hasLyrics', '==', true)");
    expect(metricsBlock).not.toContain('getDocs(');
    expect(metricsBlock).not.toContain('.forEach(');
    expect(metricsBlock).not.toContain('data.chords');
    expect(metricsBlock).not.toContain('data.lyrics');
  });

  it('runs the four count aggregations in parallel', () => {
    expect(metricsBlock).toContain('await Promise.all([');
  });
});
