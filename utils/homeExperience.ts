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
  durationMinutes?: number | null;
  startAtMillis?: number | null;
  endAtMillis?: number | null;
  eventTemporalState?: 'upcoming' | 'in-progress' | 'ended' | 'unscheduled';
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
export const DEFAULT_EVENT_DURATION_MINUTES = 120;

export function parseLocalEventStart(date: string, time: string | null | undefined): Date | null {
  if (!isValidDateOnlyKey(date)) return null;
  if (!time || typeof time !== 'string') return null;

  if (!/^\d{2}:\d{2}$/.test(time)) return null;

  const [yearStr, monthStr, dayStr] = date.split('-');
  const [hourStr, minStr] = time.split(':');

  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);
  const hour = parseInt(hourStr, 10);
  const min = parseInt(minStr, 10);

  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hour) || isNaN(min)) return null;

  if (hour < 0 || hour > 23) return null;
  if (min < 0 || min > 59) return null;

  const testDate = new Date(year, month - 1, day, hour, min, 0, 0);
  if (
    testDate.getFullYear() !== year ||
    testDate.getMonth() !== month - 1 ||
    testDate.getDate() !== day ||
    testDate.getHours() !== hour ||
    testDate.getMinutes() !== min
  ) {
    return null;
  }

  return testDate;
}

export function resolveEventDurationMinutes(durationMinutes: number | null | undefined): number {
  if (
    typeof durationMinutes === 'number' &&
    Number.isFinite(durationMinutes) &&
    Number.isInteger(durationMinutes) &&
    durationMinutes > 0 &&
    durationMinutes <= 1440
  ) {
    return durationMinutes;
  }
  return DEFAULT_EVENT_DURATION_MINUTES;
}

export function getEventEndMillis(startAtMillis: number | null | undefined, durationMinutes: number): number | null {
  if (typeof startAtMillis !== 'number') return null;
  return startAtMillis + durationMinutes * 60 * 1000;
}

export function getEventTemporalState(
  event: Pick<HomeEventSummary, 'startAtMillis' | 'endAtMillis'>,
  nowMillis: number
): 'upcoming' | 'in-progress' | 'ended' | 'unscheduled' {
  if (typeof event.startAtMillis !== 'number' || typeof event.endAtMillis !== 'number') {
    return 'unscheduled';
  }

  if (nowMillis >= event.endAtMillis) {
    return 'ended';
  }
  if (nowMillis >= event.startAtMillis) {
    return 'in-progress';
  }

  return 'upcoming';
}

export function isEventVisibleOnHome(
  event: Pick<HomeEventSummary, 'startAtMillis' | 'endAtMillis'>,
  nowMillis: number
): boolean {
  const state = getEventTemporalState(event, nowMillis);
  return state !== 'ended';
}


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
  todayKey?: string,
  nowMillis: number = Date.now()
): HomeEventSummary[] {
  const summaries: HomeEventSummary[] = [];
  const validTodayKey = isValidDateOnlyKey(todayKey) ? todayKey : getLocalDateKey(new Date(nowMillis));

  const bandScalesMap = new Map<string, PopulatedBandScaleWithStatus>();
  bandScales.forEach((b) => {
    if (b.id) bandScalesMap.set(b.id, b);
  });

  const activeMusicScales = musicScales.filter((s) => s.status !== 'cancelled' && s.status !== 'completed' && s.status !== 'draft');
  const musicScaleIds = new Set(activeMusicScales.map((s) => s.id));

  activeMusicScales.forEach((scale) => {
    if (!isValidDateOnlyKey(scale.date)) return;

    const startObj = parseLocalEventStart(scale.date, scale.time);
    const startAtMillis = startObj ? startObj.getTime() : null;
    const durationMinutes = resolveEventDurationMinutes(scale.durationMinutes);
    const endAtMillis = getEventEndMillis(startAtMillis, durationMinutes);
    const eventTemporalState = getEventTemporalState({ startAtMillis, endAtMillis }, nowMillis);

    if (startAtMillis !== null && endAtMillis !== null) {
      if (nowMillis >= endAtMillis) return;
    } else {
      if (scale.date < validTodayKey) return;
    }

    const title = scale.eventName?.name || scale.eventType?.name || '';
    const locationName = scale.location?.name;
    const songCount = scale.songs ? scale.songs.length : 0;

    let teamCount = 0;
    let isUserAssigned = false;
    let userFunctionNames: string[] = [];

    const activeAssignments = (scale.eventAssignments || []).filter((a) => a.active !== false);

    if (scale.bandScaleId && bandScalesMap.has(scale.bandScaleId)) {
      const linkedBand = bandScalesMap.get(scale.bandScaleId)!;
      const linkedAssignments = (linkedBand.assignments || []).filter((a) => (a as any).active !== false);
      const uniqueBandUsers = new Set(
        linkedAssignments.map((a) => a.user?.uid).filter(Boolean)
      );
      teamCount = uniqueBandUsers.size;

      const userAssignments = linkedAssignments.filter((a) => a.user?.uid === currentUserId);
      isUserAssigned = userAssignments.length > 0;
      userFunctionNames = Array.from(
        new Set(userAssignments.map((a) => a.instrument?.name).filter(Boolean))
      ) as string[];
    } else {
      const uniqueUserIds = new Set(activeAssignments.map((a) => a.userId));
      teamCount = uniqueUserIds.size;

      const userAssignments = activeAssignments.filter((a) => a.userId === currentUserId);
      isUserAssigned = userAssignments.length > 0;
      userFunctionNames = Array.from(
        new Set(userAssignments.map((a) => a.functionName).filter(Boolean))
      ) as string[];
    }

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
      durationMinutes,
      startAtMillis,
      endAtMillis,
      eventTemporalState,
    });
  });

  const activeBandScales = bandScales.filter((s) => s.status !== 'cancelled' && s.status !== 'completed' && s.status !== 'draft');

  activeBandScales.forEach((scale) => {
    if (!isValidDateOnlyKey(scale.date)) return;

    const startObj = parseLocalEventStart(scale.date, scale.time);
    const startAtMillis = startObj ? startObj.getTime() : null;
    const durationMinutes = resolveEventDurationMinutes(undefined);
    const endAtMillis = getEventEndMillis(startAtMillis, durationMinutes);
    const eventTemporalState = getEventTemporalState({ startAtMillis, endAtMillis }, nowMillis);

    if (scale.musicScaleId && musicScaleIds.has(scale.musicScaleId)) return;

    if (startAtMillis !== null && endAtMillis !== null) {
      if (nowMillis >= endAtMillis) return;
    } else {
      if (scale.date < validTodayKey) return;
    }

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
      durationMinutes,
      startAtMillis,
      endAtMillis,
      eventTemporalState,
    });
  });

  return [...summaries].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    if (typeof a.startAtMillis === 'number' && typeof b.startAtMillis === 'number') {
      return a.startAtMillis - b.startAtMillis;
    }
    const timeA = a.time || '00:00';
    const timeB = b.time || '00:00';
    return timeA.localeCompare(timeB);
  });
}

function rawToSummary(
  candidate: DraftCandidate,
  currentUserId?: string,
  bandScales: PopulatedBandScaleWithStatus[] = []
): HomeEventSummary {
  const bandScalesMap = new Map<string, PopulatedBandScaleWithStatus>();
  bandScales.forEach((b) => {
    if (b.id) bandScalesMap.set(b.id, b);
  });

  if (candidate.type === 'music') {
    const raw = candidate.value;
    const title = raw.eventName?.name || raw.eventType?.name || '';
    const locationName = raw.location?.name;
    const activeAssignments = (raw.eventAssignments || []).filter((a) => a.active !== false);

    let teamCount = 0;
    let isUserAssigned = false;
    let userFunctionNames: string[] = [];

    if (raw.bandScaleId && bandScalesMap.has(raw.bandScaleId)) {
      const linkedBand = bandScalesMap.get(raw.bandScaleId)!;
      const linkedAssignments = (linkedBand.assignments || []).filter((a) => (a as any).active !== false);
      const uniqueBandUsers = new Set(
        linkedAssignments.map((a) => a.user?.uid).filter(Boolean)
      );
      teamCount = uniqueBandUsers.size;

      const userAssignments = linkedAssignments.filter((a) => a.user?.uid === currentUserId);
      isUserAssigned = userAssignments.length > 0;
      userFunctionNames = Array.from(
        new Set(userAssignments.map((a) => a.instrument?.name).filter(Boolean))
      ) as string[];
    } else {
      const uniqueUserIds = new Set(activeAssignments.map((a) => a.userId));
      teamCount = uniqueUserIds.size;

      const userAssignments = activeAssignments.filter((a) => a.userId === currentUserId);
      isUserAssigned = userAssignments.length > 0;
      userFunctionNames = Array.from(
        new Set(userAssignments.map((a) => a.functionName).filter(Boolean))
      ) as string[];
    }
    
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
      teamCount,
      status: raw.status,
      userFunctionNames,
      isUserAssigned,
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

  return rawToSummary(sorted[0], currentUserId, bandScales);
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

export type HomeAttentionFocusTarget =
  | 'event-time'
  | 'event-location'
  | 'band-selector'
  | 'band-formation'
  | 'repertoire-selector';

export type HomeAttentionTarget =
  | {
      action: 'edit-music-scale';
      step: 'event' | 'link' | 'build' | 'review';
      focusTarget?: HomeAttentionFocusTarget;
    }
  | {
      action: 'edit-band-scale';
      step: 'event' | 'link' | 'build' | 'review';
      focusTarget?: HomeAttentionFocusTarget;
    }
  | {
      action: 'open-music-scale-details';
    }
  | {
      action: 'open-band-scale-details';
    };

export function resolveHomeAttentionTarget(params: {
  event: HomeEventSummary | null;
  attentionItem: HomeAttentionItem | null;
  musicScale?: any | null;
  linkedBandScale?: any | null;
}): HomeAttentionTarget {
  if (!params.event || !params.attentionItem) {
    console.warn("Missing event or attentionItem in resolveHomeAttentionTarget");
    return { action: 'open-music-scale-details' };
  }

  const { event, attentionItem, musicScale, linkedBandScale } = params;

  if (event.type === 'music') {
    switch (attentionItem.code) {
      case 'missing-repertoire':
        return {
          action: 'edit-music-scale',
          step: 'build',
          focusTarget: 'repertoire-selector',
        };
      case 'missing-team': {
        if (!musicScale || !musicScale.bandScaleId) {
          return {
            action: 'edit-music-scale',
            step: 'link',
            focusTarget: 'band-selector',
          };
        } else {
          if (linkedBandScale) {
            const assignments = linkedBandScale.assignments || [];
            if (assignments.length === 0) {
              return {
                action: 'edit-band-scale',
                step: 'build',
                focusTarget: 'band-formation',
              };
            }
          }
          return {
            action: 'edit-music-scale',
            step: 'link',
            focusTarget: 'band-selector',
          };
        }
      }
      case 'missing-time':
        return {
          action: 'edit-music-scale',
          step: 'event',
          focusTarget: 'event-time',
        };
      case 'missing-location':
        return {
          action: 'edit-music-scale',
          step: 'event',
          focusTarget: 'event-location',
        };
      default:
        console.warn(`Unknown attention code ${attentionItem.code} for music event`);
        return { action: 'open-music-scale-details' };
    }
  } else if (event.type === 'band') {
    switch (attentionItem.code) {
      case 'missing-team':
        return {
          action: 'edit-band-scale',
          step: 'build',
          focusTarget: 'band-formation',
        };
      case 'missing-time':
        return {
          action: 'edit-band-scale',
          step: 'event',
          focusTarget: 'event-time',
        };
      case 'missing-location':
        return {
          action: 'edit-band-scale',
          step: 'event',
          focusTarget: 'event-location',
        };
      default:
        console.warn(`Unknown attention code ${attentionItem.code} for band event`);
        return { action: 'open-band-scale-details' };
    }
  }

  return { action: 'open-music-scale-details' };
}
