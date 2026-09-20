import { describe, expect, it } from 'vitest';
import {
  evaluateServeGuard,
  normalizeServeGuardPreference,
  type ServeGuardPreference,
  type ServeGuardScaleInput,
} from '../../services/server/serveGuard/serveGuardPolicy';

const ORG = 'org_serveguard';
const USER = 'user_serveguard';

function preference(
  overrides: Partial<ServeGuardPreference> = {},
): ServeGuardPreference {
  return {
    schemaVersion: 1,
    organizationId: ORG,
    userId: USER,
    maxServicesPerWeek: 2,
    maxServicesPerMonth: 6,
    unavailableDates: [],
    pausedUntil: null,
    ...overrides,
  };
}

function scale(
  id: string,
  date: string,
  status: ServeGuardScaleInput['status'] = 'published',
  assignments: ServeGuardScaleInput['eventAssignments'] = [
    { userId: USER, active: true },
  ],
): ServeGuardScaleInput {
  return {
    id,
    organizationId: ORG,
    date,
    status,
    eventAssignments: assignments,
  };
}

describe('ServeGuard policy engine', () => {
  it('normalizes a valid preference and rejects invalid or duplicate dates', () => {
    const normalized = normalizeServeGuardPreference({
      organizationId: ORG,
      userId: USER,
      maxServicesPerWeek: 2,
      maxServicesPerMonth: 8,
      unavailableDates: ['2026-09-21', '2026-09-25'],
      pausedUntil: '2026-10-01',
    });

    expect(normalized).toMatchObject({
      organizationId: ORG,
      userId: USER,
      maxServicesPerWeek: 2,
      maxServicesPerMonth: 8,
      unavailableDates: ['2026-09-21', '2026-09-25'],
      pausedUntil: '2026-10-01',
    });

    expect(
      normalizeServeGuardPreference({
        organizationId: ORG,
        userId: USER,
        maxServicesPerWeek: 0,
        unavailableDates: [],
      }),
    ).toBeNull();

    expect(
      normalizeServeGuardPreference({
        organizationId: ORG,
        userId: USER,
        unavailableDates: ['2026-09-21', '2026-09-21'],
      }),
    ).toBeNull();

    expect(
      normalizeServeGuardPreference({
        organizationId: ORG,
        userId: USER,
        unavailableDates: ['2026-02-30'],
      }),
    ).toBeNull();
  });

  it('counts one service per event even when one person has multiple functions', () => {
    const result = evaluateServeGuard({
      organizationId: ORG,
      userId: USER,
      candidateDate: '2026-09-23',
      preference: preference(),
      scales: [
        scale('scale-1', '2026-09-21', 'published', [
          { userId: USER, active: true },
          { userId: USER, active: true },
        ]),
      ],
    });

    expect(result?.scheduledLoad.week.current).toBe(1);
    expect(result?.scheduledLoad.week.projected).toBe(2);
    expect(result?.primarySignal).toBe('at_weekly_limit');
    expect(result?.requiresExplicitOverride).toBe(false);
  });

  it('ignores draft, cancelled, inactive and cross-tenant assignments', () => {
    const result = evaluateServeGuard({
      organizationId: ORG,
      userId: USER,
      candidateDate: '2026-09-23',
      preference: preference({ maxServicesPerWeek: 1 }),
      scales: [
        scale('draft', '2026-09-21', 'draft'),
        scale('cancelled', '2026-09-22', 'cancelled'),
        scale('inactive', '2026-09-22', 'published', [
          { userId: USER, active: false },
        ]),
        {
          ...scale('other-org', '2026-09-22'),
          organizationId: 'other-org',
        },
      ],
    });

    expect(result?.scheduledLoad.week.current).toBe(0);
    expect(result?.scheduledLoad.week.projected).toBe(1);
    expect(result?.primarySignal).toBe('at_weekly_limit');
  });

  it('flags a prospective weekly limit breach without silently blocking', () => {
    const result = evaluateServeGuard({
      organizationId: ORG,
      userId: USER,
      candidateDate: '2026-09-24',
      preference: preference({ maxServicesPerWeek: 2 }),
      scales: [
        scale('scale-1', '2026-09-21'),
        scale('scale-2', '2026-09-23'),
      ],
    });

    expect(result?.primarySignal).toBe('over_weekly_limit');
    expect(result?.scheduledLoad.week).toEqual({
      current: 2,
      projected: 3,
      limit: 2,
    });
    expect(result?.requiresExplicitOverride).toBe(true);
    expect(result?.advisoryOnly).toBe(true);
  });

  it('flags a monthly limit independently from the weekly window', () => {
    const result = evaluateServeGuard({
      organizationId: ORG,
      userId: USER,
      candidateDate: '2026-09-28',
      preference: preference({
        maxServicesPerWeek: 5,
        maxServicesPerMonth: 2,
      }),
      scales: [
        scale('scale-1', '2026-09-03'),
        scale('scale-2', '2026-09-14'),
      ],
    });

    expect(result?.scheduledLoad.week.current).toBe(0);
    expect(result?.scheduledLoad.month.current).toBe(2);
    expect(result?.primarySignal).toBe('over_monthly_limit');
    expect(result?.requiresExplicitOverride).toBe(true);
  });

  it('treats explicit unavailability and pause as stronger signals than load', () => {
    const unavailable = evaluateServeGuard({
      organizationId: ORG,
      userId: USER,
      candidateDate: '2026-09-27',
      preference: preference({
        unavailableDates: ['2026-09-27'],
        maxServicesPerWeek: 1,
      }),
      scales: [],
    });

    expect(unavailable?.primarySignal).toBe('unavailable');
    expect(unavailable?.requiresExplicitOverride).toBe(true);

    const paused = evaluateServeGuard({
      organizationId: ORG,
      userId: USER,
      candidateDate: '2026-09-27',
      preference: preference({
        pausedUntil: '2026-09-30',
        unavailableDates: ['2026-09-27'],
      }),
      scales: [],
    });

    expect(paused?.primarySignal).toBe('paused');
    expect(paused?.signals).toContain('unavailable');
    expect(paused?.requiresExplicitOverride).toBe(true);
  });

  it('does not fabricate an overload when the person has no configured preference', () => {
    const result = evaluateServeGuard({
      organizationId: ORG,
      userId: USER,
      candidateDate: '2026-09-27',
      preference: null,
      scales: [
        scale('scale-1', '2026-09-21'),
        scale('scale-2', '2026-09-23'),
        scale('scale-3', '2026-09-25'),
      ],
    });

    expect(result?.primarySignal).toBe('preference_not_configured');
    expect(result?.requiresExplicitOverride).toBe(false);
    expect(result?.scheduledLoad.week.current).toBe(3);
    expect(result?.scheduledLoad.week.limit).toBeNull();
  });

  it('can exclude the scale being edited so it is not double counted', () => {
    const result = evaluateServeGuard({
      organizationId: ORG,
      userId: USER,
      candidateDate: '2026-09-23',
      preference: preference({ maxServicesPerWeek: 2 }),
      excludeScaleId: 'scale-editing',
      scales: [
        scale('scale-editing', '2026-09-23'),
        scale('scale-other', '2026-09-21'),
      ],
    });

    expect(result?.scheduledLoad.week.current).toBe(1);
    expect(result?.scheduledLoad.week.projected).toBe(2);
    expect(result?.primarySignal).toBe('at_weekly_limit');
  });
});
