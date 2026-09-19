export const SERVE_GUARD_SCHEMA_VERSION = 1 as const;

export interface ServeGuardPreference {
  schemaVersion: typeof SERVE_GUARD_SCHEMA_VERSION;
  organizationId: string;
  userId: string;
  maxServicesPerWeek: number | null;
  maxServicesPerMonth: number | null;
  unavailableDates: string[];
  pausedUntil: string | null;
  updatedAtMs?: number | null;
  updatedBy?: string | null;
}

export interface ServeGuardScaleInput {
  id: string;
  organizationId?: string | null;
  date?: string | null;
  status?: string | null;
  eventAssignments?: readonly {
    userId?: string | null;
    active?: boolean | null;
  }[] | null;
}

export type ServeGuardSignal =
  | 'preference_not_configured'
  | 'clear'
  | 'at_weekly_limit'
  | 'at_monthly_limit'
  | 'over_weekly_limit'
  | 'over_monthly_limit'
  | 'unavailable'
  | 'paused';

export interface ServeGuardEvaluation {
  organizationId: string;
  userId: string;
  candidateDate: string;
  advisoryOnly: true;
  requiresExplicitOverride: boolean;
  primarySignal: ServeGuardSignal;
  signals: ServeGuardSignal[];
  scheduledLoad: {
    week: {
      current: number;
      projected: number;
      limit: number | null;
    };
    month: {
      current: number;
      projected: number;
      limit: number | null;
    };
  };
  availability: {
    unavailableOnCandidateDate: boolean;
    pausedOnCandidateDate: boolean;
    pausedUntil: string | null;
  };
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_UNAVAILABLE_DATES = 90;
const MAX_WEEKLY_LIMIT = 14;
const MAX_MONTHLY_LIMIT = 62;

function cleanId(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRealIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeOptionalLimit(
  value: unknown,
  max: number,
): number | null | undefined {
  if (value === null || value === '' || value === undefined) return null;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > max
  ) {
    return undefined;
  }
  return value;
}

export function normalizeServeGuardPreference(input: {
  organizationId: unknown;
  userId: unknown;
  maxServicesPerWeek?: unknown;
  maxServicesPerMonth?: unknown;
  unavailableDates?: unknown;
  pausedUntil?: unknown;
  updatedAtMs?: unknown;
  updatedBy?: unknown;
}): ServeGuardPreference | null {
  const organizationId = cleanId(input.organizationId);
  const userId = cleanId(input.userId);
  if (!organizationId || !userId) return null;

  const maxServicesPerWeek = normalizeOptionalLimit(
    input.maxServicesPerWeek,
    MAX_WEEKLY_LIMIT,
  );
  const maxServicesPerMonth = normalizeOptionalLimit(
    input.maxServicesPerMonth,
    MAX_MONTHLY_LIMIT,
  );

  if (
    maxServicesPerWeek === undefined ||
    maxServicesPerMonth === undefined
  ) {
    return null;
  }

  const rawUnavailable = input.unavailableDates ?? [];
  if (!Array.isArray(rawUnavailable) || rawUnavailable.length > MAX_UNAVAILABLE_DATES) {
    return null;
  }

  const unavailableDates = Array.from(new Set(rawUnavailable))
    .filter((value): value is string => isRealIsoDate(value))
    .sort();

  if (unavailableDates.length !== rawUnavailable.length) {
    return null;
  }

  const pausedUntil =
    input.pausedUntil === null ||
    input.pausedUntil === '' ||
    input.pausedUntil === undefined
      ? null
      : isRealIsoDate(input.pausedUntil)
        ? input.pausedUntil
        : undefined;

  if (pausedUntil === undefined) return null;

  const updatedAtMs =
    typeof input.updatedAtMs === 'number' &&
    Number.isFinite(input.updatedAtMs) &&
    input.updatedAtMs >= 0
      ? input.updatedAtMs
      : null;

  const updatedBy = cleanId(input.updatedBy) || null;

  return {
    schemaVersion: SERVE_GUARD_SCHEMA_VERSION,
    organizationId,
    userId,
    maxServicesPerWeek,
    maxServicesPerMonth,
    unavailableDates,
    pausedUntil,
    updatedAtMs,
    updatedBy,
  };
}

function startOfMondayUtc(dateText: string): number {
  const [year, month, day] = dateText.split('-').map(Number);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const weekday = candidate.getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  candidate.setUTCDate(candidate.getUTCDate() - daysSinceMonday);
  candidate.setUTCHours(0, 0, 0, 0);
  return candidate.getTime();
}

function isSameWeek(dateText: string, candidateDate: string): boolean {
  return startOfMondayUtc(dateText) === startOfMondayUtc(candidateDate);
}

function isSameMonth(dateText: string, candidateDate: string): boolean {
  return dateText.slice(0, 7) === candidateDate.slice(0, 7);
}

function isEligibleScheduledScale(scale: ServeGuardScaleInput): boolean {
  const status = String(scale.status || '').trim().toLowerCase();
  return status === 'published' || status === 'completed';
}

function isUserScheduled(
  scale: ServeGuardScaleInput,
  userId: string,
): boolean {
  const assignments = Array.isArray(scale.eventAssignments)
    ? scale.eventAssignments
    : [];

  return assignments.some(
    assignment =>
      assignment?.active !== false &&
      cleanId(assignment?.userId) === userId,
  );
}

/**
 * Counts scheduled services, not attendance or spiritual/health burden.
 *
 * One scale counts once per person even if the same person has multiple active
 * functions in that event. Draft/cancelled scales do not contribute.
 */
export function countServeGuardScheduledLoad(input: {
  organizationId: string;
  userId: string;
  candidateDate: string;
  scales: readonly ServeGuardScaleInput[];
  excludeScaleId?: string | null;
}): { week: number; month: number } {
  const organizationId = cleanId(input.organizationId);
  const userId = cleanId(input.userId);
  if (!organizationId || !userId || !isRealIsoDate(input.candidateDate)) {
    return { week: 0, month: 0 };
  }

  const excludeScaleId = cleanId(input.excludeScaleId);
  let week = 0;
  let month = 0;
  const seenScaleIds = new Set<string>();

  for (const scale of input.scales) {
    const scaleId = cleanId(scale?.id);
    const scaleOrganizationId = cleanId(scale?.organizationId);
    const date = typeof scale?.date === 'string' ? scale.date : '';

    if (
      !scaleId ||
      seenScaleIds.has(scaleId) ||
      scaleId === excludeScaleId ||
      scaleOrganizationId !== organizationId ||
      !isRealIsoDate(date) ||
      !isEligibleScheduledScale(scale) ||
      !isUserScheduled(scale, userId)
    ) {
      continue;
    }

    seenScaleIds.add(scaleId);
    if (isSameWeek(date, input.candidateDate)) week += 1;
    if (isSameMonth(date, input.candidateDate)) month += 1;
  }

  return { week, month };
}

function choosePrimarySignal(signals: ServeGuardSignal[]): ServeGuardSignal {
  const priority: ServeGuardSignal[] = [
    'paused',
    'unavailable',
    'over_weekly_limit',
    'over_monthly_limit',
    'at_weekly_limit',
    'at_monthly_limit',
    'clear',
    'preference_not_configured',
  ];

  return priority.find(signal => signals.includes(signal)) ?? 'clear';
}

/**
 * Prospective, advisory-only ServeGuard evaluation.
 *
 * The candidate service is included in projected load. This function never
 * blocks a scale itself; the caller may require an explicit authorized override
 * when the result says so.
 */
export function evaluateServeGuard(input: {
  organizationId: string;
  userId: string;
  candidateDate: string;
  preference?: ServeGuardPreference | null;
  scales: readonly ServeGuardScaleInput[];
  excludeScaleId?: string | null;
}): ServeGuardEvaluation | null {
  const organizationId = cleanId(input.organizationId);
  const userId = cleanId(input.userId);

  if (!organizationId || !userId || !isRealIsoDate(input.candidateDate)) {
    return null;
  }

  const load = countServeGuardScheduledLoad({
    organizationId,
    userId,
    candidateDate: input.candidateDate,
    scales: input.scales,
    excludeScaleId: input.excludeScaleId,
  });

  const preference =
    input.preference &&
    input.preference.organizationId === organizationId &&
    input.preference.userId === userId
      ? input.preference
      : null;

  if (!preference) {
    return {
      organizationId,
      userId,
      candidateDate: input.candidateDate,
      advisoryOnly: true,
      requiresExplicitOverride: false,
      primarySignal: 'preference_not_configured',
      signals: ['preference_not_configured'],
      scheduledLoad: {
        week: { current: load.week, projected: load.week + 1, limit: null },
        month: { current: load.month, projected: load.month + 1, limit: null },
      },
      availability: {
        unavailableOnCandidateDate: false,
        pausedOnCandidateDate: false,
        pausedUntil: null,
      },
    };
  }

  const weeklyProjected = load.week + 1;
  const monthlyProjected = load.month + 1;
  const unavailableOnCandidateDate =
    preference.unavailableDates.includes(input.candidateDate);
  const pausedOnCandidateDate =
    Boolean(preference.pausedUntil) &&
    input.candidateDate <= (preference.pausedUntil as string);

  const signals: ServeGuardSignal[] = [];

  if (pausedOnCandidateDate) signals.push('paused');
  if (unavailableOnCandidateDate) signals.push('unavailable');

  if (preference.maxServicesPerWeek !== null) {
    if (weeklyProjected > preference.maxServicesPerWeek) {
      signals.push('over_weekly_limit');
    } else if (weeklyProjected === preference.maxServicesPerWeek) {
      signals.push('at_weekly_limit');
    }
  }

  if (preference.maxServicesPerMonth !== null) {
    if (monthlyProjected > preference.maxServicesPerMonth) {
      signals.push('over_monthly_limit');
    } else if (monthlyProjected === preference.maxServicesPerMonth) {
      signals.push('at_monthly_limit');
    }
  }

  if (signals.length === 0) signals.push('clear');

  const requiresExplicitOverride = signals.some(signal =>
    [
      'paused',
      'unavailable',
      'over_weekly_limit',
      'over_monthly_limit',
    ].includes(signal),
  );

  return {
    organizationId,
    userId,
    candidateDate: input.candidateDate,
    advisoryOnly: true,
    requiresExplicitOverride,
    primarySignal: choosePrimarySignal(signals),
    signals,
    scheduledLoad: {
      week: {
        current: load.week,
        projected: weeklyProjected,
        limit: preference.maxServicesPerWeek,
      },
      month: {
        current: load.month,
        projected: monthlyProjected,
        limit: preference.maxServicesPerMonth,
      },
    },
    availability: {
      unavailableOnCandidateDate,
      pausedOnCandidateDate,
      pausedUntil: preference.pausedUntil,
    },
  };
}
