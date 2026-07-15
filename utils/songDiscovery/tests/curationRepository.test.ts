import assert from 'node:assert';
import { GlobalLibraryCandidateOccurrence } from '../curationTypes.js';

// We will test the validation part and mock the behavior of firestore loosely since we don't have an emulator here.
// In a real environment, we'd use Firebase Emulator for true transactional tests. 
// For this environment, we will unit test the data validation and schema extraction inside the repository,
// and simulate the Firestore batch / transaction outcomes.

// Real repository import
import { GlobalLibraryCandidateRepository } from '../../../services/server/globalLibraryCandidateRepository.js';

export async function runTests() {
   console.log('Running curation repository limit tests...');
   
   // We override the DB object or just test the limits function since it does not hit DB directly before validation
   const collectionMock = {
      doc: (idParam?: string) => ({ 
         id: idParam || 'doc-id', 
         isOccurrence: idParam === 'existing-key',
         collection: () => ({ 
            doc: (subId?: string) => ({ id: subId || 'doc-id2', isOccurrence: subId === 'existing-key' })
         }) 
      })
   };

   const mockDbObj = {
       runTransaction: async (cb: any) => {
         const t = {
            get: async (ref: any) => {
               if (ref && ref.isOccurrence) return { exists: false };
               return { exists: false };
            },
            set: () => {},
            update: () => {}
         };
         return cb(t);
       },
       batch: () => ({ set: () => {}, commit: async () => {} }),
       collection: () => collectionMock
   };

   let failed = false;
   const repo = new GlobalLibraryCandidateRepository(mockDbObj);
   
   try {
       await repo.addOccurrenceIdempotently('cand-1', {
           source: { organizationId: 'org-1', songId: 'song-1' },
           snapshot: {} as any, // Mock
           normalizedIdentity: {
               normalizedTitle: 'x'.repeat(300), // Exceeds 200
               normalizedArtists: [],
               contentFingerprint: 'abc', titleFingerprint: 'xyz', originalTitle: ''
           },
           discovery: { discoveredAt: 123, sourceContentFingerprint: 'x' },
           processing: { algorithmVersion: '1.0', reasonCodes: [], warningCodes: [] },
           idempotencyKey: 'key-1'
       } as unknown as any);
       failed = true;
   } catch (e: any) {
       assert.ok(e.message.includes('DOCUMENT_TOO_LARGE'));
   }
   
   if (failed) throw new Error("Repository did not reject oversized title payload");

   try {
       await repo.addOccurrenceIdempotently('cand-2', {
           source: { organizationId: 'org-1', songId: 'song-1' },
           snapshot: {} as any, // Mock
           normalizedIdentity: {
               normalizedTitle: 'Normal Title', 
               normalizedLyrics: 'y'.repeat(6000), // Exceeds 5000
               normalizedArtists: [],
               contentFingerprint: 'abc', titleFingerprint: 'xyz', originalTitle: ''
           },
           discovery: { discoveredAt: 123, sourceContentFingerprint: 'x' },
           processing: { algorithmVersion: '1.0', reasonCodes: [], warningCodes: [] },
           idempotencyKey: 'key-1'
       } as unknown as any);
       failed = true;
   } catch (e: any) {
       assert.ok(e.message.includes('DOCUMENT_TOO_LARGE'));
   }

   // Test idempotency logic using mocks
   // If it exists, returns already_exists
   const mockExistingDb = {
       runTransaction: async (cb: any) => {
          const t = {
             get: async (ref: any) => {
                 // In the exact matching test we assume the target reference is always the occurrence
                 if (ref && ref.id && ref.id.length === 64) { // sha-256 hash length
                     return { 
                         exists: true, 
                         data: () => ({ idempotencyKey: 'existing-key' }) 
                     };
                 }
                 return { exists: false };
             },
             set: () => {},
             update: () => {}
          };
          return cb(t);
       },
       collection: () => collectionMock
   };

   (repo as any).db = mockExistingDb;
   let result = await repo.addOccurrenceIdempotently('cand-3', {
       source: { organizationId: 'org-1', songId: 'song-1' },
       snapshot: {} as any,
       normalizedIdentity: {
           normalizedTitle: 'Normal', 
           normalizedArtists: [],
           contentFingerprint: '123', titleFingerprint: 'abc', originalTitle: ''
       },
       discovery: { discoveredAt: 123, sourceContentFingerprint: 'x' },
       processing: { algorithmVersion: '1.0', reasonCodes: [], warningCodes: [] },
       idempotencyKey: 'existing-key'
   } as unknown as any);

   assert.strictEqual(result.outcome, 'already_exists');
   assert.strictEqual((result as any).candidateId, 'cand-3');

   // Hash Collision test
   // We simulate a different idempotency key that somehow resolved to the same document reference in the mock
   const mockCollisionDb = {
       runTransaction: async (cb: any) => {
          const t = {
             get: async (ref: any) => {
                 // return a document that says its key is 'existing-key'
                 return { exists: true, data: () => ({ idempotencyKey: 'different-original-key' }) };
             },
             set: () => {},
             update: () => {}
          };
          return cb(t);
       },
       collection: () => collectionMock
   };

   (repo as any).db = mockCollisionDb;
   result = await repo.addOccurrenceIdempotently('cand-4', {
       source: { organizationId: 'org-1', songId: 'song-1' },
       snapshot: {} as any,
       normalizedIdentity: {
           normalizedTitle: 'Normal', 
           normalizedArtists: [],
           contentFingerprint: '123', titleFingerprint: 'abc', originalTitle: ''
       },
       discovery: { discoveredAt: 123, sourceContentFingerprint: 'x' },
       processing: { algorithmVersion: '1.0', reasonCodes: [], warningCodes: [] },
       idempotencyKey: 'my-new-key' // the mock db will return 'different-original-key', triggering the conflict
   } as unknown as any);

   assert.strictEqual(result.outcome, 'idempotency_conflict');

   console.log('curation repository limits and logic tests passed!');
}
