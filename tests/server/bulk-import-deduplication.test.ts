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
  [key: string]: any;
};

function createDbWithCandidates(
  candidates: Record<string, Record<string, any>>,
  globalSongs: GlobalSongFixture[]
) {
  const candidateUpdates: any[] = [];
  const globalSets: Array<{ id: string; payload: any }> = [];
  const auditLogs: any[] = [];
  const queriedTitles: string[] = [];
  const storedGlobalSongs = new Map<string, Record<string, any>>(
    globalSongs.map((song) => [song.id, { ...song }])
  );
  let auditCounter = 0;
  let transactionTail: Promise<void> = Promise.resolve();

  const candidateRef = (id: string) => ({
    id,
    async get() {
      const candidate = candidates[id];
      return {
        exists: Boolean(candidate),
        data: () => candidate
      };
    },
    async update(payload: any) {
      candidateUpdates.push({ id, payload });
      if (candidates[id]) Object.assign(candidates[id], payload);
    }
  });

  const globalRef = (id: string) => ({
    id,
    async get() {
      const value = storedGlobalSongs.get(id);
      return {
        exists: Boolean(value),
        id,
        data: () => value
      };
    },
    async set(payload: any) {
      globalSets.push({ id, payload });
      storedGlobalSongs.set(id, { ...payload });
    }
  });

  const queryByNormalizedTitle = (value: string) => ({
    async get() {
      queriedTitles.push(value);
      const docs = Array.from(storedGlobalSongs.entries())
        .filter(([, song]) => song.normalizedTitle === value)
        .map(([id, song]) => ({ id, data: () => song }));
      return { empty: docs.length === 0, docs };
    }
  });

  const auditRef = () => {
    const id = `audit-${++auditCounter}`;
    return {
      id,
      async set(payload: any) {
        auditLogs.push(payload);
      }
    };
  };

  const db: any = {
    collection(name: string) {
      if (name === 'globalLibraryCandidates') {
        return { doc: candidateRef };
      }

      if (name === 'globalSongs') {
        return {
          where(field: string, operator: string, value: string) {
            if (field !== 'normalizedTitle' || operator !== '==') {
              throw new Error(`Unexpected globalSongs query: ${field} ${operator}`);
            }
            return queryByNormalizedTitle(value);
          },
          doc(id?: string) {
            if (!id) throw new Error('Bulk import must use a deterministic global song id');
            return globalRef(id);
          }
        };
      }

      if (name === 'curationAuditLogs') {
        return {
          doc: auditRef,
          async add(payload: any) {
            auditLogs.push(payload);
          }
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
    async runTransaction(callback: (transaction: any) => Promise<any>) {
      let release!: () => void;
      const previous = transactionTail;
      transactionTail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;

      try {
        return await callback({
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
      } finally {
        release();
      }
    }
  };

  return { db, candidateUpdates, globalSets, auditLogs, queriedTitles, storedGlobalSongs };
}

function createDb(candidate: Record<string, any>, globalSongs: GlobalSongFixture[]) {
  return createDbWithCandidates({ 'candidate-1': candidate }, globalSongs);
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
    expect(imported[0]).toMatchObject({ status: 'already_exists', globalSongId: 'global-1' });
    expect(candidateUpdates[0].payload).toMatchObject({
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
    expect(imported[0]).toMatchObject({ status: 'imported' });
    expect(imported[0].globalSongId).toMatch(/^bulk_[a-f0-9]{64}$/);
    expect(globalSets).toHaveLength(1);
    expect(globalSets[0].id).toBe(imported[0].globalSongId);
    expect(globalSets[0].payload).toMatchObject({
      title: 'Graça',
      artist: 'Artista B',
      normalizedTitle: 'graca',
      normalizedArtist: 'artista b',
      status: 'active'
    });
    expect(candidateUpdates[0].payload).toMatchObject({
      status: 'approved',
      approvedGlobalSongId: imported[0].globalSongId
    });
    expect(auditLogs).toHaveLength(1);
  });

  it('converges concurrent imports of the same candidate to one global song', async () => {
    const candidate = {
      title: 'Santo Para Sempre',
      artist: 'Ministério Um',
      normalizedTitle: 'santo para sempre',
      normalizedArtist: 'ministerio um',
      status: 'pending_review',
      classification: 'likely_unique'
    };
    const { db, globalSets } = createDb(candidate, []);

    const [first, second] = await Promise.all([
      bulkImportCandidates(db, ['candidate-1'], 'curator-1'),
      bulkImportCandidates(db, ['candidate-1'], 'curator-2')
    ]);

    const results = [first[0], second[0]];
    expect(results.some((item) => item.status === 'imported')).toBe(true);
    expect(results.some((item) => item.status === 'already_exists')).toBe(true);
    expect(results.every((item) => item.status !== 'error')).toBe(true);
    expect(globalSets).toHaveLength(1);
    expect(results[0].globalSongId).toBe(results[1].globalSongId);
  });

  it('converges two concurrent candidates with the same identity to one global song', async () => {
    const candidates = {
      'candidate-1': {
        title: 'Teu Amor Não Falha',
        artist: 'Banda Exemplo',
        status: 'pending_review',
        classification: 'likely_unique'
      },
      'candidate-2': {
        title: '  TEU AMOR NÃO FALHA ',
        artist: ' banda exemplo ',
        status: 'pending_review',
        classification: 'likely_unique'
      }
    };
    const { db, globalSets } = createDbWithCandidates(candidates, []);

    const [first, second] = await Promise.all([
      bulkImportCandidates(db, ['candidate-1'], 'curator-1'),
      bulkImportCandidates(db, ['candidate-2'], 'curator-2')
    ]);

    const results = [first[0], second[0]];
    expect(results.some((item) => item.status === 'imported')).toBe(true);
    expect(results.some((item) => item.status === 'already_exists')).toBe(true);
    expect(results.every((item) => item.status !== 'error')).toBe(true);
    expect(globalSets).toHaveLength(1);
    expect(results[0].globalSongId).toBe(results[1].globalSongId);
  });

  it('does not reintroduce title-only limit(1) deduplication', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'services/server/bulkImportService.ts'),
      'utf8'
    );

    expect(source).not.toContain('.limit(1)');
    expect(source).toContain("where('normalizedTitle', '==', identity.normalizedTitle)");
    expect(source).toContain('existingNormalizedArtist === normalizedArtist');
    expect(source).toContain('db.runTransaction');
  });
});
