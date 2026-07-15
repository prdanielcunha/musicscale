import { Song, FreshnessMetadata, FreshnessStatus, FreshnessSource } from '../types';

export interface FreshnessEvaluationResult {
  shouldUpdate: boolean;
  nextStatus?: 'old' | 'new' | 'default';
  nextSource?: 'auto';
  referenceDate?: string;
  expirationDate?: string;
  reason:
    | 'manual_old_preserved'
    | 'future_schedule_active'
    | 'not_expired'
    | 'expired_new'
    | 'expired_default'
    | 'already_old'
    | 'missing_reference_date'
    | 'invalid_date';
}

/**
 * Validates whether a string is a canon date-only in YYYY-MM-DD format.
 */
export const isValidDateOnly = (value: string): boolean => {
  if (!value) return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(value)) return false;
  const parts = value.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  const dateObj = new Date(year, month - 1, day);
  return dateObj.getFullYear() === year && dateObj.getMonth() === month - 1 && dateObj.getDate() === day;
};

/**
 * Normalizes input of type string, Date, or Firestore Timestamp into calendar date YYYY-MM-DD.
 * It is completely timezone-safe by parsing prefixes directly.
 */
export const normalizeToDateOnly = (value: any): string | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const splitChar = value.includes('T') ? 'T' : (value.includes(' ') ? ' ' : null);
    const candidate = splitChar ? value.split(splitChar)[0] : value;
    const clean = candidate.trim();
    return isValidDateOnly(clean) ? clean : null;
  }
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const res = `${y}-${m}-${day}`;
    return isValidDateOnly(res) ? res : null;
  }
  if (typeof value === 'object') {
    if (typeof value.seconds === 'number') {
      try {
        const d = new Date(value.seconds * 1000);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const res = `${y}-${m}-${day}`;
        return isValidDateOnly(res) ? res : null;
      } catch {
        return null;
      }
    }
    if (typeof value.toDate === 'function') {
      try {
        const d = value.toDate();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const res = `${y}-${m}-${day}`;
        return isValidDateOnly(res) ? res : null;
      } catch {
        return null;
      }
    }
  }
  return null;
};

/**
 * Timezone-safe date arithmetic that adds calendar months, capping target day if needed.
 */
export const addCalendarMonths = (dateOnly: string, months: number): string | null => {
  if (!isValidDateOnly(dateOnly)) return null;
  const parts = dateOnly.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  let targetYear = year;
  let targetMonth = month + months;
  while (targetMonth > 12) {
    targetMonth -= 12;
    targetYear += 1;
  }
  while (targetMonth < 1) {
    targetMonth += 12;
    targetYear -= 1;
  }

  const getDaysInMonth = (y: number, m: number): number => {
    if (m === 2) {
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
      return isLeap ? 29 : 28;
    }
    return [4, 6, 9, 11].includes(m) ? 30 : 31;
  };

  const targetDay = Math.min(day, getDaysInMonth(targetYear, targetMonth));
  const mOuter = String(targetMonth).padStart(2, '0');
  const dOuter = String(targetDay).padStart(2, '0');
  return `${targetYear}-${mOuter}-${dOuter}`;
};

/**
 * Returns the highest valid date in YYYY-MM-DD from the list.
 */
export const maxValidDateOnly = (values: (string | null | undefined)[]): string | null => {
  const validDates = values.filter((v): v is string => typeof v === 'string' && isValidDateOnly(v));
  if (validDates.length === 0) return null;
  return validDates.reduce((max, current) => current > max ? current : max, validDates[0]);
};

/**
 * Pure evaluation function. Determines whether the song should transition to automated 'old'.
 * Ensures absolute immutability of the song input parameter.
 */
export const evaluateSongFreshness = (
  song: Readonly<Partial<Song>>,
  today: string
): FreshnessEvaluationResult => {
  // 1. Validate today string
  if (!today || !isValidDateOnly(today)) {
    return {
      shouldUpdate: false,
      reason: 'invalid_date'
    };
  }

  // 2. Safely normalize state in memory from Readonly song (no mutations)
  let status: FreshnessStatus = 'default';
  let source: FreshnessSource = 'auto';
  let manualResetAt: string | null = null;

  if (song.freshness) {
    status = song.freshness.status || 'default';
    source = song.freshness.source || 'auto';
    manualResetAt = normalizeToDateOnly(song.freshness.manualResetAt);
  } else if (song.isNew === true) {
    status = 'new';
    source = 'auto';
  }

  // 3. Absolute rule: manual_old_preserved
  if (status === 'old' && source === 'manual') {
    return {
      shouldUpdate: false,
      reason: 'manual_old_preserved'
    };
  }

  // 4. Absolute rule: already_old
  if (status === 'old' && source === 'auto') {
    return {
      shouldUpdate: false,
      reason: 'already_old'
    };
  }

  // 5. Rule: future_schedule_active
  const normLastScheduledAt = normalizeToDateOnly(song.lastScheduledAt);
  if (normLastScheduledAt && normLastScheduledAt > today) {
    return {
      shouldUpdate: false,
      reason: 'future_schedule_active'
    };
  }

  // 6. Max reference date computation
  const refDate = maxValidDateOnly([
    normalizeToDateOnly(song.createdAt),
    manualResetAt,
    normLastScheduledAt
  ]);

  if (!refDate) {
    return {
      shouldUpdate: false,
      reason: 'missing_reference_date'
    };
  }

  // 7. Month addition
  const expDate = addCalendarMonths(refDate, 6);
  if (!expDate) {
    return {
      shouldUpdate: false,
      reason: 'missing_reference_date'
    };
  }

  // 8. Evaluation
  if (today < expDate) {
    return {
      shouldUpdate: false,
      reason: 'not_expired',
      referenceDate: refDate,
      expirationDate: expDate
    };
  }

  // 9. Expired status resolution
  const isOriginallyNew = status === 'new';
  return {
    shouldUpdate: true,
    nextStatus: 'old',
    nextSource: 'auto',
    referenceDate: refDate,
    expirationDate: expDate,
    reason: isOriginallyNew ? 'expired_new' : 'expired_default'
  };
};
