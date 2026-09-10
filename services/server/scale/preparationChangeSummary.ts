import type { Scale } from '../../../types.js';

export type PreparationPublishChangeCode =
  | 'song_added'
  | 'song_removed'
  | 'song_reordered'
  | 'song_key_changed'
  | 'song_bpm_changed'
  | 'date_changed'
  | 'time_changed'
  | 'location_changed'
  | 'event_changed'
  | 'notes_changed'
  | 'duration_changed';

export interface SongOrderChange {
  songId: string;
  from: number;
  to: number;
}

export interface SongValueChange<T extends string | number | null> {
  songId: string;
  from: T;
  to: T;
}

export interface PreparationPublishChangeSummary {
  version: 1;
  changed: boolean;
  codes: PreparationPublishChangeCode[];
  songs: {
    added: string[];
    removed: string[];
    reordered: SongOrderChange[];
    keyChanged: SongValueChange<string | null>[];
    bpmChanged: SongValueChange<number | null>[];
  };
  event: {
    date: { from: string | null; to: string | null } | null;
    time: { from: string | null; to: string | null } | null;
    locationId: { from: string | null; to: string | null } | null;
    eventTypeId: { from: string | null; to: string | null } | null;
    eventNameId: { from: string | null; to: string | null } | null;
    durationMinutes: { from: number | null; to: number | null } | null;
    notesChanged: boolean;
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nullableFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function orderedUniqueSongIds(scale: Pick<Scale, 'songIds'>): string[] {
  if (!Array.isArray(scale.songIds)) return [];
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const value of scale.songIds) {
    if (typeof value !== 'string' || !value || seen.has(value)) continue;
    seen.add(value);
    ids.push(value);
  }

  return ids;
}

function addCode(
  codes: PreparationPublishChangeCode[],
  code: PreparationPublishChangeCode
) {
  if (!codes.includes(code)) codes.push(code);
}

export function buildPreparationPublishChangeSummary(
  previous: Scale,
  current: Scale
): PreparationPublishChangeSummary {
  const previousIds = orderedUniqueSongIds(previous);
  const currentIds = orderedUniqueSongIds(current);
  const previousSet = new Set(previousIds);
  const currentSet = new Set(currentIds);
  const codes: PreparationPublishChangeCode[] = [];

  const added = currentIds.filter(id => !previousSet.has(id));
  const removed = previousIds.filter(id => !currentSet.has(id));

  if (added.length > 0) addCode(codes, 'song_added');
  if (removed.length > 0) addCode(codes, 'song_removed');

  const reordered: SongOrderChange[] = [];
  const keyChanged: SongValueChange<string | null>[] = [];
  const bpmChanged: SongValueChange<number | null>[] = [];

  currentIds.forEach((songId, currentIndex) => {
    const previousIndex = previousIds.indexOf(songId);
    if (previousIndex < 0) return;

    if (previousIndex !== currentIndex) {
      reordered.push({
        songId,
        from: previousIndex + 1,
        to: currentIndex + 1,
      });
    }

    const previousSettings = previous.songSettings?.[songId] || {};
    const currentSettings = current.songSettings?.[songId] || {};

    const previousKey = nullableString(previousSettings.key);
    const currentKey = nullableString(currentSettings.key);
    if (previousKey !== currentKey) {
      keyChanged.push({
        songId,
        from: previousKey,
        to: currentKey,
      });
    }

    const previousBpm = nullableFiniteNumber(previousSettings.bpm);
    const currentBpm = nullableFiniteNumber(currentSettings.bpm);
    if (previousBpm !== currentBpm) {
      bpmChanged.push({
        songId,
        from: previousBpm,
        to: currentBpm,
      });
    }
  });

  if (reordered.length > 0) addCode(codes, 'song_reordered');
  if (keyChanged.length > 0) addCode(codes, 'song_key_changed');
  if (bpmChanged.length > 0) addCode(codes, 'song_bpm_changed');

  const dateFrom = nullableString(previous.date);
  const dateTo = nullableString(current.date);
  const date = dateFrom !== dateTo ? { from: dateFrom, to: dateTo } : null;
  if (date) addCode(codes, 'date_changed');

  const timeFrom = nullableString(previous.time);
  const timeTo = nullableString(current.time);
  const time = timeFrom !== timeTo ? { from: timeFrom, to: timeTo } : null;
  if (time) addCode(codes, 'time_changed');

  const locationFrom = nullableString(previous.locationId);
  const locationTo = nullableString(current.locationId);
  const locationId = locationFrom !== locationTo
    ? { from: locationFrom, to: locationTo }
    : null;
  if (locationId) addCode(codes, 'location_changed');

  const eventTypeFrom = nullableString(previous.eventTypeId);
  const eventTypeTo = nullableString(current.eventTypeId);
  const eventTypeId = eventTypeFrom !== eventTypeTo
    ? { from: eventTypeFrom, to: eventTypeTo }
    : null;

  const eventNameFrom = nullableString(previous.eventNameId);
  const eventNameTo = nullableString(current.eventNameId);
  const eventNameId = eventNameFrom !== eventNameTo
    ? { from: eventNameFrom, to: eventNameTo }
    : null;

  if (eventTypeId || eventNameId) addCode(codes, 'event_changed');

  const durationFrom = nullableFiniteNumber(previous.durationMinutes);
  const durationTo = nullableFiniteNumber(current.durationMinutes);
  const durationMinutes = durationFrom !== durationTo
    ? { from: durationFrom, to: durationTo }
    : null;
  if (durationMinutes) addCode(codes, 'duration_changed');

  const notesChanged =
    String(previous.observations || '').trim() !==
    String(current.observations || '').trim();
  if (notesChanged) addCode(codes, 'notes_changed');

  return {
    version: 1,
    changed: codes.length > 0,
    codes,
    songs: {
      added,
      removed,
      reordered,
      keyChanged,
      bpmChanged,
    },
    event: {
      date,
      time,
      locationId,
      eventTypeId,
      eventNameId,
      durationMinutes,
      notesChanged,
    },
  };
}
