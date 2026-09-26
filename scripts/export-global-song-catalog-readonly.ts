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

type RecentScaleDiagnostic = {
  id: string;
  organizationId: string;
  status: string;
  date: string;
  hasEventTypeId: boolean;
  hasLocationId: boolean;
  songCount: number;
  medleyCount: number;
  medleyStepCount: number;
  hasBandScale: boolean;
  bandScaleId: string | null;
  publishRevision: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type BandScaleDiagnostic = {
  id: string;
  exists: boolean;
  organizationId: string;
  assignmentCount: number;
  invalidAssignmentCount: number;
};

type OrganizationPublishFlagDiagnostic = {
  id: string;
  publishCommandV1FeatureFlag: boolean | null;
  publishCommandV1Feature: boolean | null;
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

  // Production incident diagnostics. Read-only and intentionally excludes names,
  // observations, lyrics/chords, notification bodies and user profile fields.
  const scaleSnapshot = await adminDb.collection('scales').get();
  const recentScales: RecentScaleDiagnostic[] = scaleSnapshot.docs.map((doc) => {
    const data = doc.data() || {};
    const medleys = Array.isArray(data.medleys) ? data.medleys : [];
    return {
      id: doc.id,
      organizationId: asString(data.organizationId),
      status: asString(data.status),
      date: asString(data.date),
      hasEventTypeId: Boolean(asString(data.eventTypeId)),
      hasLocationId: Boolean(asString(data.locationId)),
      songCount: Array.isArray(data.songIds) ? data.songIds.length : 0,
      medleyCount: medleys.length,
      medleyStepCount: medleys.reduce((total: number, medley: any) =>
        total + (Array.isArray(medley?.steps) ? medley.steps.length : 0), 0),
      hasBandScale: Boolean(asString(data.bandScaleId)),
      bandScaleId: asString(data.bandScaleId) || null,
      publishRevision: asFiniteNumber(data.publishRevision),
      createdAt: asIso(data.createdAt),
      updatedAt: asIso(data.updatedAt),
    };
  }).sort((a, b) => {
    const aTime = Date.parse(a.updatedAt || a.createdAt || '1970-01-01T00:00:00.000Z');
    const bTime = Date.parse(b.updatedAt || b.createdAt || '1970-01-01T00:00:00.000Z');
    return bTime - aTime;
  }).slice(0, 60);

  const bandIds = Array.from(new Set(recentScales.map((scale) => scale.bandScaleId).filter(Boolean))) as string[];
  const bandScales: BandScaleDiagnostic[] = await Promise.all(bandIds.map(async (id) => {
    const snap = await adminDb.collection('bandScales').doc(id).get();
    if (!snap.exists) return { id, exists: false, organizationId: '', assignmentCount: 0, invalidAssignmentCount: 0 };
    const data = snap.data() || {};
    const assignments = Array.isArray(data.assignments) ? data.assignments : [];
    return {
      id,
      exists: true,
      organizationId: asString(data.organizationId),
      assignmentCount: assignments.length,
      invalidAssignmentCount: assignments.filter((assignment: any) =>
        !asString(assignment?.userId) || !asString(assignment?.instrumentId)).length,
    };
  }));

  const organizationIds = Array.from(new Set(recentScales.map((scale) => scale.organizationId).filter(Boolean)));
  const organizationPublishFlags: OrganizationPublishFlagDiagnostic[] = await Promise.all(organizationIds.map(async (id) => {
    const snap = await adminDb.collection('organizations').doc(id).get();
    const data = snap.exists ? (snap.data() || {}) : {};
    const featureFlags = data.featureFlags && typeof data.featureFlags === 'object' ? data.featureFlags : {};
    const features = data.features && typeof data.features === 'object' ? data.features : {};
    const flagValue = (featureFlags as Record<string, unknown>)['musicscale.musicScalePublishCommandV1'];
    const featureValue = (features as Record<string, unknown>)['musicscale.musicScalePublishCommandV1'];
    return {
      id,
      publishCommandV1FeatureFlag: typeof flagValue === 'boolean' ? flagValue : null,
      publishCommandV1Feature: typeof featureValue === 'boolean' ? featureValue : null,
    };
  }));

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
      productionScaleDiagnostics: {
        generatedForIncident: 'music-scale-stuck-as-draft',
        recentScales,
        bandScales,
        organizationPublishFlags,
      },
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
