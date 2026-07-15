import assert from 'node:assert';
import { buildSanitizedSnapshot } from '../snapshotSanitizer.js';
import { Song } from '../../../types.js';

export function runTests() {
   console.log('Running snapshot sanitizer tests...');
   
   const fakeSong: Song = {
       id: 'private-song-id-1234',
       organizationId: 'private-org-id',
       title: 'Minha Música',
       artist: 'Banda Local',
       key: 'G',
       status: 'active',
       tagIds: ['tag-1', 'tag-2'],
       lyrics: 'Letra aqui',
       chords: '[G]',
       chordsUrl: 'javascript:alert()',
       videoUrl: 'https://youtube.com/watch?v=123',
       createdAt: '2024-01-01',
       createdBy: { uid: 'user-1', displayName: 'User', photoURL: '' },
       lastPlayed: '2024-02-02',
       // @ts-ignore (injecting extra fields)
       bandNotes: 'Não tocar rápido',
       isNew: true
   };

   const snapshot = buildSanitizedSnapshot(fakeSong);

   assert.strictEqual((snapshot as any).organizationId, undefined);
   assert.strictEqual((snapshot as any).tagIds, undefined);
   assert.strictEqual((snapshot as any).lastPlayed, undefined);
   assert.strictEqual((snapshot as any).bandNotes, undefined);
   assert.strictEqual((snapshot as any).isNew, undefined);
   assert.strictEqual(snapshot.title, 'Minha Música');
   assert.strictEqual(snapshot.chordsUrl, ''); // sanitized
   assert.strictEqual(snapshot.videoUrl, 'https://youtube.com/watch?v=123'); // valid
   
   console.log('snapshot sanitizer tests passed!');
}
