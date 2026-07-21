import assert from 'assert';
import { processLocalSongWritten } from '../src/processor.js';

async function runTriggerTests() {
  console.log('Running Trigger Processor tests...');

  // Mock logger
  const logs: any[] = [];
  (global as any).mockLogger = {
    info: (msg: string, meta: any) => logs.push({ type: 'info', msg, meta }),
    error: (msg: string, meta: any) => logs.push({ type: 'error', msg, meta })
  };

  let writtenData: any = null;
  let updatedData: any = null;

  const mockDb = {
        collection: (colPath: string) => {
           return {
              doc: (id?: string) => ({
                 id: id || 'generated-id'
              })
           };
        },
        runTransaction: async (cb: any) => {
           return cb({
              get: async () => ({ exists: false }),
              set: (ref: any, data: any) => { writtenData = data; },
              update: (ref: any, data: any) => { updatedData = data; }
           });
        }
  };

  // 1. música válida
  writtenData = null;
  await processLocalSongWritten({ data: () => ({ title: 'Deus de Aliança', artist: 'Toque no Altar', lyrics: 'A letra', chords: 'A B C' }) }, 'song1', 'org1', mockDb);
  assert.ok(writtenData);
  assert.strictEqual(writtenData.title, 'Deus de Aliança');
  assert.strictEqual(writtenData.status, 'pending');

  // 2. música da Biblioteca Viva ignorada (has originGlobalSongId)
  writtenData = null;
  await processLocalSongWritten({ data: () => ({ title: 'Deus de Aliança', originGlobalSongId: 'global-1' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(writtenData, null); // should be ignored

  // 3. música sem título ignorada
  writtenData = null;
  await processLocalSongWritten({ data: () => ({ title: '   ', artist: 'Toque no Altar' }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(writtenData, null); // ignored

  // 4. música arquivada / excluída
  writtenData = null;
  await processLocalSongWritten({ data: () => ({ title: 'Valid', deleted: true }) }, 'song1', 'org1', mockDb);
  assert.strictEqual(writtenData, null); // ignored

  console.log('Trigger Processor tests passed!');
}

runTriggerTests().catch(e => {
  console.error(e);
  process.exit(1);
});
