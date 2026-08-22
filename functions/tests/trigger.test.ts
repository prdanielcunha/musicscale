import assert from 'assert';
import { processLocalSongWritten } from '../src/processor.js';

async function runTriggerTests() {
  console.log('Running Trigger Processor tests...');

  let updatedData: any = null;
  let existingDoc: any = null;
  
  let currentCollectionPath = '';
  let currentDocumentId = '';
  let currentFullPath = '';
  
  let setCalls = 0;
  let updateCalls = 0;
  let transactionCalls = 0;

  class MockDb {
    public runTransactionImpl: any;

    constructor() {
      this.runTransactionImpl = async (cb: any) => {
        transactionCalls++;
        const t = {
          get _get() {
            return async () => {
              return {
                exists: !!existingDoc,
                data: () => existingDoc
              };
            };
          },
          get _set() {
            return (ref: any) => { setCalls++; currentCollectionPath = ref.collectionPath; currentDocumentId = ref.id; currentFullPath = ref.path; };
          },
          get _update() {
            return (ref: any, data: any) => { updateCalls++; currentCollectionPath = ref.collectionPath; currentDocumentId = ref.id; currentFullPath = ref.path; updatedData = { ...existingDoc, ...data }; };
          }
        };
        Object.defineProperty(t, 'get', { get: function() { return this._get; }, set: function() { throw new Error('OVERRIDE_FORBIDDEN'); } });
        Object.defineProperty(t, 'set', { get: function() { return this._set; }, set: function() { throw new Error('OVERRIDE_FORBIDDEN'); } });
        Object.defineProperty(t, 'update', { get: function() { return this._update; }, set: function() { throw new Error('OVERRIDE_FORBIDDEN'); } });
        
        return cb(t);
      };
    }

    collection(colPath: string) {
      return {
        doc: (id: string) => ({
          collectionPath: colPath,
          id,
          path: `${colPath}/${id}`,
          get: async () => ({
            exists: !!existingDoc,
            data: () => existingDoc
          })
        })
      };
    }

    async runTransaction(cb: any) {
      return this.runTransactionImpl(cb);
    }
  }

  let mockDb = new MockDb();

  function resetMocks() {
    mockDb = new MockDb();
    updatedData = null;
    existingDoc = null;
    currentCollectionPath = '';
    currentDocumentId = '';
    currentFullPath = '';
    setCalls = 0;
    updateCalls = 0;
    transactionCalls = 0;
  }

  // 1. path exato de organização e música;
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org1', mockDb as any);
  assert.strictEqual(currentFullPath, 'songDiscoveryInbox/org1_song1');
  assert.strictEqual(currentCollectionPath, 'songDiscoveryInbox');
  assert.strictEqual(currentDocumentId, 'org1_song1');

  // 2. mesma organização e mesma música produzem o mesmo path;
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org1', mockDb as any);
  const path1 = currentFullPath;
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org1', mockDb as any);
  assert.strictEqual(path1, currentFullPath);

  // 3. organizações diferentes produzem paths diferentes;
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org2', mockDb as any);
  assert.notStrictEqual(path1, currentFullPath);

  // 4. músicas diferentes produzem paths diferentes;
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song2', 'org1', mockDb as any);
  assert.notStrictEqual(path1, currentFullPath);

  // 5. segunda execução usa update, não set;
  resetMocks();
  existingDoc = { status: 'ignored' };
  await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org1', mockDb as any);
  assert.strictEqual(updateCalls, 1);
  assert.strictEqual(setCalls, 0);

  // 6. update parcial preserva keepMe no estado final simulado;
  resetMocks();
  existingDoc = { status: 'ignored', keepMe: 'sim' };
  await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org1', mockDb as any);
  assert.strictEqual(updatedData.keepMe, 'sim');

  // 7. música inelegível não inicia transação;
  resetMocks();
  await processLocalSongWritten({ data: () => ({ title: '', artist: 'A' }) }, 'song1', 'org1', mockDb as any);
  assert.strictEqual(transactionCalls, 0);

  // 8. erro transacional é propagado;
  resetMocks();
  mockDb.runTransactionImpl = async () => { throw new Error('TRANSACTION_FAIL'); };
  try {
    await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org1', mockDb as any);
    assert.fail();
  } catch (e: any) {
    assert.strictEqual(e.message, 'TRANSACTION_FAIL');
  }

  // 9. prova comportamental do mock: referência com collectionPath incorreto faz a asserção canônica do path falhar
  resetMocks();
  mockDb.collection = () => ({
    doc: (id: string) => ({
      collectionPath: 'wrongCollection',
      id,
      path: `wrongCollection/${id}`,
      get: async () => ({ exists: false, data: () => null })
    })
  });
  await processLocalSongWritten({ data: () => ({ title: 'A' }) }, 'song1', 'org1', mockDb as any);
  assert.strictEqual(currentCollectionPath, 'wrongCollection');
  try {
    assert.strictEqual(currentCollectionPath, 'songDiscoveryInbox');
    assert.fail('Deveria ter falhado pois collectionPath e wrongCollection');
  } catch (e: any) {
    assert(e instanceof assert.AssertionError);
  }

  console.log('Curation Trigger tests passed!');
}

runTriggerTests().catch(e => {
  console.error('Trigger tests failed:', e);
  process.exit(1);
});
