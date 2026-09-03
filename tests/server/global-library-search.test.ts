import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { buildGlobalSongSearchFields } from '../../utils/searchEngine';
import * as fs from 'fs';

let testEnv: RulesTestEnvironment;
let emulatorDb: any;

// Mock the db before importing globalLibraryService
vi.mock('../../services/firebase', () => ({
  get db() {
    return emulatorDb;
  }
}));

import { getGlobalSongs } from '../../services/globalLibraryService';

const runEmulatorTests = !!process.env.FIRESTORE_EMULATOR_HOST;
const describeEmulator = runEmulatorTests ? describe : describe.skip;

describeEmulator('Global Library Search (Emulator)', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'musicscale-test-search-2',
      firestore: {
        rules: fs.readFileSync('firestore.rules', 'utf8'),
      },
    });
  }, 30_000);

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    // Use an authenticated admin context that has permission to write globalSongs
    const context = testEnv.authenticatedContext('admin_user', { email: 'pastordanielpcunha@gmail.com' });
    emulatorDb = context.firestore();
  });

  const createSong = async (id: string, data: any) => {
    const base = {
      title: data.title || '',
      artist: data.artist || '',
      lyrics: data.lyrics || '',
      key: data.key || '',
      status: 'active',
      importCount: 0,
      ...data
    };
    
    // Auto-generate search fields
    const searchFields = buildGlobalSongSearchFields(base);
    
    await setDoc(doc(emulatorDb, 'globalSongs', id), {
      ...base,
      ...searchFields
    });
  };

  it('1. should find a song whose title starts with the query', async () => {
    await createSong('s1', { title: 'Jesus Esta Aqui', artist: 'Banda A' });
    await createSong('s2', { title: 'Alfa e Omega', artist: 'Banda B' });

    const result = await getGlobalSongs('jesus');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('s1');
  });

  it('2. should find a song whose title contains the query in the middle', async () => {
    await createSong('s1', { title: 'O Grande Eu Sou', artist: 'Banda A' });
    const result = await getGlobalSongs('grande');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('s1');
  });

  it('3. should find a song by artist', async () => {
    await createSong('s1', { title: 'Song 1', artist: 'Hillsong' });
    await createSong('s2', { title: 'Song 2', artist: 'Elevation' });

    const result = await getGlobalSongs('hillsong');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('s1');
  });

  it('4. should find a song by a snippet of lyrics', async () => {
    await createSong('s1', { title: 'Song 1', lyrics: 'Alegria do Senhor é a nossa força' });
    
    const result = await getGlobalSongs('alegria');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('s1');
  });

  it('5. should find a song by multiple words of lyrics', async () => {
    await createSong('s1', { title: 'Song 1', lyrics: 'Rei dos reis e Senhor dos senhores' });
    
    const result = await getGlobalSongs('rei senhores');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('s1');
  });

  it('6. should find a song by alias', async () => {
    await createSong('s1', { title: 'Song 1', aliases: 'apelido1' });
    
    const result = await getGlobalSongs('apelido1');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('s1');
  });

  it('7. should find a song by musical key (C#)', async () => {
    await createSong('s1', { title: 'Song 1', key: 'C#' });
    await createSong('s2', { title: 'Song 2', key: 'C' });
    await createSong('s3', { title: 'Song 3', key: 'Cm' });

    const result = await getGlobalSongs('C#');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('s1');
  });

  it('8. should fallback to normalizedTitle for old songs without searchVersion', async () => {
    // Manually create without search fields
    await setDoc(doc(emulatorDb, 'globalSongs', 'old1'), {
      title: 'Antiga',
      normalizedTitle: 'antiga',
      status: 'active'
    });

    const result = await getGlobalSongs('anti');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('old1');
  });

  it('9. pagination without search should work', async () => {
    for (let i = 0; i < 35; i++) {
      await createSong(`s${i}`, { title: `Song ${i}` });
    }

    const firstPage = await getGlobalSongs('', undefined, 30);
    expect(firstPage.songs).toHaveLength(30);

    const secondPage = await getGlobalSongs('', firstPage.lastVisible, 30);
    expect(secondPage.songs.length).toBe(5);
  });

  it('9b. pagination advances across archived-heavy windows without hiding later active songs', async () => {
    // The first Firestore window contains fewer than pageSize active songs,
    // but there are more active songs after archived rows.
    for (let i = 0; i < 3; i++) {
      await createSong(`top_active_${i}`, { title: `Top Active ${i}`, importCount: 100 - i });
    }
    for (let i = 0; i < 12; i++) {
      await createSong(`archived_${i}`, {
        title: `Archived ${i}`,
        importCount: 90 - i,
        status: 'archived',
      });
    }
    for (let i = 0; i < 5; i++) {
      await createSong(`later_active_${i}`, { title: `Later Active ${i}`, importCount: 50 - i });
    }

    const firstPage = await getGlobalSongs('', undefined, 5);
    expect(firstPage.songs.length).toBeLessThanOrEqual(5);
    expect(firstPage.hasMore).toBe(true);
    expect(firstPage.lastVisible).toBeTruthy();

    const secondPage = await getGlobalSongs('', firstPage.lastVisible || undefined, 5);
    expect(secondPage.songs.map(song => song.id)).toEqual(
      expect.arrayContaining(['later_active_0', 'later_active_1', 'later_active_2', 'later_active_3', 'later_active_4']),
    );
  });

  it('10. should find a song outside the first 30 when searching globally (candidate pool)', async () => {
    // Create 35 songs that don't match, and 1 that matches at the end
    for (let i = 0; i < 35; i++) {
      await createSong(`s${i}`, { title: `Noise ${i}`, artist: 'Banda' });
    }
    // This one is the 36th song
    await createSong('target1', { title: 'Agua Viva', artist: 'Banda' });

    const result = await getGlobalSongs('agua');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('target1');
  });

  it('11. should find a song by title trigram (n-gram)', async () => {
    await createSong('s1', { title: 'Grande Eu Sou', artist: 'Banda A' });
    // "ran", "and", "nde" are trigrams of "grande"
    const result = await getGlobalSongs('nde');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('s1');
  });

  it('12. should find a song by artist trigram (n-gram)', async () => {
    await createSong('s1', { title: 'Song X', artist: 'Elevation Worship' });
    // "ele", "lev", "eva" are trigrams of "elevation"
    const result = await getGlobalSongs('ele');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('s1');
  });

  it('13. should handle >200 candidates gracefully and return correct top results', async () => {
    for (let i = 0; i < 210; i++) {
      // Create songs containing word "Noise"
      await createSong(`n_${i}`, { title: `Noise Song ${i}`, artist: 'Banda' });
    }
    await createSong('best_match', { title: 'Super Unique Jesus', artist: 'Banda' });

    const result = await getGlobalSongs('Jesus');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('best_match');
  });

  it('14. finds a late lyrics word beyond the legacy 150-token cap', async () => {
    const uniqueTokens = Array.from({ length: 151 }, (_, index) => `palavra${index}`);
    await createSong('late-content', {
      title: 'Canção Longa',
      artist: 'Banda A',
      lyrics: [...uniqueTokens, 'muralhas'].join(' '),
    });

    const result = await getGlobalSongs('muralhas');
    expect(result.songs.map(song => song.id)).toContain('late-content');
  });

  it('15. finds singable text embedded in chords without indexing raw chord symbols', async () => {
    await createSong('chord-content', {
      title: 'Outra Canção',
      artist: 'Banda B',
      chords: 'C G\nGraça me alcançou\nAm F',
    });

    const result = await getGlobalSongs('alcançou');
    expect(result.songs.map(song => song.id)).toContain('chord-content');
  });

  it('16. normalizes punctuation and diacritics for phrase content search', async () => {
    await createSong('phrase-content', {
      title: 'Memória',
      artist: 'Banda C',
      lyrics: 'No Calvário, encontrei fé! E a graça me alcançou.',
    });

    const result = await getGlobalSongs('calvario encontrei fe');
    expect(result.songs).toHaveLength(1);
    expect(result.songs[0].id).toBe('phrase-content');
  });

  it('17. preserves meaningful two-character content words and title priority', async () => {
    await createSong('faith-content', {
      title: 'Esperança',
      artist: 'Banda D',
      lyrics: 'Eu vivo pela fé',
    });
    const faithResult = await getGlobalSongs('fé');
    expect(faithResult.songs.map(song => song.id)).toContain('faith-content');

    await createSong('title-first', {
      title: 'Muralhas',
      artist: 'Banda E',
      lyrics: 'Outro texto',
    });
    await createSong('content-second', {
      title: 'Outra História',
      artist: 'Banda F',
      lyrics: 'As muralhas vão cair',
    });

    const prioritized = await getGlobalSongs('muralhas', undefined, 1);
    expect(prioritized.songs).toHaveLength(1);
    expect(prioritized.songs[0].id).toBe('title-first');
  });

  it('18. should test direct call to mergeGlobalSearchCandidates', async () => {
    const { mergeGlobalSearchCandidates } = await import('../../services/globalLibraryService');
    const candidates = [
      { id: 's1', title: 'Jesus Esta Aqui', artist: 'Banda A', status: 'active' },
      { id: 's2', title: 'Alfa e Omega', artist: 'Banda B', status: 'active' },
      { id: 's1', title: 'Jesus Esta Aqui', artist: 'Banda A', status: 'active' }, // Duplicate
    ] as any[];

    const ranked = mergeGlobalSearchCandidates(candidates, 'jesus');
    expect(ranked).toHaveLength(1);
    expect(ranked[0].id).toBe('s1');
  });
});
