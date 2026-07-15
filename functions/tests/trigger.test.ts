import assert from 'assert';
import { processLocalSongWritten } from '../src/processor.js';
import { GlobalLibraryCandidateRepository } from '../../services/server/globalLibraryCandidateRepository.js';

async function runTriggerTests() {
  console.log('Running Trigger Processor tests...');

  // Mock logger
  const logs: any[] = [];
  (global as any).mockLogger = {
    info: (msg: string, meta: any) => logs.push({ type: 'info', msg, meta }),
    error: (msg: string, meta: any) => logs.push({ type: 'error', msg, meta })
  };

  let queriedCandidates: any[] = [];
  let queriedGlobalSongs: any[] = [];
  const mockDb = {
        collection: (colPath: string) => {
           if (colPath === 'globalSongs') {
               return {
                  where: (_field: string, _op: string, _val: any) => ({
                      limit: (_limit: number) => ({
                          get: async () => ({ docs: queriedGlobalSongs })
                      })
                  })
               };
           }
           if (colPath === 'globalLibraryCandidates') {
               return {
                  doc: (id?: string) => ({ id: id || 'generated-candidate-id' }),
                  where: (_field: string, _op: string, _val: any) => ({
                      limit: (_limit: number) => ({
                          get: async () => ({ docs: queriedCandidates })
                      })
                  })
               };
           }
           return {} as any;
        },
        runTransaction: async (cb: any) => cb({
          get: async () => ({ exists: false }),
          set: () => {},
          update: () => {}
        })
  };

  // Replace default repo call by patching prototype
  const orgAdd = GlobalLibraryCandidateRepository.prototype.addOccurrenceIdempotently;
  let calls = 0;
  GlobalLibraryCandidateRepository.prototype.addOccurrenceIdempotently = async function(candId: string, input: any) {
    calls++;
    return { outcome: 'candidate_created', candidateId: candId, occurrenceId: 'occ-123' };
  };

  // 1. música válida
  calls = 0; queriedCandidates = [];
  await processLocalSongWritten({ data: () => ({ title: 'Deus de Aliança', artist: 'Toque no Altar', lyrics: 'A letra', chords: 'A B C' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(calls, 1);

  // 2. música da Biblioteca Viva ignorada
  calls = 0; queriedCandidates = [];
  await processLocalSongWritten({ data: () => ({ title: 'Deus de Aliança', originGlobalSongId: 'global-1' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(calls, 0);

  // 3. música sem título ignorada
  calls = 0; queriedCandidates = [];
  await processLocalSongWritten({ data: () => ({ title: '   ', artist: 'Toque no Altar' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(calls, 0);

  // 4. música arquivada
  calls = 0; queriedCandidates = [];
  await processLocalSongWritten({ data: () => ({ title: 'Valid', deleted: true }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(calls, 0);

  // 5. ausência de candidatos
  calls = 0; queriedCandidates = []; // empty query
  await processLocalSongWritten({ data: () => ({ title: 'Inédita 2024', lyrics: 'Letra nova local' }) }, 'song2', 'org1', mockDb);
  assert.strictEqual(calls, 1);

  // 6. possível duplicada (match found)
  queriedCandidates = [
      { id: 'cand-existente', data: () => ({
          canonicalIdentity: {
              normalizedTitle: 'inedita 2024',
              normalizedArtists: [],
              normalizedLyrics: 'letra nova local',
              lyricsFingerprint: 'mock-fp',
              originalTitle: 'Inédita 2024'
          },
          discovery: {
              sourceSnapshot: { title: 'Inédita 2024', artists: [], lyrics: 'Letra nova local', chords: '', bpm: null }
          }
      }) }
  ];
  calls = 0;
  await processLocalSongWritten({ data: () => ({ title: 'Inédita 2024', lyrics: 'Letra nova local' }) }, 'song3', 'org1', mockDb);
  assert.strictEqual(calls, 1);

  // 7. idempotência / colisão tratada -> already_exists
  GlobalLibraryCandidateRepository.prototype.addOccurrenceIdempotently = async function(candId: string, input: any) {
    calls++;
    return { outcome: 'already_exists', candidateId: candId, occurrenceId: 'occ-4' };
  };
  calls = 0;
  await processLocalSongWritten({ data: () => ({ title: 'Inédita 2024', lyrics: 'Letra nova local' }) }, 'song3', 'org1', mockDb);
  assert.strictEqual(calls, 1);

  // 8. globalSong match
  queriedCandidates = [];
  queriedGlobalSongs = [
      { id: 'global-2', data: () => ({
          normalizedTitle: 'inedita 2024',
          normalizedArtists: [],
          normalizedLyrics: 'letra nova local',
          title: 'Inédita 2024'
      }) }
  ];
  calls = 0;
  let saveMatchesCalls = 0;
  GlobalLibraryCandidateRepository.prototype.addOccurrenceIdempotently = async function(candId: string, input: any) {
    calls++;
    return { outcome: 'candidate_created', candidateId: candId, occurrenceId: 'occ-5' };
  };
  GlobalLibraryCandidateRepository.prototype.saveCandidateMatches = async function(candId: string, matches: any) {
    saveMatchesCalls++;
  };
  await processLocalSongWritten({ data: () => ({ title: 'Inédita 2024', lyrics: 'Letra nova local' }) }, 'song4', 'org1', mockDb);
  assert.strictEqual(calls, 1);
  assert.strictEqual(saveMatchesCalls, 1);

  // Restore
  GlobalLibraryCandidateRepository.prototype.addOccurrenceIdempotently = orgAdd;
  console.log('Trigger Processor tests passed!');
}

runTriggerTests().catch(console.error);
