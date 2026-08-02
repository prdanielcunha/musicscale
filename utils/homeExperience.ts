import type { PopulatedScale, PopulatedBandScale, EventAssignment, UserProfile, Instrument } from '../types';

export type PopulatedScaleWithAssignments = PopulatedScale & {
  eventAssignments?: EventAssignment[];
};

export type PopulatedBandScaleWithStatus = PopulatedBandScale & {
  status?: string | null;
  updatedAt?: any;
  createdAt?: any;
  lastModifiedAt?: any;
  assignments?: { user?: UserProfile; instrument?: Instrument }[];
};

export type PopulatedScaleWithAssignmentsAndStatus = PopulatedScaleWithAssignments & {
  status?: string | null;
  updatedAt?: any;
  createdAt?: any;
  lastModifiedAt?: any;
};

export type DraftCandidate =
  | { type: 'music'; value: PopulatedScaleWithAssignmentsAndStatus }
  | { type: 'band'; value: PopulatedBandScaleWithStatus };

export type HomeExperienceMode =
  | 'first-value'
  | 'assigned-event'
  | 'continue-draft'
  | 'leader-attention'
  | 'leader-prepared'
  | 'observer-event'
  | 'create-next-event'
  | 'no-upcoming-event';

export type HomeAttentionCode =
  | 'draft'
  | 'missing-repertoire'
  | 'missing-team'
  | 'missing-time'
  | 'missing-location';

export interface HomeAttentionItem {
  code: HomeAttentionCode;
  severity: 'important' | 'warning' | 'info';
}

export interface HomeEventSongSummary {
  id: string;
  title: string;
  order: number;
  localKey?: string | null;
  selectedKey?: string | null;
  key?: string | null;
  originalKey?: string | null;
}

export interface HomeEventSummary {
  id: string;
  type: 'music' | 'band';
  title: string;
  date: string;
  time?: string | null;
  locationName?: string | null;
  songCount: number;
  teamCount: number;
  status?: string | null;
  userFunctionNames: string[];
  isUserAssigned: boolean;
  songs?: HomeEventSongSummary[];
}

export interface HomeExperience {
  mode: HomeExperienceMode;
  event: HomeEventSummary | null;
  draftEvent: HomeEventSummary | null;
  attentionItems: HomeAttentionItem[];
  canManageScales: boolean;
  isUserAssigned: boolean;
}

interface EvaluateHomeInput {
  isFirstValueJourneyActive: boolean;
  canManageScales: boolean;
  upcomingEvents: HomeEventSummary[];
  mostRecentDraft: HomeEventSummary | null;
  currentUserId: string | undefined;
}

// Helpers puros (REQUISITO 9)
export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateOnlyKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function toEpochMillis(value: unknown): number {
  if (!value) return 0;
  try {
    if (typeof (value as any).toMillis === 'function') {
      const ms = (value as any).toMillis();
      if (typeof ms === 'number' && Number.isFinite(ms)) return ms;
    }
    if (typeof (value as any).toDate === 'function') {
      const ms = (value as any).toDate().getTime();
      if (typeof ms === 'number' && Number.isFinite(ms)) return ms;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const ms = new Date(value).getTime();
      return isNaN(ms) ? 0 : ms;
    }
    if (value instanceof Date) {
      const ms = value.getTime();
      return isNaN(ms) ? 0 : ms;
    }
    if (typeof value === 'object' && value !== null && 'seconds' in value) {
      const sec = (value as any).seconds;
      if (typeof sec === 'number' && Number.isFinite(sec)) return sec * 1000;
    }
  } catch {
    return 0;
  }
  return 0;
}

export function getHomeAttentionItems(
  event: HomeEventSummary,
  canManageScales: boolean
): HomeAttentionItem[] {
  if (!canManageScales) return [];
  const attentionItems: HomeAttentionItem[] = [];

  if (event.status === 'draft') {
    attentionItems.push({ code: 'draft', severity: 'important' });
  }

  if (event.type === 'music' && event.songCount === 0) {
    attentionItems.push({ code: 'missing-repertoire', severity: 'important' });
  }

  if (event.teamCount === 0) attentionItems.push({ code: 'missing-team', severity: 'warning' });
  if (!event.time) attentionItems.push({ code: 'missing-time', severity: 'info' });
  if (!event.locationName) attentionItems.push({ code: 'missing-location', severity: 'info' });

  return attentionItems;
}

export function buildHomeEventSummaries(
  musicScales: PopulatedScaleWithAssignmentsAndStatus[],
  bandScales: PopulatedBandScaleWithStatus[],
  currentUserId?: string,
  todayKey: string = getLocalDateKey()
): HomeEventSummary[] {
  const summaries: HomeEventSummary[] = [];
  const validTodayKey = isValidDateOnlyKey(todayKey) ? todayKey : getLocalDateKey();

  const activeMusicScales = musicScales.filter((s) => s.status !== 'cancelled' && s.status !== 'draft');
  const musicScaleIds = new Set(activeMusicScales.map((s) => s.id));

  activeMusicScales.forEach((scale) => {
    if (!isValidDateOnlyKey(scale.date)) return;
    if (scale.date < validTodayKey) return;

    const title = scale.eventName?.name || scale.eventType?.name || '';
    const locationName = scale.location?.name;
    const songCount = scale.songs ? scale.songs.length : 0;

    const activeAssignments = (scale.eventAssignments || []).filter((a) => a.active !== false);
    const uniqueUserIds = new Set(activeAssignments.map((a) => a.userId));
    const teamCount = uniqueUserIds.size;

    const userAssignments = activeAssignments.filter((a) => a.userId === currentUserId);
    const isUserAssigned = userAssignments.length > 0;
    const userFunctionNames = Array.from(
      new Set(userAssignments.map((a) => a.functionName).filter(Boolean))
    ) as string[];

    const songs = (scale.songs || []).map((song, index) => {
      const localSettings = scale.songSettings?.[song.id];
      return {
        id: song.id,
        title: song.title,
        selectedKey: song.selectedKey || null,
        key: song.key || null,
        originalKey: song.originalKey || null,
        localKey: localSettings?.key || null,
        order: index + 1,
      };
    });

    summaries.push({
      id: scale.id,
      type: 'music',
      title,
      date: scale.date,
      time: scale.time,
      locationName,
      songCount,
      teamCount,
      status: scale.status,
      userFunctionNames,
      isUserAssigned,
      songs,
    });
  });

  const activeBandScales = bandScales.filter((s) => s.status !== 'cancelled' && s.status !== 'draft');

  activeBandScales.forEach((scale) => {
    if (!isValidDateOnlyKey(scale.date)) return;
    if (scale.date < validTodayKey) return;
    if (scale.musicScaleId && musicScaleIds.has(scale.musicScaleId)) return;

    const title = scale.eventName?.name || scale.eventType?.name || '';
    const locationName = scale.location?.name;
    const songCount = 0;

    const assignments = scale.assignments || [];
    const uniqueUserIds = new Set(
      assignments.map((a) => a.user?.uid).filter(Boolean)
    );
    const teamCount = uniqueUserIds.size;

    const userAssignments = assignments.filter((a) => a.user?.uid === currentUserId);
    const isUserAssigned = userAssignments.length > 0;
    const userFunctionNames = Array.from(
      new Set(userAssignments.map((a) => a.instrument?.name).filter(Boolean))
    ) as string[];

    summaries.push({
      id: scale.id,
      type: 'band',
      title,
      date: scale.date,
      time: scale.time,
      locationName,
      songCount,
      teamCount,
      status: scale.status,
      userFunctionNames,
      isUserAssigned,
    });
  });

  return [...summaries].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    const timeA = a.time || '00:00';
    const timeB = b.time || '00:00';
    return timeA.localeCompare(timeB);
  });
}

function rawToSummary(candidate: DraftCandidate, currentUserId?: string): HomeEventSummary {
  if (candidate.type === 'music') {
    const raw = candidate.value;
    const title = raw.eventName?.name || raw.eventType?.name || '';
    const locationName = raw.location?.name;
    const activeAssignments = (raw.eventAssignments || []).filter((a) => a.active !== false);
    const uniqueUserIds = new Set(activeAssignments.map((a) => a.userId));
    const userAssignments = activeAssignments.filter((a) => a.userId === currentUserId);
    
    const songs = (raw.songs || []).map((song, index) => {
      const localSettings = raw.songSettings?.[song.id];
      return {
        id: song.id,
        title: song.title,
        selectedKey: song.selectedKey || null,
        key: song.key || null,
        originalKey: song.originalKey || null,
        localKey: localSettings?.key || null,
        order: index + 1,
      };
    });

    return {
      id: raw.id,
      type: 'music',
      title,
      date: raw.date || '',
      time: raw.time,
      locationName,
      songCount: raw.songs ? raw.songs.length : 0,
      teamCount: uniqueUserIds.size,
      status: raw.status,
      userFunctionNames: Array.from(new Set(userAssignments.map((a) => a.functionName).filter(Boolean))) as string[],
      isUserAssigned: userAssignments.length > 0,
      songs,
    };
  } else {
    const raw = candidate.value;
    const title = raw.eventName?.name || raw.eventType?.name || '';
    const locationName = raw.location?.name;
    const assignments = raw.assignments || [];
    const uniqueUserIds = new Set(assignments.map((a) => a.user?.uid).filter(Boolean));
    const userAssignments = assignments.filter((a) => a.user?.uid === currentUserId);
    
    return {
      id: raw.id,
      type: 'band',
      title,
      date: raw.date || '',
      time: raw.time,
      locationName,
      songCount: 0,
      teamCount: uniqueUserIds.size,
      status: raw.status,
      userFunctionNames: Array.from(new Set(userAssignments.map((a) => a.instrument?.name).filter(Boolean))) as string[],
      isUserAssigned: userAssignments.length > 0,
    };
  }
}

export function selectMostRecentDraft(
  musicScales: PopulatedScaleWithAssignmentsAndStatus[],
  bandScales: PopulatedBandScaleWithStatus[],
  currentUserId?: string
): HomeEventSummary | null {
  const allEvents: DraftCandidate[] = [
    ...musicScales.map(s => ({ type: 'music' as const, value: s })),
    ...bandScales.map(s => ({ type: 'band' as const, value: s }))
  ];

  const drafts = allEvents.filter((c) => c.value.status === 'draft');
  if (drafts.length === 0) return null;

  const sorted = [...drafts].sort((a, b) => {
    const getMs = (val: any) => toEpochMillis(val);
    
    const timeA = getMs(a.value.lastModifiedAt) || getMs(a.value.updatedAt) || getMs(a.value.createdAt) || 0;
    const timeB = getMs(b.value.lastModifiedAt) || getMs(b.value.updatedAt) || getMs(b.value.createdAt) || 0;
    
    return timeB - timeA;
  });

  return rawToSummary(sorted[0], currentUserId);
}

export function evaluateHomeExperience(input: EvaluateHomeInput): HomeExperience {
  const { isFirstValueJourneyActive, canManageScales, upcomingEvents, mostRecentDraft } = input;

  if (isFirstValueJourneyActive) {
    return {
      mode: 'first-value',
      event: null,
      draftEvent: null,
      attentionItems: [],
      canManageScales,
      isUserAssigned: false,
    };
  }

  const nextAssignedEvent = upcomingEvents.find(event => event.isUserAssigned);
  const nextEvent = upcomingEvents[0] || null;

  if (nextAssignedEvent) {
    const attentionItems = getHomeAttentionItems(nextAssignedEvent, canManageScales);
    return {
      mode: 'assigned-event',
      event: nextAssignedEvent,
      draftEvent: mostRecentDraft,
      attentionItems,
      canManageScales,
      isUserAssigned: true,
    };
  }

  if (canManageScales && mostRecentDraft) {
    return {
      mode: 'continue-draft',
      event: nextEvent,
      draftEvent: mostRecentDraft,
      attentionItems: [{ code: 'draft', severity: 'important' }],
      canManageScales,
      isUserAssigned: false,
    };
  }

  if (nextEvent && canManageScales) {
    const attentionItems = getHomeAttentionItems(nextEvent, canManageScales);
    
    if (attentionItems.length > 0) {
      return {
        mode: 'leader-attention',
        event: nextEvent,
        draftEvent: null,
        attentionItems,
        canManageScales,
        isUserAssigned: false,
      };
    } else {
      return {
        mode: 'leader-prepared',
        event: nextEvent,
        draftEvent: null,
        attentionItems: [],
        canManageScales,
        isUserAssigned: false,
      };
    }
  }

  if (nextEvent && !canManageScales) {
    return {
      mode: 'observer-event',
      event: nextEvent,
      draftEvent: null,
      attentionItems: [],
      canManageScales,
      isUserAssigned: false,
    };
  }

  if (!nextEvent && canManageScales) {
    return {
      mode: 'create-next-event',
      event: null,
      draftEvent: null,
      attentionItems: [],
      canManageScales,
      isUserAssigned: false,
    };
  }

  return {
    mode: 'no-upcoming-event',
    event: null,
    draftEvent: null,
    attentionItems: [],
    canManageScales,
    isUserAssigned: false,
  };
}

export function canUsePerformanceMode(
  event: HomeEventSummary | null,
  hasPermission: boolean
): boolean {
  if (!event) return false;
  // 1. houver repertório
  if (event.type !== 'music' || event.songCount === 0) return false;
  // 2. o usuário tiver permissão / entitlement
  if (!hasPermission) return false;
  // 3. o evento estiver em estado válido
  const status = event.status;
  if (status !== 'published' && status !== 'prepared') {
    return false;
  }

  return true;
}
