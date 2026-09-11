import { describe, expect, it } from 'vitest';
import { buildScaleCloneDraft, normalizeCloneBandAssignments, ScaleCloneError } from '../../utils/scaleClone';
import { buildHomeEventSummaries } from '../../utils/homeExperience';
import { buildTeamAttentionEntries } from '../../utils/teamAttention';
import { isActiveMembershipStatus } from '../../services/server/scale/musicScaleCommandService';

function sourceScale(overrides: any = {}) {
  return {
    id: 'music-old',
    date: '2026-09-01',
    time: '20:00',
    observations: 'Notas da música',
    songs: [
      { id: 'song-a', title: 'A', artist: 'X' },
      { id: 'song-b', title: 'B', artist: 'Y' },
    ],
    songSettings: {
      'song-a': { key: 'A', bpm: 72 },
      'song-b': { key: 'C', bpm: 80 },
    },
    eventType: { id: 'type-culto', name: 'Culto' },
    eventName: { id: 'name-milagres', name: 'Culto dos Milagres' },
    location: { id: 'loc-cambe', name: 'Cambé' },
    bandScaleId: 'band-old',
    bandScale: {
      id: 'band-old',
      date: '2026-09-01',
      time: '20:00',
      observations: 'Notas da banda',
      assignments: Array.from({ length: 7 }, (_, index) => ({
        user: { uid: 'user-' + (index + 1) },
        instrument: { id: 'instrument-' + (index + 1) },
      })),
      eventType: { id: 'type-culto', name: 'Culto' },
      location: { id: 'loc-cambe', name: 'Cambé' },
    },
    createdBy: { uid: 'owner' },
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  } as any;
}

describe('scale clone hotfix', () => {
  it('normalizes seven populated band assignments without losing members', () => {
    const draft = buildScaleCloneDraft(sourceScale(), '2026-09-20');
    expect(draft.assignments).toHaveLength(7);
    expect(draft.assignments[0]).toEqual({ userId: 'user-1', instrumentId: 'instrument-1' });
  });

  it('preserves repertoire order and local song settings', () => {
    const source = sourceScale();
    const snapshot = JSON.stringify(source);
    const draft = buildScaleCloneDraft(source, '2026-09-20');
    expect(draft.songIds).toEqual(['song-a', 'song-b']);
    expect(draft.songSettings['song-a']).toMatchObject({ key: 'A', bpm: 72 });
    expect(JSON.stringify(source)).toBe(snapshot);
  });

  it('supports music-only scales', () => {
    const draft = buildScaleCloneDraft(sourceScale({ bandScale: null, bandScaleId: null }), '2026-09-20');
    expect(draft.assignments).toEqual([]);
  });

  it('fails closed when any source band assignment cannot be normalized', () => {
    expect(() => normalizeCloneBandAssignments([
      { user: { uid: 'valid' }, instrument: { id: 'keyboard' } },
      { user: { uid: 'invalid' }, instrument: {} },
    ])).toThrow(ScaleCloneError);
  });
});

describe('publish membership compatibility', () => {
  it.each(['active', 'ativo', 'ACTIVE', 'Ativo'])('accepts active membership status %s', status => {
    expect(isActiveMembershipStatus(status)).toBe(true);
  });
  it.each(['inactive', 'pending', '', undefined])('rejects non-active membership status %s', status => {
    expect(isActiveMembershipStatus(status)).toBe(false);
  });
});

describe('dashboard logical event dedupe', () => {
  it('does not expose a linked band scale as standalone while its music scale is a draft', () => {
    const music = sourceScale({ status: 'draft', date: '2026-09-20' });
    const band = {
      ...music.bandScale,
      id: 'band-old',
      date: '2026-09-20',
      musicScaleId: 'music-old',
      status: 'published',
    } as any;
    const result = buildHomeEventSummaries([music], [band], 'user-1', '2026-09-11', new Date('2026-09-11T12:00:00').getTime());
    expect(result).toEqual([]);
  });

  it('collapses only exact cross-type attention duplicates and prefers music', () => {
    const base = {
      title: 'Santa Ceia', date: '2026-09-20', time: '19:00', locationName: 'Cambé',
      songCount: 1, teamCount: 0, status: 'published', userFunctionNames: [], isUserAssigned: false,
      startAtMillis: new Date('2026-09-20T19:00:00').getTime(), endAtMillis: new Date('2026-09-20T21:00:00').getTime(),
    } as any;
    const entries = buildTeamAttentionEntries([
      { ...base, id: 'music-1', type: 'music' },
      { ...base, id: 'band-1', type: 'band', songCount: 0 },
    ], true, new Date('2026-09-11T12:00:00').getTime());
    expect(entries).toHaveLength(1);
    expect(entries[0].event.type).toBe('music');
  });

  it('keeps two same-type simultaneous events visible', () => {
    const base = {
      title: 'Santa Ceia', type: 'music', date: '2026-09-20', time: '19:00', locationName: 'Cambé',
      songCount: 1, teamCount: 0, status: 'published', userFunctionNames: [], isUserAssigned: false,
      startAtMillis: new Date('2026-09-20T19:00:00').getTime(), endAtMillis: new Date('2026-09-20T21:00:00').getTime(),
    } as any;
    const entries = buildTeamAttentionEntries([
      { ...base, id: 'music-1' },
      { ...base, id: 'music-2' },
    ], true, new Date('2026-09-11T12:00:00').getTime());
    expect(entries).toHaveLength(2);
  });
});
