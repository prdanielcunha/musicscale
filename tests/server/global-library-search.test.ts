import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { initializeTestEnvironment, RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDocs, collection, query, writeBatch } from 'firebase/firestore';
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
  });

  afterAll(async () => {
    await testEnv.cleanup();
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

  it('14. should test direct call to mergeGlobalSearchCandidates', async () => {
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
