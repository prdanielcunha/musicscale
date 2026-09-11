import type { BandMember, PopulatedScale, ScaleSongSettings } from '../types';
import { normalizeScaleSongSettings } from './scaleSongSettings';

export class ScaleCloneError extends Error {
  readonly code: 'INVALID_BAND_ASSIGNMENT';
  readonly invalidAssignmentIndexes: number[];

  constructor(invalidAssignmentIndexes: number[]) {
    super('A equipe da escala original possui integrante ou função inválida. Revise a equipe antes de criar a cópia.');
    this.name = 'ScaleCloneError';
    this.code = 'INVALID_BAND_ASSIGNMENT';
    this.invalidAssignmentIndexes = invalidAssignmentIndexes;
  }
}

export interface ScaleCloneDraft {
  date: string;
  time: string;
  timeZone: string;
  eventTypeId: string;
  eventNameId: string | null;
  locationId: string;
  observations: string;
  bandObservations: string;
  durationMinutes?: number;
  songIds: string[];
  songSettings: Record<string, ScaleSongSettings>;
  assignments: BandMember[];
}

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeCloneBandAssignments(assignments: unknown): BandMember[] {
  if (!Array.isArray(assignments) || assignments.length === 0) return [];

  const normalized: BandMember[] = [];
  const invalidAssignmentIndexes: number[] = [];

  assignments.forEach((raw, index) => {
    const assignment = (raw || {}) as any;
    const userId = assignment.userId || assignment.user?.uid || assignment.user?.id || '';
    const instrumentId = assignment.instrumentId || assignment.instrument?.id || '';

    if (typeof userId !== 'string' || !userId.trim() || typeof instrumentId !== 'string' || !instrumentId.trim()) {
      invalidAssignmentIndexes.push(index);
      return;
    }

    normalized.push({ userId: userId.trim(), instrumentId: instrumentId.trim() });
  });

  if (invalidAssignmentIndexes.length > 0) {
    throw new ScaleCloneError(invalidAssignmentIndexes);
  }

  return normalized;
}

export function buildScaleCloneDraft(
  scale: PopulatedScale,
  newDate: string = getLocalDateKey()
): ScaleCloneDraft {
  const songIds = (scale.songs || []).map(song => song.id).filter(Boolean);
  const assignments = scale.bandScale
    ? normalizeCloneBandAssignments(scale.bandScale.assignments)
    : [];

  return {
    date: newDate,
    time: scale.time || '',
    timeZone: (scale as any).timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo',
    eventTypeId: scale.eventType?.id || (scale as any).eventTypeId || '',
    eventNameId: scale.eventName?.id || (scale as any).eventNameId || null,
    locationId: scale.location?.id || (scale as any).locationId || '',
    observations: scale.observations || '',
    bandObservations: scale.bandScale?.observations || '',
    durationMinutes: scale.durationMinutes,
    songIds,
    songSettings: normalizeScaleSongSettings(songIds, scale.songSettings || {}),
    assignments,
  };
}
