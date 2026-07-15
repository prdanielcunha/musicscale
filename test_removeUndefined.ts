import { sanitizeFirestoreData, findUndefinedPaths } from './services/server/firestoreSanitizer.js';
import { adminDb } from './services/firebaseAdmin.js';
import { runSongDiscoveryProcessor } from './services/server/songDiscoveryProcessor.js';
import { admin } from './services/firebaseAdmin.js';
import { CURATION_LIMITS } from './utils/songDiscovery/curationTypes.js';

async function test() {
  const testPayloads = [
    { title: "No Sections", sections: undefined, lyrics: "a", chords: "b" },
    { title: "Empty Sections", sections: [], lyrics: "a", chords: "b" },
    { title: "No Selected Key", selectedKey: undefined, lyrics: "a", chords: "b" },
    { title: "No Chorus Fingerprint", lyrics: "a", chords: "b", chorusFingerprint: undefined },
    { title: "No Lyrics No Chords", lyrics: undefined, chords: undefined },
    { title: "Array with Undefined", sections: [{ name: "A" }, undefined, { name: "B" }], lyrics: "a" },
    { title: "Complete", sections: [{ name: "Chorus" }], lyrics: "a", chords: "b", key: "G", selectedKey: "G" },
    { title: "Valid Song 1", lyrics: "a", chords: "b" },
    { title: "", lyrics: "a", chords: "b" }, // Inválida no meio (MISSING_TITLE)
    { title: "Valid Song 2", lyrics: "a", chords: "b" },
  ];

  for (let i = 0; i < testPayloads.length; i++) {
    const payload = testPayloads[i];
    
    console.log(`Test ${i + 1}: ${payload.title || 'INVALID SONG'}`);
    
    const undefinedPaths = findUndefinedPaths(payload);
    if (undefinedPaths.length > 0) {
      console.log(`  Undefined paths before sanitization:`, undefinedPaths);
    }
    
    const sanitized = sanitizeFirestoreData(payload);
    const undefinedPathsAfter = findUndefinedPaths(sanitized);
    
    if (undefinedPathsAfter.length > 0) {
      console.error(`  FAIL! Undefined paths after sanitization:`, undefinedPathsAfter);
    } else {
      console.log(`  Sanitized successfully!`);
    }

    try {
        if (!adminDb) {
            console.log("No admin db");
            continue;
        }
        
        let p = {
            ...payload, 
            createdAt: Date.now(), 
            updatedAt: Date.now(), 
            deleted: false, 
            archived: false, 
            isDraft: false, 
            organizationId: 'org_test'
        };
        const result = await runSongDiscoveryProcessor(p as any, `song_${i}`, 'org_test', adminDb);
        console.log(`  runSongDiscoveryProcessor result:`, result.outcome);
    } catch(err) {
        console.error(`  runSongDiscoveryProcessor failed!`, err);
    }
  }

  process.exit(0);
}

test();
