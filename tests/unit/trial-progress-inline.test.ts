import { describe, expect, it } from 'vitest';
import { remainingTrialDays } from '../../components/dashboard/TrialProgressInline';

describe('MusicScale dashboard trial deadline presentation', () => {
  const day = 86_400_000;
  const now = Date.parse('2026-10-09T12:00:00.000Z');

  it('derives the remaining days from the effective server deadline', () => {
    expect(remainingTrialDays(new Date(now + 14*day).toISOString(),now)).toBe(14);
    expect(remainingTrialDays(new Date(now + 7*day).toISOString(),now)).toBe(7);
    expect(remainingTrialDays(new Date(now + day + 1000).toISOString(),now)).toBe(2);
  });

  it('never displays a countdown after expiry or without a valid deadline', () => {
    expect(remainingTrialDays(new Date(now).toISOString(),now)).toBeNull();
    expect(remainingTrialDays(new Date(now - day).toISOString(),now)).toBeNull();
    expect(remainingTrialDays('invalid',now)).toBeNull();
    expect(remainingTrialDays(null,now)).toBeNull();
  });
});
