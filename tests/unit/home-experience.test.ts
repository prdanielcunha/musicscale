import { describe, it, expect, vi } from 'vitest';
import {
  evaluateHomeExperience,
  buildHomeEventSummaries,
  selectMostRecentDraft,
  getHomeAttentionItems,
  isValidDateOnlyKey,
  toEpochMillis,
  PopulatedScaleWithAssignmentsAndStatus,
  PopulatedBandScaleWithStatus
} from '../../utils/homeExperience';

describe('isValidDateOnlyKey', () => {
  it('rejects empty or invalid types', () => {
    expect(isValidDateOnlyKey(null)).toBe(false);
    expect(isValidDateOnlyKey(undefined)).toBe(false);
    expect(isValidDateOnlyKey('')).toBe(false);
    expect(isValidDateOnlyKey(123)).toBe(false);
    expect(isValidDateOnlyKey({})).toBe(false);
  });

  it('rejects malformed strings', () => {
    expect(isValidDateOnlyKey('2026-2-3')).toBe(false);
    expect(isValidDateOnlyKey('2026/02/03')).toBe(false);
    expect(isValidDateOnlyKey('abc')).toBe(false);
  });

  it('rejects non-existent dates', () => {
    expect(isValidDateOnlyKey('2026-02-30')).toBe(false); // Fevereiro não tem 30
    expect(isValidDateOnlyKey('2025-02-29')).toBe(false); // 2025 não é bissexto
    expect(isValidDateOnlyKey('2026-13-01')).toBe(false); // Mês 13
  });

  it('accepts valid dates', () => {
    expect(isValidDateOnlyKey('2026-02-28')).toBe(true);
    expect(isValidDateOnlyKey('2028-02-29')).toBe(true); // bissexto
    expect(isValidDateOnlyKey('2024-12-31')).toBe(true);
  });
});

describe('toEpochMillis', () => {
  it('handles valid strings', () => {
    expect(toEpochMillis('2026-01-01T00:00:00.000Z')).toBeGreaterThan(0);
  });

  it('handles finite numbers', () => {
    expect(toEpochMillis(123456789)).toBe(123456789);
  });

  it('handles Date objects', () => {
    expect(toEpochMillis(new Date('2026-01-01T00:00:00.000Z'))).toBeGreaterThan(0);
  });

  it('handles Timestamp toMillis', () => {
    expect(toEpochMillis({ toMillis: () => 1000 })).toBe(1000);
  });

  it('handles Timestamp toDate', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    expect(toEpochMillis({ toDate: () => d })).toBe(d.getTime());
  });

  it('handles seconds object', () => {
    expect(toEpochMillis({ seconds: 1 })).toBe(1000);
  });

  it('returns 0 for invalid values', () => {
    expect(toEpochMillis(null)).toBe(0);
    expect(toEpochMillis(NaN)).toBe(0);
    expect(toEpochMillis(Infinity)).toBe(0);
    expect(toEpochMillis(new Date('invalid'))).toBe(0);
    expect(toEpochMillis({ foo: 'bar' })).toBe(0);
  });

  it('returns 0 if function throws', () => {
    expect(toEpochMillis({ toMillis: () => { throw new Error('fail'); } })).toBe(0);
  });
});

describe('getHomeAttentionItems', () => {
  it('returns empty if cannot manage scales', () => {
    const event = { id: '1', type: 'music', title: 'T', date: '2026-01-01', songCount: 0, teamCount: 0, userFunctionNames: [], isUserAssigned: false } as const;
    expect(getHomeAttentionItems(event, false)).toEqual([]);
  });

  it('returns missing-repertoire for empty MusicScale', () => {
    const event = { id: '1', type: 'music', title: 'T', date: '2026-01-01', songCount: 0, teamCount: 1, time: '10:00', locationName: 'L', userFunctionNames: [], isUserAssigned: false } as const;
    const items = getHomeAttentionItems(event, true);
    expect(items.map(i => i.code)).toContain('missing-repertoire');
  });

  it('does NOT return missing-repertoire for BandScale', () => {
    const event = { id: '1', type: 'band', title: 'T', date: '2026-01-01', songCount: 0, teamCount: 1, time: '10:00', locationName: 'L', userFunctionNames: [], isUserAssigned: false } as const;
    const items = getHomeAttentionItems(event, true);
    expect(items.map(i => i.code)).not.toContain('missing-repertoire');
  });

  it('returns missing-team for event without team', () => {
    const event = { id: '1', type: 'band', title: 'T', date: '2026-01-01', songCount: 0, teamCount: 0, time: '10:00', locationName: 'L', userFunctionNames: [], isUserAssigned: false } as const;
    const items = getHomeAttentionItems(event, true);
    expect(items.map(i => i.code)).toContain('missing-team');
  });
});

describe('buildHomeEventSummaries', () => {
  const baseMusic: PopulatedScaleWithAssignmentsAndStatus = { id: '1', organizationId: 'o', eventType: { id: 'e', name: 'N' }, date: '2026-01-01', status: 'published', songs: [] };
  const baseBand: PopulatedBandScaleWithStatus = { id: 'b1', organizationId: 'o', eventType: { id: 'e', name: 'N' }, date: '2026-01-01', status: 'published' };
  const todayKey = '2026-01-01';

  it('ignores MusicScale without valid date', () => {
    const scales: PopulatedScaleWithAssignmentsAndStatus[] = [
      { ...baseMusic, date: undefined as any },
      { ...baseMusic, date: '' },
      { ...baseMusic, date: '2026-02-30' },
      { ...baseMusic, date: 'abc' },
    ];
    const summaries = buildHomeEventSummaries(scales, [], 'u1', todayKey);
    expect(summaries).toHaveLength(0);
  });

  it('ignores BandScale without valid date', () => {
    const scales: PopulatedBandScaleWithStatus[] = [
      { ...baseBand, date: undefined as any },
      { ...baseBand, date: '' },
      { ...baseBand, date: '2026-02-30' },
      { ...baseBand, date: 'abc' },
    ];
    const summaries = buildHomeEventSummaries([], scales, 'u1', todayKey);
    expect(summaries).toHaveLength(0);
  });

  it('includes event of todayKey and future, ignores past', () => {
    const scales: PopulatedScaleWithAssignmentsAndStatus[] = [
      { ...baseMusic, id: 'past', date: '2025-12-31' },
      { ...baseMusic, id: 'today', date: '2026-01-01' },
      { ...baseMusic, id: 'future', date: '2026-01-02' }
    ];
    const summaries = buildHomeEventSummaries(scales, [], 'u1', todayKey);
    expect(summaries.map(s => s.id)).toEqual(['today', 'future']);
  });

  it('invalid event does not prevent others', () => {
    const scales: PopulatedScaleWithAssignmentsAndStatus[] = [
      { ...baseMusic, id: 'inv', date: 'invalid' },
      { ...baseMusic, id: 'val', date: '2026-01-02' }
    ];
    const summaries = buildHomeEventSummaries(scales, [], 'u1', todayKey);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe('val');
  });

  it('sorts multiple valid events correctly', () => {
    const scales: PopulatedScaleWithAssignmentsAndStatus[] = [
      { ...baseMusic, id: '2', date: '2026-01-02', time: '10:00' },
      { ...baseMusic, id: '3', date: '2026-01-02', time: '09:00' },
      { ...baseMusic, id: '1', date: '2026-01-01', time: '20:00' }
    ];
    const summaries = buildHomeEventSummaries(scales, [], 'u1', todayKey);
    expect(summaries.map(s => s.id)).toEqual(['1', '3', '2']);
  });

  it('arrays are not mutated', () => {
    const scales: PopulatedScaleWithAssignmentsAndStatus[] = [{ ...baseMusic, date: '2026-01-01' }];
    const original = [...scales];
    buildHomeEventSummaries(scales, [], 'u1', todayKey);
    expect(scales).toEqual(original);
  });
});

describe('selectMostRecentDraft', () => {
  const baseMusic: PopulatedScaleWithAssignmentsAndStatus = { id: 'm1', organizationId: 'o', eventType: { id: 'e', name: 'N' }, date: '2026-01-01', status: 'draft', songs: [] };
  const baseBand: PopulatedBandScaleWithStatus = { id: 'b1', organizationId: 'o', eventType: { id: 'e', name: 'N' }, date: '2026-01-01', status: 'draft' };

  it('prioritizes lastModifiedAt over updatedAt over createdAt', () => {
    const m1 = { ...baseMusic, id: 'm1', lastModifiedAt: { seconds: 10 }, updatedAt: { seconds: 100 }, createdAt: { seconds: 1000 } };
    const m2 = { ...baseMusic, id: 'm2', lastModifiedAt: { seconds: 20 }, updatedAt: { seconds: 5 }, createdAt: { seconds: 5 } };
    
    let res = selectMostRecentDraft([m1, m2], []);
    expect(res?.id).toBe('m2'); // 20 > 10

    const m3 = { ...baseMusic, id: 'm3', updatedAt: { seconds: 30 }, createdAt: { seconds: 0 } };
    res = selectMostRecentDraft([m1, m3], []);
    expect(res?.id).toBe('m3'); // 30 > 10 (m1 uses lastModifiedAt=10)

    const m4 = { ...baseMusic, id: 'm4', createdAt: { seconds: 40 } };
    res = selectMostRecentDraft([m1, m4], []);
    expect(res?.id).toBe('m4'); // 40 > 10
  });

  it('preserves type correctly', () => {
    const mDraft = { ...baseMusic, id: 'm', createdAt: { seconds: 10 } };
    const bDraft = { ...baseBand, id: 'b', createdAt: { seconds: 20 } };

    let res = selectMostRecentDraft([mDraft], [bDraft]);
    expect(res?.id).toBe('b');
    expect(res?.type).toBe('band');

    const mDraftNew = { ...baseMusic, id: 'm2', createdAt: { seconds: 30 } };
    res = selectMostRecentDraft([mDraftNew], [bDraft]);
    expect(res?.id).toBe('m2');
    expect(res?.type).toBe('music');
  });

  it('arrays are not mutated', () => {
    const scales: PopulatedScaleWithAssignmentsAndStatus[] = [{ ...baseMusic, createdAt: { seconds: 10 } }];
    const original = [...scales];
    selectMostRecentDraft(scales, []);
    expect(scales).toEqual(original);
  });
});
