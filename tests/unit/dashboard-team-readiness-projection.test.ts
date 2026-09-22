import { describe, expect, it } from 'vitest';
import {
  buildHomeEventSummaries,
  getHomeAttentionItems,
} from '../../utils/homeExperience';

describe('dashboard team readiness during progressive BandScale enrichment', () => {
  it('uses published eventAssignments while linked BandScale enrichment is still empty', () => {
    const musicScale = {
      id: 'scale-1',
      date: '2099-09-22',
      time: '20:00',
      status: 'published',
      bandScaleId: 'band-1',
      eventName: { id: 'event-name-1', name: 'Culto' },
      eventType: { id: 'event-type-1', name: 'Culto' },
      location: { id: 'location-1', name: 'Industrial' },
      songIds: ['song-1'],
      songs: [{ id: 'song-1', title: 'A Bênção' }],
      eventAssignments: [{
        eventAssignmentId: 'assignment-1',
        sourceBandScaleId: 'band-1',
        sourceAssignmentId: 'source-1',
        userId: 'member-1',
        functionId: 'keyboard',
        functionName: 'Teclado',
        functionCategory: 'musical_instrument',
        active: true,
        assignmentRevision: 1,
      }],
    };

    const linkedBandScale = {
      id: 'band-1',
      musicScaleId: 'scale-1',
      date: '2099-09-22',
      time: '20:00',
      status: 'published',
      eventType: { id: 'event-type-1', name: 'Culto' },
      location: { id: 'location-1', name: 'Industrial' },
      assignments: [],
    };

    const [summary] = buildHomeEventSummaries(
      [musicScale as any],
      [linkedBandScale as any],
      'member-1',
      '2099-09-21',
      new Date('2099-09-21T12:00:00').getTime(),
    );

    expect(summary).toBeDefined();
    expect(summary.teamCount).toBe(1);
    expect(summary.isUserAssigned).toBe(true);
    expect(summary.userFunctionNames).toEqual(['Teclado']);
    expect(summary.userFunctionCategories).toEqual(['musical_instrument']);
    expect(getHomeAttentionItems(summary, true)).not.toContainEqual(
      expect.objectContaining({ code: 'missing-team' }),
    );
  });
});
