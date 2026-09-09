import { describe, expect, it } from 'vitest';
import type { Scale } from '../../types';
import { buildPreparationPublishChangeSummary } from '../../services/server/scale/preparationChangeSummary';

function scale(overrides: Partial<Scale> = {}): Scale {
  return {
    id: 'scale-1',
    organizationId: 'org-1',
    date: '2026-09-13',
    time: '19:00',
    eventTypeId: 'event-type-1',
    eventNameId: 'event-name-1',
    locationId: 'location-1',
    observations: 'Chegar com antecedência',
    songIds: ['song-1', 'song-2'],
    songSettings: {
      'song-1': { key: 'G', bpm: 72 },
      'song-2': { key: 'D', bpm: 80 },
    },
    durationMinutes: 90,
    status: 'published',
    publishRevision: 2,
    createdBy: {
      uid: 'u1',
      name: 'Leader',
      displayName: 'Leader',
      photoURL: null,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Preparation publish change summary', () => {
  it('returns an empty summary for identical preparation facts', () => {
    const summary = buildPreparationPublishChangeSummary(scale(), scale());

    expect(summary.changed).toBe(false);
    expect(summary.codes).toEqual([]);
    expect(summary.songs.added).toEqual([]);
    expect(summary.songs.removed).toEqual([]);
  });

  it('captures exact repertoire and musical changes', () => {
    const before = scale();
    const after = scale({
      songIds: ['song-2', 'song-3'],
      songSettings: {
        'song-2': { key: 'E', bpm: 82 },
        'song-3': { key: 'A', bpm: 70 },
      },
    });

    const summary = buildPreparationPublishChangeSummary(before, after);

    expect(summary.changed).toBe(true);
    expect(summary.songs.added).toEqual(['song-3']);
    expect(summary.songs.removed).toEqual(['song-1']);
    expect(summary.songs.reordered).toEqual([
      { songId: 'song-2', from: 2, to: 1 },
    ]);
    expect(summary.songs.keyChanged).toEqual([
      { songId: 'song-2', from: 'D', to: 'E' },
    ]);
    expect(summary.songs.bpmChanged).toEqual([
      { songId: 'song-2', from: 80, to: 82 },
    ]);
    expect(summary.codes).toEqual(
      expect.arrayContaining([
        'song_added',
        'song_removed',
        'song_reordered',
        'song_key_changed',
        'song_bpm_changed',
      ])
    );
  });

  it('captures preparation-relevant event context without storing notes content', () => {
    const before = scale();
    const after = scale({
      date: '2026-09-14',
      time: '20:00',
      locationId: 'location-2',
      eventTypeId: 'event-type-2',
      eventNameId: 'event-name-2',
      observations: 'Nova orientação sensível',
      durationMinutes: 75,
    });

    const summary = buildPreparationPublishChangeSummary(before, after);

    expect(summary.event.date).toEqual({
      from: '2026-09-13',
      to: '2026-09-14',
    });
    expect(summary.event.time).toEqual({ from: '19:00', to: '20:00' });
    expect(summary.event.locationId).toEqual({
      from: 'location-1',
      to: 'location-2',
    });
    expect(summary.event.eventTypeId).toEqual({
      from: 'event-type-1',
      to: 'event-type-2',
    });
    expect(summary.event.eventNameId).toEqual({
      from: 'event-name-1',
      to: 'event-name-2',
    });
    expect(summary.event.durationMinutes).toEqual({ from: 90, to: 75 });
    expect(summary.event.notesChanged).toBe(true);
    expect(JSON.stringify(summary)).not.toContain('Nova orientação sensível');
    expect(JSON.stringify(summary)).not.toContain('Chegar com antecedência');
  });
});
