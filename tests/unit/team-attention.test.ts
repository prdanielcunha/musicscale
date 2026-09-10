import { describe, expect, it } from 'vitest';
import type { HomeEventSummary } from '../../utils/homeExperience';
import {
  buildTeamAttentionEntries,
  TEAM_ATTENTION_HORIZON_DAYS,
} from '../../utils/teamAttention';

function event(
  overrides: Partial<HomeEventSummary> = {}
): HomeEventSummary {
  return {
    id: 'event-1',
    type: 'music',
    title: 'Sunday Service',
    date: '2026-09-13',
    time: '19:00',
    locationName: 'Main Hall',
    songCount: 5,
    teamCount: 4,
    status: 'published',
    userFunctionNames: [],
    isUserAssigned: false,
    startAtMillis: new Date('2026-09-13T19:00:00').getTime(),
    ...overrides,
  };
}

describe('Team Attention', () => {
  const now = new Date('2026-09-09T07:00:00').getTime();

  it('returns no leadership signal without scale management capability', () => {
    expect(
      buildTeamAttentionEntries(
        [event({ songCount: 0 })],
        false,
        now
      )
    ).toEqual([]);
  });

  it('surfaces only factual issues inside the leadership horizon', () => {
    const healthy = event({ id: 'healthy' });
    const missingRepertoire = event({
      id: 'missing-repertoire',
      songCount: 0,
    });
    const farAway = event({
      id: 'far-away',
      date: '2026-10-20',
      startAtMillis: new Date('2026-10-20T19:00:00').getTime(),
      teamCount: 0,
    });

    const entries = buildTeamAttentionEntries(
      [healthy, farAway, missingRepertoire],
      true,
      now
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].event.id).toBe('missing-repertoire');
    expect(entries[0].primaryAttention.code).toBe('missing-repertoire');
  });

  it('keeps the most recent draft visible even without a scheduled start', () => {
    const draft = event({
      id: 'draft',
      status: 'draft',
      date: '',
      time: null,
      startAtMillis: null,
    });

    const entries = buildTeamAttentionEntries(
      [draft],
      true,
      now
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].primaryAttention.code).toBe('draft');
  });

  it('orders important issues before warnings and informational gaps', () => {
    const missingTime = event({
      id: 'missing-time',
      time: null,
      startAtMillis: null,
    });
    const missingTeam = event({
      id: 'missing-team',
      teamCount: 0,
    });
    const missingRepertoire = event({
      id: 'missing-repertoire',
      songCount: 0,
    });

    const entries = buildTeamAttentionEntries(
      [missingTime, missingTeam, missingRepertoire],
      true,
      now,
      TEAM_ATTENTION_HORIZON_DAYS
    );

    expect(entries.map(entry => entry.event.id)).toEqual([
      'missing-repertoire',
      'missing-team',
      'missing-time',
    ]);
  });

  it('deduplicates events and caps home noise', () => {
    const issues = Array.from({ length: 7 }, (_, index) =>
      event({
        id: `issue-${index}`,
        songCount: 0,
        startAtMillis:
          new Date('2026-09-10T19:00:00').getTime() +
          index * 60_000,
      })
    );

    const entries = buildTeamAttentionEntries(
      [issues[0], ...issues, issues[0]],
      true,
      now
    );

    expect(entries).toHaveLength(4);
    expect(new Set(entries.map(entry => entry.event.id)).size).toBe(4);
  });
});
