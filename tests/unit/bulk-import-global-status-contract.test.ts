import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('P4 bulk import global status contract', () => {
  const bulkSource = readSource('services/server/bulkImportService.ts');
  const librarySource = readSource('services/globalLibraryService.ts');
  const typesSource = readSource('types.ts');

  it('uses the canonical active status when bulk import creates a global song', () => {
    expect(bulkSource).toContain("payload.status = 'active';");
    expect(bulkSource).not.toContain("payload.status = 'published';");
  });

  it('matches the GlobalSong status vocabulary', () => {
    expect(typesSource).toContain("status: 'active' | 'draft';");
    expect(librarySource).toContain("updateGlobalSongStatus = async (songId: string, status: 'active' | 'draft'");
  });

  it('keeps newly imported songs visible to the Living Library active-only read contract', () => {
    expect(librarySource).toContain("uniqueCandidates.filter(s => s.status === 'active')");
    expect(librarySource).toContain("allFetched.filter(s => s.status === 'active').slice(0, pageSize)");
    expect(librarySource).toContain("status: 'active',");
  });
});
