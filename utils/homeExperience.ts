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

  const nextEvent = upcomingEvents[0] || null;
  const isAssignedToNextEvent = nextEvent ? nextEvent.isUserAssigned : false;

  if (nextEvent && isAssignedToNextEvent) {
    const attentionItems: HomeAttentionItem[] = [];
    if (canManageScales) {
      if (nextEvent.status === 'draft') attentionItems.push({ code: 'draft', severity: 'important' });
      if (nextEvent.songCount === 0) attentionItems.push({ code: 'missing-repertoire', severity: 'important' });
      if (nextEvent.teamCount === 0) attentionItems.push({ code: 'missing-team', severity: 'warning' });
      if (!nextEvent.time) attentionItems.push({ code: 'missing-time', severity: 'info' });
      if (!nextEvent.locationName) attentionItems.push({ code: 'missing-location', severity: 'info' });
    }
    return {
      mode: 'assigned-event',
      event: nextEvent,
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
