import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bulkImportCandidates, preVerifyCandidates } from '../../services/server/bulkImportService.js';

type GlobalSongFixture = {
  id: string;
  title: string;
  artist: string;
  normalizedTitle: string;
  normalizedArtist: string;
};

function createDb(candidate: Record<string, any>, globalSongs: GlobalSongFixture[]) {
  const candidateUpdates: any[] = [];
  const globalSets: any[] = [];
  const auditLogs: any[] = [];
  const queriedTitles: string[] = [];

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
            queriedTitles.push(value);
            const docs = globalSongs
              .filter((song) => song.normalizedTitle === value)
              .map((song) => ({
                id: song.id,
                data: () => song
              }));

            return {
              async get() {
                return {
                  empty: docs.length === 0,
                  docs
                };
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

  return { db, candidateUpdates, globalSets, auditLogs, queriedTitles };
}

describe('P4 bulk import title + artist deduplication', () => {
  it('treats normalized title + artist as the same song across pre-verify and import', async () => {
    const candidate = {
      title: '  Coração de Adorador  ',
      artist: '  JOÃO  ',
      normalizedTitle: 'coracao de adorador',
      normalizedArtist: 'joao',
      status: 'pending_review',
      classification: 'likely_unique'
    };
    const globalSongs = [{
      id: 'global-1',
      title: 'Coração de Adorador',
      artist: 'João',
      normalizedTitle: 'coracao de adorador',
      normalizedArtist: 'joao'
    }];
    const { db, candidateUpdates, globalSets } = createDb(candidate, globalSongs);

    const verification = await preVerifyCandidates(db, 'selected', ['candidate-1']);
    expect(verification[0]).toMatchObject({
      state: 'already_exists',
      matchedGlobalSong: { id: 'global-1' }
    });

    const imported = await bulkImportCandidates(db, ['candidate-1'], 'curator-1');
    expect(imported[0]).toMatchObject({ status: 'already_exists' });
    expect(candidateUpdates[0]).toMatchObject({
      classification: 'matched_existing',
      'analysisSummary.matchedGlobalSongId': 'global-1'
    });
    expect(globalSets).toHaveLength(0);
  });

  it('does not block pre-verification when only the normalized title matches', async () => {
    const candidate = {
      title: 'Graça',
      artist: 'Artista B',
      status: 'pending_review',
      classification: 'likely_unique'
    };
    const globalSongs = [{
      id: 'global-a',
      title: 'Graça',
      artist: 'Artista A',
      normalizedTitle: 'graca',
      normalizedArtist: 'artista a'
    }];
    const { db } = createDb(candidate, globalSongs);

    const verification = await preVerifyCandidates(db, 'selected', ['candidate-1']);
    expect(verification[0]).toMatchObject({ state: 'ready_to_import' });
  });

  it('creates a new global song when the same title belongs to a different artist', async () => {
    const candidate = {
      title: 'Graça',
      artist: 'Artista B',
      normalizedTitle: 'graca',
      normalizedArtist: 'artista b',
      status: 'pending_review',
      classification: 'likely_unique'
    };
    const globalSongs = [{
      id: 'global-a',
      title: 'Graça',
      artist: 'Artista A',
      normalizedTitle: 'graca',
      normalizedArtist: 'artista a'
    }];
    const { db, candidateUpdates, globalSets, auditLogs } = createDb(candidate, globalSongs);

    const imported = await bulkImportCandidates(db, ['candidate-1'], 'curator-1');
    expect(imported[0]).toMatchObject({
      status: 'imported',
      globalSongId: 'created-global'
    });
    expect(globalSets).toHaveLength(1);
    expect(globalSets[0]).toMatchObject({
      title: 'Graça',
      artist: 'Artista B',
      status: 'active'
    });
    expect(candidateUpdates[0]).toMatchObject({
      status: 'approved',
      approvedGlobalSongId: 'created-global'
    });
    expect(auditLogs).toHaveLength(1);
  });

  it('does not reintroduce title-only limit(1) deduplication', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'services/server/bulkImportService.ts'),
      'utf8'
    );

    expect(source).not.toContain('.limit(1)');
    expect(source).toContain("where('normalizedTitle', '==', normalizedTitle)");
    expect(source).toContain('existingNormalizedArtist === normalizedArtist');
  });
});
