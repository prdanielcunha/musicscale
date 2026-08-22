import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('P4 backup global-library search-index writer contract', () => {
  it('delegates both global creates and merge-updates to the canonical search builder', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'services/backupService.ts'),
      'utf8',
    );

    expect(source).toContain('import { buildGlobalSongSearchFields } from "../utils/searchEngine";');
    expect(source).toContain('const combinedData = { ...existing.data, ...s };');
    expect(source).toContain('...buildGlobalSongSearchFields(combinedData),');
    expect(source).toContain('...buildGlobalSongSearchFields(s),');
    expect(source).not.toContain('searchContentTokens:');
  });

  it('retains existing data when deriving search fields for merge-updates', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'services/backupService.ts'),
      'utf8',
    );

    expect(source).toContain('new Map<string, { id: string; data: any }>()');
    expect(source).toContain('{ id: document.id, data },');
    expect(source).toContain('const existing = existingGlobalSongs.get(key);');
  });
});
