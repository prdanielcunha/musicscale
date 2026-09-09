import type { HomeEventSummary, HomeEventSongSummary } from './homeExperience';

export const PREPARATION_HORIZON_DAYS = 7;

export type PreparationChangeCode =
  | 'song-added'
  | 'song-removed'
  | 'song-key-changed'
  | 'song-order-changed'
  | 'time-changed'
  | 'location-changed'
  | 'role-changed';

export interface PreparationSongSnapshot {
  id: string;
  title: string;
  order: number;
  effectiveKey: string;
}

export interface PreparationSnapshot {
  scaleId: string;
  date: string;
  time: string | null;
  locationName: string | null;
  userFunctionNames: string[];
  songs: PreparationSongSnapshot[];
  fingerprint: string;
}

export interface PreparationChange {
  code: PreparationChangeCode;
  entityId?: string;
  label: string;
  from?: string | number | null;
  to?: string | number | null;
}

export interface StoredPreparationState {
  organizationId: string;
  scaleId: string;
  acknowledgedFingerprint: string;
  acknowledgedSnapshot: PreparationSnapshot;
  preparedFingerprint?: string | null;
  acknowledgedAtMs?: number | null;
  preparedAtMs?: number | null;
}

export type PreparationStatus =
  | 'preparing'
  | 'prepared'
  | 'needs-review';

export interface EventPreparationView {
  event: HomeEventSummary;
  snapshot: PreparationSnapshot;
  status: PreparationStatus;
  changes: PreparationChange[];
}

export function getEffectivePreparationKey(song: HomeEventSongSummary): string {
  return (
    song.localKey ||
    song.selectedKey ||
    song.key ||
    song.originalKey ||
    ''
  ).trim();
}

function stableHash(value: string): string {
  // FNV-1a style 32-bit hash: deterministic, tiny and browser-safe.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createPreparationSnapshot(
  event: HomeEventSummary
): PreparationSnapshot {
  const userFunctionNames = [...event.userFunctionNames]
    .map(value => String(value).trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const songs = [...(event.songs || [])]
    .map(song => ({
      id: song.id,
      title: song.title,
      order: song.order,
      effectiveKey: getEffectivePreparationKey(song),
    }))
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const canonical = JSON.stringify({
    scaleId: event.id,
    date: event.date,
    time: event.time || null,
    locationName: event.locationName || null,
    userFunctionNames,
    songs,
  });

  return {
    scaleId: event.id,
    date: event.date,
    time: event.time || null,
    locationName: event.locationName || null,
    userFunctionNames,
    songs,
    fingerprint: stableHash(canonical),
  };
}

export function diffPreparationSnapshots(
  previous: PreparationSnapshot,
  current: PreparationSnapshot
): PreparationChange[] {
  const changes: PreparationChange[] = [];

  if ((previous.time || null) !== (current.time || null)) {
    changes.push({
      code: 'time-changed',
      label: 'event-time',
      from: previous.time || null,
      to: current.time || null,
    });
  }

  if ((previous.locationName || null) !== (current.locationName || null)) {
    changes.push({
      code: 'location-changed',
      label: 'event-location',
      from: previous.locationName || null,
      to: current.locationName || null,
    });
  }

  const previousRoles = previous.userFunctionNames.join('|');
  const currentRoles = current.userFunctionNames.join('|');
  if (previousRoles !== currentRoles) {
    changes.push({
      code: 'role-changed',
      label: 'user-role',
      from: previous.userFunctionNames.join(', '),
      to: current.userFunctionNames.join(', '),
    });
  }

  const previousSongs = new Map(previous.songs.map(song => [song.id, song]));
  const currentSongs = new Map(current.songs.map(song => [song.id, song]));

  current.songs.forEach(song => {
    const before = previousSongs.get(song.id);
    if (!before) {
      changes.push({
        code: 'song-added',
        entityId: song.id,
        label: song.title,
        to: song.order,
      });
      return;
    }

    if (before.effectiveKey !== song.effectiveKey) {
      changes.push({
        code: 'song-key-changed',
        entityId: song.id,
        label: song.title,
        from: before.effectiveKey || null,
        to: song.effectiveKey || null,
      });
    }

    if (before.order !== song.order) {
      changes.push({
        code: 'song-order-changed',
        entityId: song.id,
        label: song.title,
        from: before.order,
        to: song.order,
      });
    }
  });

  previous.songs.forEach(song => {
    if (!currentSongs.has(song.id)) {
      changes.push({
        code: 'song-removed',
        entityId: song.id,
        label: song.title,
        from: song.order,
      });
    }
  });

  const rank: Record<PreparationChangeCode, number> = {
    'song-added': 1,
    'song-removed': 2,
    'song-key-changed': 3,
    'song-order-changed': 4,
    'role-changed': 5,
    'time-changed': 6,
    'location-changed': 7,
  };

  return changes.sort((a, b) => {
    const rankDelta = rank[a.code] - rank[b.code];
    if (rankDelta !== 0) return rankDelta;
    return a.label.localeCompare(b.label);
  });
}

export function isEventWithinPreparationHorizon(
  event: HomeEventSummary,
  nowMillis: number,
  horizonDays = PREPARATION_HORIZON_DAYS
): boolean {
  if (!event.isUserAssigned) return false;
  if (event.status === 'draft' || event.status === 'cancelled' || event.status === 'completed') {
    return false;
  }

  const horizonEnd = nowMillis + horizonDays * 24 * 60 * 60 * 1000;

  if (typeof event.startAtMillis === 'number') {
    return event.startAtMillis <= horizonEnd;
  }

  const fallback = Date.parse(`${event.date}T23:59:59`);
  return Number.isFinite(fallback) && fallback <= horizonEnd && fallback >= nowMillis - 24 * 60 * 60 * 1000;
}

export function getPersonalPreparationEvents(
  events: HomeEventSummary[],
  nowMillis: number = Date.now(),
  horizonDays = PREPARATION_HORIZON_DAYS
): HomeEventSummary[] {
  return events
    .filter(event => isEventWithinPreparationHorizon(event, nowMillis, horizonDays))
    .sort((a, b) => {
      const aStart = a.startAtMillis ?? Date.parse(`${a.date}T${a.time || '23:59'}:00`);
      const bStart = b.startAtMillis ?? Date.parse(`${b.date}T${b.time || '23:59'}:00`);
      return aStart - bStart;
    });
}

export function buildPreparationView(
  event: HomeEventSummary,
  storedState?: StoredPreparationState | null
): EventPreparationView {
  const snapshot = createPreparationSnapshot(event);
  const changes = storedState?.acknowledgedSnapshot
    ? diffPreparationSnapshots(storedState.acknowledgedSnapshot, snapshot)
    : [];

  let status: PreparationStatus = 'preparing';

  if (changes.length > 0) {
    status = 'needs-review';
  } else if (
    storedState?.preparedFingerprint &&
    storedState.preparedFingerprint === snapshot.fingerprint
  ) {
    status = 'prepared';
  } else if (
    storedState?.preparedFingerprint &&
    storedState.preparedFingerprint !== snapshot.fingerprint
  ) {
    status = 'needs-review';
  }

  return {
    event,
    snapshot,
    status,
    changes,
  };
}
