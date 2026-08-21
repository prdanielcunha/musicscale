import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bulkImportCandidates } from '../../services/server/bulkImportService.js';

function createDb(candidate: Record<string, any>) {
  const candidateUpdates: any[] = [];
  const globalSets: any[] = [];
  const auditLogs: any[] = [];

  const db: any = {
    collection(name: string) {
      if (name === 'globalLibraryCandidates') {
        return {
          doc(id: string) {
            return {
              id,
              async get() {
                return {
                  exists: id === 'candidate-1',
                  data: () => candidate
                };
              },
              async update(payload: any) {
                candidateUpdates.push(payload);
              }
            };
          }
        };
      }

      if (name === 'globalSongs') {
        return {
          where(field: string, operator: string, value: string) {
            if (field !== 'normalizedTitle' || operator !== '==') {
              throw new Error(`Unexpected globalSongs query: ${field} ${operator}`);
            }
            return {
              async get() {
                return { empty: true, docs: [] };
              }
            };
          },
          doc() {
            return {
              id: 'created-global',
              async set(payload: any) {
                globalSets.push(payload);
              }
            };
          }
        };
      }

      if (name === 'curationAuditLogs') {
        return {
          async add(payload: any) {
            auditLogs.push(payload);
          }
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    }
  };

  return { db, candidateUpdates, globalSets, auditLogs };
}

describe('P4 bulk import canonical search indexing', () => {
  it('persists the canonical global search fields for a newly imported song', async () => {
    const candidate = {
      title: 'Águas de Março',
      normalizedTitle: 'aguas de marco',
      artist: 'JOÃO',
      normalizedArtist: 'joao',
      key: 'E',
      originalKey: 'F#',
      lyrics: 'Calvário e fé',
      chords: 'C G\nAmazing grace',
      status: 'pending_review',
      classification: 'likely_unique'
    };
    const { db, globalSets } = createDb(candidate);

    const result = await bulkImportCandidates(db, ['candidate-1'], 'curator-1');

    expect(result[0]).toMatchObject({
      status: 'imported',
      globalSongId: 'created-global'
    });
    expect(globalSets).toHaveLength(1);

    const saved = globalSets[0];
    expect(saved).toMatchObject({
      title: 'Águas de Março',
      artist: 'JOÃO',
      status: 'active',
      searchVersion: 3
    });
    expect(saved.searchTokens).toEqual(expect.arrayContaining([
      'aguas', 'de', 'marco', 'joao', 'e', 'f#', 'calvario'
    ]));
    expect(saved.searchContentTokens).toEqual([
      'calvario', 'e', 'fe', 'amazing', 'grace'
    ]);
    expect(saved.searchTitlePrefixes).toEqual(expect.arrayContaining([
      'agu', 'agua', 'aguas', 'mar', 'marc', 'marco'
    ]));
    expect(saved.searchArtistPrefixes).toEqual(expect.arrayContaining(['joa', 'joao']));
    expect(saved.searchTitleGrams).toEqual(expect.arrayContaining([
      'agu', 'gua', 'uas', 'mar', 'arc', 'rco'
    ]));
    expect(saved.searchArtistGrams).toEqual(expect.arrayContaining(['joa', 'oao']));
    expect(saved.searchKeyTokens).toEqual(expect.arrayContaining(['E', 'F#']));
  });

  it('reuses the canonical helper instead of duplicating search-index logic', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'services/server/bulkImportService.ts'),
      'utf8'
    );

    expect(source).toContain("import { buildGlobalSongSearchFields } from '../../utils/searchEngine.js'");
    expect(source).toContain('Object.assign(payload, buildGlobalSongSearchFields(payload));');
    expect(source).not.toContain('payload.searchTokens =');
    expect(source).not.toContain('payload.searchContentTokens =');
    expect(source).not.toContain('payload.searchTitlePrefixes =');
    expect(source).not.toContain('payload.searchArtistPrefixes =');
    expect(source).not.toContain('payload.searchTitleGrams =');
    expect(source).not.toContain('payload.searchArtistGrams =');
    expect(source).not.toContain('payload.searchKeyTokens =');
  });
});
