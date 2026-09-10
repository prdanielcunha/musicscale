import {
  getHomeAttentionItems,
  type HomeAttentionItem,
  type HomeEventSummary,
} from './homeExperience';

export const TEAM_ATTENTION_HORIZON_DAYS = 14;
export const TEAM_ATTENTION_LIMIT = 4;

export interface TeamAttentionEntry {
  event: HomeEventSummary;
  attentionItems: HomeAttentionItem[];
  primaryAttention: HomeAttentionItem;
}

const severityRank: Record<HomeAttentionItem['severity'], number> = {
  important: 3,
  warning: 2,
  info: 1,
};

function eventStart(event: HomeEventSummary): number {
  if (typeof event.startAtMillis === 'number' && Number.isFinite(event.startAtMillis)) {
    return event.startAtMillis;
  }

  const fallback = Date.parse(
    `${event.date}T${event.time || '23:59'}:00`
  );
  return Number.isFinite(fallback) ? fallback : Number.MAX_SAFE_INTEGER;
}

function isInsideLeaderHorizon(
  event: HomeEventSummary,
  nowMillis: number,
  horizonDays: number
): boolean {
  if (event.status === 'draft') return true;
  if (
    event.status === 'cancelled' ||
    event.status === 'completed'
  ) {
    return false;
  }

  const start = eventStart(event);
  if (start === Number.MAX_SAFE_INTEGER) return false;

  const horizonEnd =
    nowMillis + horizonDays * 24 * 60 * 60 * 1000;

  return start <= horizonEnd;
}

export function buildTeamAttentionEntries(
  events: HomeEventSummary[],
  canManageScales: boolean,
  nowMillis: number = Date.now(),
  horizonDays = TEAM_ATTENTION_HORIZON_DAYS,
  limit = TEAM_ATTENTION_LIMIT
): TeamAttentionEntry[] {
  if (!canManageScales) return [];

  const deduped = new Map<string, HomeEventSummary>();
  events.forEach(event => {
    if (!event?.id) return;
    if (!deduped.has(event.id)) deduped.set(event.id, event);
  });

  return Array.from(deduped.values())
    .filter(event =>
      isInsideLeaderHorizon(event, nowMillis, horizonDays)
    )
    .map(event => {
      const attentionItems = getHomeAttentionItems(
        event,
        canManageScales
      );

      const sortedAttention = [...attentionItems].sort((a, b) =>
        severityRank[b.severity] - severityRank[a.severity]
      );

      return {
        event,
        attentionItems: sortedAttention,
        primaryAttention: sortedAttention[0],
      };
    })
    .filter(
      (entry): entry is TeamAttentionEntry =>
        Boolean(entry.primaryAttention)
    )
    .sort((a, b) => {
      const severityDelta =
        severityRank[b.primaryAttention.severity] -
        severityRank[a.primaryAttention.severity];

      if (severityDelta !== 0) return severityDelta;

      return eventStart(a.event) - eventStart(b.event);
    })
    .slice(0, Math.max(0, limit));
}
