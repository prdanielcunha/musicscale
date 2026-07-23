import type { PopulatedScale, PopulatedBandScale, EventAssignment } from '../types';

export type PopulatedScaleWithAssignments = PopulatedScale & {
  eventAssignments?: EventAssignment[];
};

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

export function buildHomeEventSummaries(
  musicScales: PopulatedScaleWithAssignments[],
  bandScales: PopulatedBandScale[],
  currentUserId?: string
): HomeEventSummary[] {
  const summaries: HomeEventSummary[] = [];
  const todayKey = getLocalDateKey();

  const activeMusicScales = musicScales.filter((s) => (s as any).status !== 'cancelled');
  const musicScaleIds = new Set(activeMusicScales.map((s) => s.id));

  activeMusicScales.forEach((scale) => {
    if (scale.date < todayKey) return;

    const title = scale.eventName?.name || scale.eventType?.name || '';
    const locationName = scale.location?.name;
    const songCount = scale.songs ? scale.songs.length : 0;

    const activeAssignments = (scale.eventAssignments || []).filter((a) => a.active !== false);
    const uniqueUserIds = new Set(activeAssignments.map((a) => a.userId));
    const teamCount = uniqueUserIds.size;

    const userAssignments = activeAssignments.filter((a) => a.userId === currentUserId);
    const isUserAssigned = userAssignments.length > 0;
    const userFunctionNames = Array.from(new Set(userAssignments.map((a) => a.functionName).filter(Boolean))) as string[];

    summaries.push({
      id: scale.id,
      type: 'music',
      title,
      date: scale.date,
      time: scale.time,
      locationName,
      songCount,
      teamCount,
      status: (scale as any).status,
      userFunctionNames,
      isUserAssigned,
    });
  });

  const activeBandScales = bandScales.filter((s) => (s as any).status !== 'cancelled');
  
  activeBandScales.forEach((scale) => {
    if (scale.date < todayKey) return;
    if (scale.musicScaleId && musicScaleIds.has(scale.musicScaleId)) return;

    const title = scale.eventName?.name || scale.eventType?.name || '';
    const locationName = scale.location?.name;
    const songCount = 0; 
    
    const assignments = (scale as any).assignments || [];
    const uniqueUserIds = new Set(
      assignments.map((a: any) => a.user?.uid).filter(Boolean)
    );
    const teamCount = uniqueUserIds.size;

    const userAssignments = assignments.filter((a: any) => a.user?.uid === currentUserId);
    const isUserAssigned = userAssignments.length > 0;
    const userFunctionNames = Array.from(new Set(userAssignments.map((a: any) => a.instrument?.name).filter(Boolean))) as string[];

    summaries.push({
      id: scale.id,
      type: 'band',
      title,
      date: scale.date,
      time: scale.time,
      locationName,
      songCount,
      teamCount,
      status: (scale as any).status,
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

// Helper to convert any raw event into HomeEventSummary to use for drafts
function rawToSummary(raw: any, currentUserId?: string): HomeEventSummary {
  const isMusic = raw.songs !== undefined || raw.eventAssignments !== undefined;
  const title = raw.eventName?.name || raw.eventType?.name || '';
  const locationName = raw.location?.name;
  
  if (isMusic) {
    const activeAssignments = (raw.eventAssignments || []).filter((a: any) => a.active !== false);
    const uniqueUserIds = new Set(activeAssignments.map((a: any) => a.userId));
    const userAssignments = activeAssignments.filter((a: any) => a.userId === currentUserId);
    return {
      id: raw.id,
      type: 'music',
      title,
      date: raw.date,
      time: raw.time,
      locationName,
      songCount: raw.songs ? raw.songs.length : 0,
      teamCount: uniqueUserIds.size,
      status: raw.status,
      userFunctionNames: Array.from(new Set(userAssignments.map((a: any) => a.functionName).filter(Boolean))) as string[],
      isUserAssigned: userAssignments.length > 0,
    };
  } else {
    const assignments = raw.assignments || [];
    const uniqueUserIds = new Set(assignments.map((a: any) => a.user?.uid).filter(Boolean));
    const userAssignments = assignments.filter((a: any) => a.user?.uid === currentUserId);
    return {
      id: raw.id,
      type: 'band',
      title,
      date: raw.date,
      time: raw.time,
      locationName,
      songCount: 0,
      teamCount: uniqueUserIds.size,
      status: raw.status,
      userFunctionNames: Array.from(new Set(userAssignments.map((a: any) => a.instrument?.name).filter(Boolean))) as string[],
      isUserAssigned: userAssignments.length > 0,
    };
  }
}

export function selectMostRecentDraft(
  musicScales: PopulatedScaleWithAssignments[],
  bandScales: PopulatedBandScale[],
  currentUserId?: string
): HomeEventSummary | null {
  const allEvents = [...musicScales, ...bandScales];
  const drafts = allEvents.filter((s) => (s as any).status === 'draft');
  if (drafts.length === 0) return null;
  
  const sorted = [...drafts].sort((a, b) => {
    const getMs = (val: any) => {
      if (!val) return 0;
      if (typeof val.toMillis === 'function') return val.toMillis();
      if (typeof val.toDate === 'function') return val.toDate().getTime();
      if (typeof val === 'string') return new Date(val).getTime();
      if (typeof val === 'number') return val;
      if (val.seconds) return val.seconds * 1000;
      if (val instanceof Date) return val.getTime();
      return 0;
    };
    
    // Check fields in order of preference
    const timeA = getMs((a as any).updatedAt) || getMs(a.createdAt) || 0;
    const timeB = getMs((b as any).updatedAt) || getMs(b.createdAt) || 0;
    
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

  // REQUISITO 8: const nextAssignedEvent = upcomingEvents.find(event => event.isUserAssigned);
  const nextAssignedEvent = upcomingEvents.find(event => event.isUserAssigned);
  const nextEvent = upcomingEvents[0] || null;

  if (nextAssignedEvent) {
    const attentionItems: HomeAttentionItem[] = [];
    if (canManageScales) {
      if (nextAssignedEvent.status === 'draft') attentionItems.push({ code: 'draft', severity: 'important' });
      if (nextAssignedEvent.songCount === 0) attentionItems.push({ code: 'missing-repertoire', severity: 'important' });
      if (nextAssignedEvent.teamCount === 0) attentionItems.push({ code: 'missing-team', severity: 'warning' });
      if (!nextAssignedEvent.time) attentionItems.push({ code: 'missing-time', severity: 'info' });
      if (!nextAssignedEvent.locationName) attentionItems.push({ code: 'missing-location', severity: 'info' });
    }
    return {
      mode: 'assigned-event',
      event: nextAssignedEvent, // Wait, if the user is a leader, should they see pending on the nextAssignedEvent or the first general event? The requirement says: "Para líderes escalados: assigned-event continua prioritário; pendências administrativas pertencem ao evento atribuído exibido."
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
    const attentionItems: HomeAttentionItem[] = [];
    if (nextEvent.status === 'draft') attentionItems.push({ code: 'draft', severity: 'important' });
    if (nextEvent.songCount === 0) attentionItems.push({ code: 'missing-repertoire', severity: 'important' });
    if (nextEvent.teamCount === 0) attentionItems.push({ code: 'missing-team', severity: 'warning' });
    if (!nextEvent.time) attentionItems.push({ code: 'missing-time', severity: 'info' });
    if (!nextEvent.locationName) attentionItems.push({ code: 'missing-location', severity: 'info' });
    
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
