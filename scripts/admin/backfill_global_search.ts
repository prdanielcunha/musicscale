import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { normalizeSearchText, normalizeMusicalKey } from '../../utils/searchEngine';
import * as dotenv from 'dotenv';
dotenv.config();

// Initialize Firebase Admin
// Make sure to set GOOGLE_APPLICATION_CREDENTIALS in your environment
const app = initializeApp();
const db = getFirestore(app);

const GLOBAL_SONGS_COLLECTION = 'globalSongs';

// We duplicate the logic here to avoid importing browser-specific modules or dependencies
// that might break the admin script
function buildPrefixes(tokens: string[], minLen: number, maxPrefixes: number) {
  const prefixes = new Set<string>();
  for (const token of tokens) {
    if (token.length >= minLen) {
      for (let i = minLen; i <= token.length; i++) {
        prefixes.add(token.substring(0, i));
        if (prefixes.size >= maxPrefixes) return Array.from(prefixes);
      }
    }
  }
  return Array.from(prefixes);
}

async function runBackfill(dryRun: boolean = true) {
  console.log(`Starting backfill for Global Search Fields... (Dry Run: ${dryRun})`);
  
  const batchSize = 100;
  let processed = 0;
  let updated = 0;
  let lastDoc: any = null;
  let hasMore = true;

  while (hasMore) {
    let q = db.collection(GLOBAL_SONGS_COLLECTION)
      .orderBy('__name__')
      .limit(batchSize);

    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }

    const snapshot = await q.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    const batch = db.batch();
    let batchUpdates = 0;

    for (const doc of snapshot.docs) {
      processed++;
      const data = doc.data();

      // Skip if already version 1
      if (data.searchVersion === 1) {
        continue;
      }

      const actualTitle = String(data.title || '').trim();
      const actualArtist = String(data.artist || '').trim();
      const actualVersion = String(data.version || '').trim();
      const actualLyrics = String(data.lyrics || data.cleanLyrics || '').trim();
      const actualAliases = String(data.aliases || data.keywords || '').trim();

      const titleNormalized = normalizeSearchText(actualTitle);
      const artistNormalized = normalizeSearchText(actualArtist);
      const versionNormalized = normalizeSearchText(actualVersion);
      const lyricsNormalized = normalizeSearchText(actualLyrics);
      const aliasesNormalized = normalizeSearchText(actualAliases);

      const keyNormalized = normalizeMusicalKey(data.key);
      const originalKeyNormalized = normalizeMusicalKey(data.originalKey);
      const selectedKeyNormalized = normalizeMusicalKey(data.selectedKey);

      const titleTokens = titleNormalized ? titleNormalized.split(" ") : [];
      const artistTokens = artistNormalized ? artistNormalized.split(" ") : [];
      const lyricsTokens = lyricsNormalized ? lyricsNormalized.split(" ") : [];
      const versionTokens = versionNormalized ? versionNormalized.split(" ") : [];
      const aliasesTokens = aliasesNormalized ? aliasesNormalized.split(" ") : [];

      const keyTokens = new Set<string>();
      if (keyNormalized) keyTokens.add(keyNormalized);
      if (originalKeyNormalized) keyTokens.add(originalKeyNormalized);
      if (selectedKeyNormalized) keyTokens.add(selectedKeyNormalized);

      const searchKeyTokens = Array.from(keyTokens);
      const stopWords = new Set(["o", "a", "e", "é", "do", "da", "de", "no", "na", "os", "as", "um", "uns", "com", "que", "para", "por"]);

      const allTokens = new Set<string>();
      
      titleTokens.forEach(t => allTokens.add(t));
      artistTokens.forEach(t => allTokens.add(t));
      versionTokens.forEach(t => allTokens.add(t));
      aliasesTokens.forEach(t => allTokens.add(t));
      searchKeyTokens.forEach(t => allTokens.add(t.toLowerCase()));

      lyricsTokens.forEach(t => {
        if (t.length > 2 && !stopWords.has(t)) {
          allTokens.add(t);
        }
      });

      const searchTokens = Array.from(allTokens).filter(t => t.length > 0).slice(0, 150);
      const searchTitlePrefixes = buildPrefixes(titleTokens, 3, 25);
      const searchArtistPrefixes = buildPrefixes(artistTokens, 3, 15);

      const updateData = {
        searchVersion: 1,
        searchTokens,
        searchTitlePrefixes,
        searchArtistPrefixes,
        searchKeyTokens
      };

      if (!dryRun) {
        batch.update(doc.ref, updateData);
      }
      batchUpdates++;
      updated++;
    }

    if (!dryRun && batchUpdates > 0) {
      await batch.commit();
      console.log(`Committed batch of ${batchUpdates} updates.`);
    } else if (dryRun && batchUpdates > 0) {
      console.log(`[DRY RUN] Would commit batch of ${batchUpdates} updates.`);
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  console.log(`Backfill complete. Processed: ${processed}, Updated (or would update): ${updated}`);
}

// Execute
const isDryRun = !process.argv.includes('--execute');
runBackfill(isDryRun).catch(console.error);
