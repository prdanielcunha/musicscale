import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bulkImportCandidates } from '../../services/server/bulkImportService.js';

function createDb(candidate: Record<string, any>) {
  const candidateUpdates: any[] = [];
  const globalSets: Array<{ id: string; payload: any }> = [];
  const auditLogs: any[] = [];
  const storedGlobalSongs = new Map<string, Record<string, any>>();

  const candidateRef = {
    id: 'candidate-1',
    async get() {
      return { exists: true, data: () => candidate };
    },
    async update(payload: any) {
      candidateUpdates.push(payload);
      Object.assign(candidate, payload);
    }
  };

  const db: any = {
    collection(name: string) {
      if (name === 'globalLibraryCandidates') {
        return {
          doc(id: string) {
            if (id !== 'candidate-1') throw new Error(`Unexpected candidate: ${id}`);
            return candidateRef;
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
                const docs = Array.from(storedGlobalSongs.entries())
                  .filter(([, song]) => song.normalizedTitle === value)
                  .map(([id, song]) => ({ id, data: () => song }));
                return { empty: docs.length === 0, docs };
              }
            };
          },
          doc(id?: string) {
            if (!id) throw new Error('Expected deterministic global song id');
            return {
              id,
              async get() {
                const value = storedGlobalSongs.get(id);
                return { exists: Boolean(value), data: () => value };
              },
              async set(payload: any) {
                globalSets.push({ id, payload });
                storedGlobalSongs.set(id, { ...payload });
              }
            };
          }
        };
      }

      if (name === 'curationAuditLogs') {
        return {
          doc() {
            return {
              id: 'audit-1',
              async set(payload: any) {
                auditLogs.push(payload);
              }
            };
          }
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
    async runTransaction(callback: (transaction: any) => Promise<any>) {
      return callback({
        get(target: any) {
          return target.get();
        },
        update(ref: any, payload: any) {
          return ref.update(payload);
        },
        set(ref: any, payload: any) {
          return ref.set(payload);
        }
      });
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

    expect(result[0]).toMatchObject({ status: 'imported' });
    expect(result[0].globalSongId).toMatch(/^bulk_[a-f0-9]{64}$/);
    expect(globalSets).toHaveLength(1);
    expect(globalSets[0].id).toBe(result[0].globalSongId);

    const saved = globalSets[0].payload;
    expect(saved).toMatchObject({
      title: 'Águas de Março',
      artist: 'JOÃO',
      normalizedTitle: 'aguas de marco',
      normalizedArtist: 'joao',
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
