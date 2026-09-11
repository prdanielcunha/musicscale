export interface ConnectEventAssignmentRecord {
  userId?: string | null;
  functionId?: string | null;
  functionName?: string | null;
  functionCategory?: string | null;
  active?: boolean | null;
}

export interface ConnectBandAssignmentRecord {
  userId?: string | null;
  instrumentId?: string | null;
  active?: boolean | null;
}

export interface ConnectScaleRecord {
  id: string;
  organizationId?: string | null;
  date?: string | null;
  time?: string | null;
  timeZone?: string | null;
  durationMinutes?: number | null;
  status?: string | null;
  eventNameId?: string | null;
  eventTypeId?: string | null;
  locationId?: string | null;
  bandScaleId?: string | null;
  songIds?: string[] | null;
  eventAssignments?: ConnectEventAssignmentRecord[] | null;
}

export interface ConnectBandScaleRecord {
  id: string;
  organizationId?: string | null;
  assignments?: ConnectBandAssignmentRecord[] | null;
}

export interface NextAssignedScheduleSelection {
  scale: ConnectScaleRecord;
  assignmentSource: 'band_scale' | 'event_assignment';
  functionNames: string[];
}

export interface SelectNextAssignedScheduleInput {
  organizationId: string;
  actorUid: string;
  scales: ConnectScaleRecord[];
  bandScales: ConnectBandScaleRecord[];
  nowMs?: number;
}

const DEFAULT_DURATION_MINUTES = 120;

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTimeKey(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function safeTimeZone(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
    return value;
  } catch {
    return 'UTC';
  }
}

function zonedClock(nowMs: number, timeZone: string): {
  dateKey: string;
  minuteOfDay: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || '';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));

  return {
    dateKey: `${year}-${month}-${day}`,
    minuteOfDay: hour * 60 + minute,
  };
}

function isVisibleUpcomingScale(scale: ConnectScaleRecord, nowMs: number): boolean {
  if (!isDateKey(scale.date)) return false;

  const normalizedStatus = String(scale.status || '').trim().toLowerCase();
  if (['draft', 'cancelled', 'completed'].includes(normalizedStatus)) return false;

  const timeZone = safeTimeZone(scale.timeZone);
  const clock = zonedClock(nowMs, timeZone);

  if (scale.date > clock.dateKey) return true;
  if (scale.date < clock.dateKey) return false;

  if (!isTimeKey(scale.time)) return true;

  const [hour, minute] = scale.time.split(':').map(Number);
  const startMinute = hour * 60 + minute;
  const duration =
    typeof scale.durationMinutes === 'number' &&
    Number.isInteger(scale.durationMinutes) &&
    scale.durationMinutes > 0 &&
    scale.durationMinutes <= 1440
      ? scale.durationMinutes
      : DEFAULT_DURATION_MINUTES;

  return clock.minuteOfDay < startMinute + duration;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean),
    ),
  );
}

function compareScales(a: ConnectScaleRecord, b: ConnectScaleRecord): number {
  const dateA = a.date || '';
  const dateB = b.date || '';
  if (dateA !== dateB) return dateA.localeCompare(dateB);

  const timeA = isTimeKey(a.time) ? a.time : '00:00';
  const timeB = isTimeKey(b.time) ? b.time : '00:00';
  if (timeA !== timeB) return timeA.localeCompare(timeB);

  return a.id.localeCompare(b.id);
}

export function selectNextAssignedSchedule(
  input: SelectNextAssignedScheduleInput,
): NextAssignedScheduleSelection | null {
  const nowMs = input.nowMs ?? Date.now();
  const organizationId = input.organizationId.trim();
  const actorUid = input.actorUid.trim();
  if (!organizationId || !actorUid) return null;

  const bandScalesById = new Map(
    input.bandScales
      .filter((bandScale) => bandScale.id && bandScale.organizationId === organizationId)
      .map((bandScale) => [bandScale.id, bandScale]),
  );

  const candidates = input.scales
    .filter(
      (scale) =>
        scale.organizationId === organizationId &&
        isVisibleUpcomingScale(scale, nowMs),
    )
    .sort(compareScales);

  for (const scale of candidates) {
    const linkedBandScale = scale.bandScaleId
      ? bandScalesById.get(scale.bandScaleId)
      : undefined;

    if (linkedBandScale) {
      const assignments = (linkedBandScale.assignments || []).filter(
        (assignment) => assignment.active !== false,
      );
      const actorAssignments = assignments.filter(
        (assignment) => assignment.userId === actorUid,
      );

      if (actorAssignments.length > 0) {
        return {
          scale,
          assignmentSource: 'band_scale',
          functionNames: uniqueStrings(actorAssignments.map((assignment) => assignment.instrumentId)),
        };
      }

      continue;
    }

    const assignments = (scale.eventAssignments || []).filter(
      (assignment) => assignment.active !== false,
    );
    const actorAssignments = assignments.filter(
      (assignment) => assignment.userId === actorUid,
    );

    if (actorAssignments.length > 0) {
      return {
        scale,
        assignmentSource: 'event_assignment',
        functionNames: uniqueStrings(actorAssignments.map((assignment) => assignment.functionName)),
      };
    }
  }

  return null;
}
