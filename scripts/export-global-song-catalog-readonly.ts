import fs from 'node:fs';
import path from 'node:path';
import { admin, adminDb } from '../services/firebaseAdmin.js';

type CatalogSong = {
  id: string;
  title: string;
  artist: string;
  normalizedTitle: string;
  normalizedArtist: string;
  key: string;
  bpm: number | null;
  chordsUrl: string;
  videoUrl: string;
  language: string;
  status: string;
  importCount: number;
  source: string;
  createdAt: string | null;
  lastModifiedAt: string | null;
};

const EXPECTED_PROJECT_ID = 'millionsnest';
const OUTPUT_DIR = path.resolve('tmp/firestore-audit');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'globalSongs.catalog.json');

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asIso(value: any): string | null {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === 'string') return value;
  return null;
}

async function main(): Promise<void> {
  if (!adminDb) throw new Error('FIRESTORE_ADMIN_UNAVAILABLE');

  const actualProjectId = String(admin.app().options.projectId || '');
  if (actualProjectId !== EXPECTED_PROJECT_ID) {
    throw new Error(`PROJECT_MISMATCH:${actualProjectId || 'unknown'}`);
  }

  // Deliberately read-only. There is no Firestore write operation in this script.
  const snapshot = await adminDb.collection('globalSongs').get();
  const songs: CatalogSong[] = snapshot.docs.map((doc) => {
    const data = doc.data() || {};
    return {
      id: doc.id,
      title: asString(data.title),
      artist: asString(data.artist),
      normalizedTitle: asString(data.normalizedTitle),
      normalizedArtist: asString(data.normalizedArtist),
      key: asString(data.key),
      bpm: asFiniteNumber(data.bpm),
      chordsUrl: asString(data.chordsUrl),
      videoUrl: asString(data.videoUrl),
      language: asString(data.language),
      status: asString(data.status),
      importCount: asFiniteNumber(data.importCount) ?? 0,
      source: asString(data.source),
      createdAt: asIso(data.createdAt),
      lastModifiedAt: asIso(data.lastModifiedAt),
    };
  });

  songs.sort((a, b) => {
    const title = a.normalizedTitle.localeCompare(b.normalizedTitle, 'pt-BR');
    return title !== 0 ? title : a.normalizedArtist.localeCompare(b.normalizedArtist, 'pt-BR');
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify({
      schemaVersion: 1,
      projectId: actualProjectId,
      collection: 'globalSongs',
      generatedAt: new Date().toISOString(),
      readOnly: true,
      excludedSensitiveOrHeavyFields: ['lyrics', 'chords', 'createdBy', 'lastModifiedBy'],
      total: songs.length,
      songs,
    }, null, 2) + '\n',
    'utf8',
  );

  console.log(`MUSICSCALE_GLOBAL_CATALOG_READONLY_OK total=${songs.length} output=${OUTPUT_FILE}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[export-global-song-catalog-readonly] ${message}`);
  process.exitCode = 1;
});
