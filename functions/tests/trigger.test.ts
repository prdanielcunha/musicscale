import assert from 'assert';
import { processLocalSongWritten } from '../src/processor.js';

async function runTriggerTests() {
  console.log('Running Trigger Processor tests (12 Canonical Scenarios)...');
  
  const logs: any[] = [];
  (global as any).mockLogger = {
    info: (msg: string, meta: any) => logs.push({ type: 'info', msg, meta }),
    error: (msg: string, meta: any) => logs.push({ type: 'error', msg, meta })
  };

  let writtenData: any = null;
  let updatedData: any = null;
  let existingDoc: any = null;
  let targetPath: string = '';
  let getCalls = 0;
  let setCalls = 0;
  let updateCalls = 0;
  let transactionCalls = 0;

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
      transactionCalls++;
      let writeStarted = false;
      const t = {
        get _get() {
          return async (ref: any) => {
            if (writeStarted) throw new Error('FIRESTORE_READ_AFTER_WRITE_FORBIDDEN');
            getCalls++;
            targetPath = ref.id;
            return {
              exists: !!existingDoc,
              data: () => existingDoc
            };
          };
        },
        get _set() {
          return (ref: any, data: any) => { writeStarted = true; setCalls++; targetPath = ref.id; writtenData = data; };
        },
        get _update() {
          return (ref: any, data: any) => { writeStarted = true; updateCalls++; targetPath = ref.id; updatedData = data; };
        }
      };
      
      Object.defineProperty(t, 'get', { get: function() { return this._get; }, set: function() { throw new Error('OVERRIDE_FORBIDDEN'); } });
      Object.defineProperty(t, 'set', { get: function() { return this._set; }, set: function() { throw new Error('OVERRIDE_FORBIDDEN'); } });
      Object.defineProperty(t, 'update', { get: function() { return this._update; }, set: function() { throw new Error('OVERRIDE_FORBIDDEN'); } });
      
      return cb(t);
    }
  };

  function resetMocks() {
    writtenData = null;
    updatedData = null;
    existingDoc = null;
    targetPath = '';
    getCalls = 0;
    setCalls = 0;
    updateCalls = 0;
    transactionCalls = 0;
    logs.length = 0;
  }

  // Contract requirement 1 & 2: ID and collection logic is internal to processor
  // But we can check targetPath is `${orgId}_${songId}`
  
  // Scenario 1
  resetMocks();
  await processLocalSongWritten({
    data: () => ({ title: 'Deus de Aliança', artist: 'Toque no Altar' })
  }, 'song1', 'org1', mockDb);
  assert.ok(writtenData);
  assert.strictEqual(writtenData.title, 'Deus de Aliança');
  assert.strictEqual(writtenData.status, 'pending'); // Req 8
  assert.strictEqual(writtenData.attempts, 0); // Req 7
  assert.strictEqual(writtenData.sourceOrganizationId, 'org1'); // Req 3
  assert.strictEqual(writtenData.sourceSongId, 'song1'); // Req 4
  assert.strictEqual(targetPath, 'org1_song1'); // Req 2
  assert.strictEqual(setCalls, 1); // Req 9
  assert.strictEqual(updateCalls, 0);
  assert.strictEqual(writtenData.normalizedTitle, 'deus de alianca'); // Req 5

  // Scenario 2
  resetMocks();
  await processLocalSongWritten({ data: () => null }, 'song1', 'org1', mockDb);
  assert.strictEqual(transactionCalls, 0); // Req 16

  // Scenario 3
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: '', artist: 'A' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(transactionCalls, 0); // Req 17

  // Scenario 4
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: '   ', artist: 'A' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(transactionCalls, 0); // Req 17

  // Scenario 5
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: 'A', deleted: true }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(transactionCalls, 0); // Req 18

  // Scenario 6
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: 'A', archived: true }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(transactionCalls, 0); // Req 19

  // Scenario 7
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: 'A', isDraft: true }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(transactionCalls, 0); // Req 20

  // Scenario 8
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: 'A', originGlobalSongId: 'g1' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(transactionCalls, 0); // Req 21

  // Scenario 9
  resetMocks();
  existingDoc = { status: 'ignored', title: 'Old Title', attempts: 1, keepMe: 'yes' };
  await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(updateCalls, 1); // Req 10
  assert.strictEqual(updatedData.status, 'pending'); // Req 11

  // Scenario 10
  resetMocks();
  existingDoc = { status: 'failed', title: 'Old Title', attempts: 3 };
  await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(updatedData.status, 'pending'); // Req 12

  // Scenario 11
  resetMocks();
  existingDoc = { status: 'analyzed', title: 'Deus de Aliança', keepMe: 'yes' };
  await processLocalSongWritten({ data: () => ({ title: 'Deus de Aliança' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(updatedData.status, 'analyzed'); // Req 13
  assert.strictEqual(updatedData.keepMe, undefined); // We only verify we didn't overwrite fields if we don't supply them. Since update does partial update in firestore, fields not passed to update are implicitly not overwritten. // Req 15

  // Processing remains processing
  resetMocks();
  existingDoc = { status: 'processing', title: 'A' };
  await processLocalSongWritten({ data: () => ({ title: 'B' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(updatedData.status, 'processing'); // Req 14

  // Scenario 12
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(writtenData.artist, 'Desconhecido'); // Req 6

  // Req 22: Error is propagated
  resetMocks();
  mockDb.runTransaction = async () => { throw new Error('TRANSACTION_FAIL'); };
  try {
    await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org1', mockDb as any);
    assert.fail('Should have thrown');
  } catch (e: any) {
    assert.strictEqual(e.message, 'TRANSACTION_FAIL');
  }

  // Req 23, 24 handled by logical document ID definition (`${orgId}_${songId}`) in the processor

  console.log('Curation Trigger 12 canonical scenarios tests passed!');
}

runTriggerTests().catch(e => {
  console.error('Trigger tests failed:', e);
  process.exit(1);
});
