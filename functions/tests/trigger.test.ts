import assert from 'assert';
import { processLocalSongWritten } from '../src/processor.js';

async function runTriggerTests() {
  console.log('Running Trigger Processor tests (12 Canonical Scenarios)...');

  // Mock logger
  const logs: any[] = [];
  (global as any).mockLogger = {
    info: (msg: string, meta: any) => logs.push({ type: 'info', msg, meta }),
    error: (msg: string, meta: any) => logs.push({ type: 'error', msg, meta })
  };

  let writtenData: any = null;
  let updatedData: any = null;
  let existingDoc: any = null;

  const mockDb = {
    collection: (colPath: string) => {
      return {
        doc: (id: string) => ({
          id,
          get: async () => ({
            exists: !!existingDoc,
            data: () => existingDoc
          })
        })
      };
    },
    runTransaction: async (cb: any) => {
      return cb({
        get: async (ref: any) => ({
          exists: !!existingDoc,
          data: () => existingDoc
        }),
        set: (ref: any, data: any) => { writtenData = data; },
        update: (ref: any, data: any) => { updatedData = data; }
      });
    }
  };

  function resetMocks() {
    writtenData = null;
    updatedData = null;
    existingDoc = null;
    logs.length = 0;
  }

  // Scenario 1: Valid song is queued as pending
  resetMocks();
  await processLocalSongWritten({
    data: () => ({
      title: 'Deus de Aliança',
      artist: 'Toque no Altar',
      lyrics: 'Letra',
      chords: 'A B'
    })
  }, 'song1', 'org1', mockDb);
  assert.ok(writtenData, "Scenario 1: Should write a record");
  assert.strictEqual(writtenData.title, 'Deus de Aliança');
  assert.strictEqual(writtenData.status, 'pending');

  // Scenario 2: Missing song data (no document data)
  resetMocks();
  await processLocalSongWritten({
    data: () => null
  }, 'song1', 'org1', mockDb);
  assert.strictEqual(writtenData, null, "Scenario 2: Should ignore missing data");

  // Scenario 3: Empty title is ignored
  resetMocks();
  await processLocalSongWritten({
    data: () => ({
      title: '',
      artist: 'Toque no Altar'
    })
  }, 'song1', 'org1', mockDb);
  assert.strictEqual(writtenData, null, "Scenario 3: Should ignore empty title");

  // Scenario 4: Title with only whitespace is ignored
  resetMocks();
  await processLocalSongWritten({
    data: () => ({
      title: '   ',
      artist: 'Toque no Altar'
    })
  }, 'song1', 'org1', mockDb);
  assert.strictEqual(writtenData, null, "Scenario 4: Should ignore whitespace title");

  // Scenario 5: Deleted song is ignored
  resetMocks();
  await processLocalSongWritten({
    data: () => ({
      title: 'Deus de Aliança',
      deleted: true
    })
  }, 'song1', 'org1', mockDb);
  assert.strictEqual(writtenData, null, "Scenario 5: Should ignore deleted songs");

  // Scenario 6: Archived song is ignored
  resetMocks();
  await processLocalSongWritten({
    data: () => ({
      title: 'Deus de Aliança',
      archived: true
    })
  }, 'song1', 'org1', mockDb);
  assert.strictEqual(writtenData, null, "Scenario 6: Should ignore archived songs");

  // Scenario 7: Draft song is ignored
  resetMocks();
  await processLocalSongWritten({
    data: () => ({
      title: 'Deus de Aliança',
      isDraft: true
    })
  }, 'song1', 'org1', mockDb);
  assert.strictEqual(writtenData, null, "Scenario 7: Should ignore draft songs");

  // Scenario 8: Song with originGlobalSongId is ignored
  resetMocks();
  await processLocalSongWritten({
    data: () => ({
      title: 'Deus de Aliança',
      originGlobalSongId: 'global-123'
    })
  }, 'song1', 'org1', mockDb);
  assert.strictEqual(writtenData, null, "Scenario 8: Should ignore already linked songs");

  // Scenario 9: Existing document with 'ignored' status resets to 'pending'
  resetMocks();
  existingDoc = {
    inboxId: 'org1_song1',
    status: 'ignored',
    title: 'Old Title',
    attempts: 1
  };
  await processLocalSongWritten({
    data: () => ({
      title: 'Deus de Aliança',
      artist: 'Toque no Altar'
    })
  }, 'song1', 'org1', mockDb);
  assert.ok(updatedData, "Scenario 9: Should update existing record");
  assert.strictEqual(updatedData.status, 'pending', "Scenario 9: Status should reset to pending");

  // Scenario 10: Existing document with 'failed' status resets to 'pending'
  resetMocks();
  existingDoc = {
    inboxId: 'org1_song1',
    status: 'failed',
    title: 'Old Title',
    attempts: 3
  };
  await processLocalSongWritten({
    data: () => ({
      title: 'Deus de Aliança',
      artist: 'Toque no Altar'
    })
  }, 'song1', 'org1', mockDb);
  assert.ok(updatedData, "Scenario 10: Should update existing record");
  assert.strictEqual(updatedData.status, 'pending', "Scenario 10: Status should reset to pending");

  // Scenario 11: Existing document with 'analyzed' status keeps its status (already_queued)
  resetMocks();
  existingDoc = {
    inboxId: 'org1_song1',
    status: 'analyzed',
    title: 'Deus de Aliança'
  };
  await processLocalSongWritten({
    data: () => ({
      title: 'Deus de Aliança',
      artist: 'Toque no Altar'
    })
  }, 'song1', 'org1', mockDb);
  assert.ok(updatedData, "Scenario 11: Should perform updates");
  assert.strictEqual(updatedData.status, 'analyzed', "Scenario 11: Should preserve analyzed status");

  // Scenario 12: Missing artist defaults to 'Desconhecido'
  resetMocks();
  await processLocalSongWritten({
    data: () => ({
      title: 'Deus de Aliança'
    })
  }, 'song1', 'org1', mockDb);
  assert.ok(writtenData, "Scenario 12: Should write a record");
  assert.strictEqual(writtenData.artist, 'Desconhecido', "Scenario 12: Should default artist to Desconhecido");

  console.log('Curation Trigger 12 canonical scenarios tests passed!');
}

runTriggerTests().catch(e => {
  console.error('Trigger tests failed:', e);
  process.exit(1);
});
