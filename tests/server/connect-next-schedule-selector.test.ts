import { describe, expect, it } from 'vitest';
import { selectNextAssignedSchedule } from '../../services/server/connect/nextScheduleSelector';

const NOW = Date.UTC(2026, 8, 10, 18, 0, 0);

function scale(overrides: Record<string, unknown> = {}) {
  return {
    id: 'scale-1',
    organizationId: 'org-1',
    date: '2026-09-11',
    time: '19:00',
    timeZone: 'America/Sao_Paulo',
    durationMinutes: 120,
    status: 'published',
    songIds: ['song-1'],
    eventAssignments: [
      {
        userId: 'user-1',
        functionId: 'voice',
        functionName: 'Voz',
        active: true,
      },
    ],
    ...overrides,
  };
}

describe('selectNextAssignedSchedule', () => {
  it('returns the earliest upcoming active scale assigned directly to the actor', () => {
    const result = selectNextAssignedSchedule({
      organizationId: 'org-1',
      actorUid: 'user-1',
      nowMs: NOW,
      scales: [
        scale({ id: 'later', date: '2026-09-14' }),
        scale({ id: 'next', date: '2026-09-11' }),
      ],
      bandScales: [],
    });

    expect(result?.scale.id).toBe('next');
    expect(result?.assignmentSource).toBe('event_assignment');
    expect(result?.functionNames).toEqual(['Voz']);
  });

  it('uses linked BandScale assignments when the linked tenant-safe BandScale exists', () => {
    const result = selectNextAssignedSchedule({
      organizationId: 'org-1',
      actorUid: 'user-1',
      nowMs: NOW,
      scales: [
        scale({
          id: 'linked',
          bandScaleId: 'band-1',
          eventAssignments: [{ userId: 'someone-else', active: true }],
        }),
      ],
      bandScales: [
        {
          id: 'band-1',
          organizationId: 'org-1',
          assignments: [{ userId: 'user-1', instrumentId: 'keys', active: true }],
        },
      ],
    });

    expect(result?.scale.id).toBe('linked');
    expect(result?.assignmentSource).toBe('band_scale');
    expect(result?.functionNames).toEqual(['keys']);
  });

  it('does not fall back to eventAssignments when a valid linked BandScale exists but actor is not assigned there', () => {
    const result = selectNextAssignedSchedule({
      organizationId: 'org-1',
      actorUid: 'user-1',
      nowMs: NOW,
      scales: [
        scale({
          bandScaleId: 'band-1',
          eventAssignments: [{ userId: 'user-1', functionName: 'Voz', active: true }],
        }),
      ],
      bandScales: [
        {
          id: 'band-1',
          organizationId: 'org-1',
          assignments: [{ userId: 'someone-else', instrumentId: 'drums', active: true }],
        },
      ],
    });

    expect(result).toBeNull();
  });

  it('fails closed across tenant boundaries for both scale and linked BandScale', () => {
    const result = selectNextAssignedSchedule({
      organizationId: 'org-1',
      actorUid: 'user-1',
      nowMs: NOW,
      scales: [
        scale({ id: 'foreign-scale', organizationId: 'org-2' }),
        scale({
          id: 'local-scale',
          bandScaleId: 'foreign-band',
          eventAssignments: [],
        }),
      ],
      bandScales: [
        {
          id: 'foreign-band',
          organizationId: 'org-2',
          assignments: [{ userId: 'user-1', instrumentId: 'keys', active: true }],
        },
      ],
    });

    expect(result).toBeNull();
  });

  it('excludes draft, cancelled and completed scales', () => {
    const result = selectNextAssignedSchedule({
      organizationId: 'org-1',
      actorUid: 'user-1',
      nowMs: NOW,
      scales: [
        scale({ id: 'draft', status: 'draft' }),
        scale({ id: 'cancelled', status: 'cancelled' }),
        scale({ id: 'completed', status: 'completed' }),
      ],
      bandScales: [],
    });

    expect(result).toBeNull();
  });

  it('keeps an in-progress event visible and drops it after its duration', () => {
    const inProgress = scale({
      id: 'today',
      date: '2026-09-10',
      time: '14:00',
      durationMinutes: 120,
    });

    const at1530SaoPaulo = Date.UTC(2026, 8, 10, 18, 30, 0);
    const at1630SaoPaulo = Date.UTC(2026, 8, 10, 19, 30, 0);

    expect(
      selectNextAssignedSchedule({
        organizationId: 'org-1',
        actorUid: 'user-1',
        nowMs: at1530SaoPaulo,
        scales: [inProgress],
        bandScales: [],
      })?.scale.id,
    ).toBe('today');

    expect(
      selectNextAssignedSchedule({
        organizationId: 'org-1',
        actorUid: 'user-1',
        nowMs: at1630SaoPaulo,
        scales: [inProgress],
        bandScales: [],
      }),
    ).toBeNull();
  });

  it('ignores inactive assignments', () => {
    const result = selectNextAssignedSchedule({
      organizationId: 'org-1',
      actorUid: 'user-1',
      nowMs: NOW,
      scales: [
        scale({
          eventAssignments: [{ userId: 'user-1', functionName: 'Voz', active: false }],
        }),
      ],
      bandScales: [],
    });

    expect(result).toBeNull();
  });
});
