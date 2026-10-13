import assert from 'node:assert/strict';
import { ingestNewLocalSong } from '../src/globalSongIngestion.js';

class FakeDb {
  docs = new Map<string, any>();
  collection(path: string) { return new FakeCollection(this, path); }
  async runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return fn({
      get: async (ref: any) => ref.get(),
      set: (ref: any, data: any) => this.docs.set(ref.path, { ...this.docs.get(ref.path), ...data }),
      update: (ref: any, data: any) => {
        const previous = this.docs.get(ref.path) || {};
        this.docs.set(ref.path, { ...previous, ...data });
      }
    });
  }
}
class FakeCollection {
  constructor(private db: FakeDb, private path: string) {}
  doc(id = 'test_' + this.db.docs.size) { return new FakeRef(this.db, this.path + '/' + id); }
  where(field: string, operator: string, value: unknown) {
    assert.equal(operator, '==');
    return new FakeQuery(this.db, this.path, [{ field, value }]);
  }
}
class FakeQuery {
  private max = 10000;
  constructor(private db: FakeDb, private path: string,
    private fields: Array<{field: string; value: unknown}>) {}
  limit(count: number) { this.max = count; return this; }
  async get() {
    const docs = [...this.db.docs.entries()].filter(([path, data]) => {
      if (!path.startsWith(this.path + '/') ||
          path.slice(this.path.length + 1).includes('/')) return false;
      return this.fields.every(({field, value}) => {
        const v = field.split('.').reduce((obj: any, key: string) => obj?.[key], data);
        return v === value;
      });
    }).slice(0, this.max).map(([path, data]) => ({
      id: path.split('/').pop(), data: () => data
    }));
    return { docs };
  }
}
class FakeRef {
  id: string;
  constructor(private db: FakeDb, public path: string) {
    this.id = path.split('/').pop()!;
  }
  collection(name: string) { return new FakeCollection(this.db, this.path + '/' + name); }
  async get() { return {
    id: this.id,
    exists: this.db.docs.has(this.path),
    data: () => this.db.docs.get(this.path) || null
  }; }
}
const words = 'A luz da manhã renova nossa esperança e a voz da comunidade se levanta em harmonia para celebrar o novo dia com amor e paz';
const otherWords = 'Na caminhada da vida seguimos juntos em fé e coragem unidos pelas melodias que aquecem o coração e fazem nascer um novo canto';
const entries = (db: FakeDb, path: string) =>
  [...db.docs.entries()].filter(([p]) => p.startsWith(path + '/') &&
    !p.slice(path.length + 1).includes('/'));

async function main() {
  const db = new FakeDb();
  db.docs.set('songs/s1', { organizationId: 'orgA', title: 'Canção da Manhã',
    artist: 'Cantora Alfa', lyrics: words, createdBy: { uid: 'ordinary1' } });
  const a = await ingestNewLocalSong('s1', 'orgA', db.docs.get('songs/s1'), db);
  assert.equal(a, 'published', 'ordinary creator must publish a verified unique song');
  assert.equal(entries(db, 'globalSongs').length, 1);
  assert.equal(entries(db, 'globalSongs')[0][1].status, 'active');
  assert.equal(entries(db, 'globalSongs')[0][1].contribution.organizationId, 'orgA');
  assert.equal(entries(db, 'globalSongs')[0][1].contribution.userId, 'ordinary1');
  assert.ok(db.docs.get('songs/s1').originGlobalSongId, 'source song is linked, not removed');
  assert.equal(await ingestNewLocalSong('s1', 'orgA', db.docs.get('songs/s1'), db),
    'ignored', 'linked song cannot be republished');

  db.docs.set('songs/s2', { organizationId: 'orgB', title: 'Canção da Manhã',
    artist: 'Cantora Alfa', lyrics: words, createdBy: { uid: 'ordinary2' } });
  assert.equal(await ingestNewLocalSong('s2', 'orgB', db.docs.get('songs/s2'), db), 'pending');
  assert.equal(entries(db, 'globalSongs').length, 1, 'global song must never be duplicated');
  assert.ok(!db.docs.get('songs/s2').originGlobalSongId, 'pending duplicate preserves local song');
  assert.equal(await ingestNewLocalSong('s2', 'orgB', db.docs.get('songs/s2'), db),
    'already_processed', 'retries must be idempotent');

  db.docs.set('songs/s3', { organizationId: 'orgC', title: 'Outro Nome da Música',
    artist: 'Cantora Beta', lyrics: words });
  assert.equal(await ingestNewLocalSong('s3', 'orgC', db.docs.get('songs/s3'), db),
    'pending', 'same lyrics under different title needs review');

  db.docs.set('songs/s4', { organizationId: 'orgD', title: 'Canção da Manhã',
    artist: 'Cantora Gama', lyrics: otherWords });
  assert.equal(await ingestNewLocalSong('s4', 'orgD', db.docs.get('songs/s4'), db),
    'published', 'same title with independent artist/lyrics may be unique');
  assert.equal(entries(db, 'globalSongs').length, 2);

  db.docs.set('songs/s5', { organizationId: 'orgE', title: 'Canção Nova',
    artist: '', lyrics: '' });
  assert.equal(await ingestNewLocalSong('s5', 'orgE', db.docs.get('songs/s5'), db),
    'pending', 'incomplete metadata must never auto-publish');

  console.log('Universal global song ingestion tests passed');
}
main().catch(error => { console.error(error); process.exit(1); });
