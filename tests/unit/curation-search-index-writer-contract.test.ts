import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildGlobalSongSearchFields, GLOBAL_SEARCH_VERSION } from '../../utils/searchEngine';

describe('P4 curation approval search-index writer contract', () => {
  it('delegates new global song indexing to the canonical search builder', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'services/server/curationApprovalService.ts'),
      'utf8',
    );

    expect(source).toContain("import { buildGlobalSongSearchFields } from '../../utils/searchEngine.js';");
    expect(source).toContain('...buildGlobalSongSearchFields(newGlobalSong),');
    expect(source).toContain('t.set(globalSongRef, indexedGlobalSong);');
    expect(source).not.toContain('newGlobalSong.searchContentTokens');
  });

  it('the delegated builder supplies v3 content tokens without raw chord symbols', () => {
    const fields = buildGlobalSongSearchFields({
      title: 'Porque Ele Vive',
      artist: 'Artista',
      lyrics: 'Calvário e fé',
      chords: 'C G\nPorque Ele vive',
    });

    expect(GLOBAL_SEARCH_VERSION).toBe(3);
    expect(fields.searchVersion).toBe(3);
    expect(fields.searchContentTokens).toEqual([
      'calvario',
      'e',
      'fe',
      'porque',
      'ele',
      'vive',
    ]);
    expect(fields.searchContentTokens).not.toContain('c');
    expect(fields.searchContentTokens).not.toContain('g');
  });
});
