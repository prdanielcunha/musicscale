import { describe, expect, it } from 'vitest';
import {
  collectVerifiedMinistryNameMatches,
  normalizeMinistryAuditName,
} from '../../utils/tenantMinistryAuditMatches';

describe('tenant-bound ministry audit evidence - read only', () => {
  const currentOrgRoleNames = new Map<string, string[]>([
    ['vocal', ['role-vocal']],
    ['violao', ['role-guitar']],
    ['lider / ministro', ['role-leader']],
  ]);

  it('normalizes accents and matches a historical ministryFunction string', () => {
    expect(normalizeMinistryAuditName(' Violão ')).toBe('violao');
    expect(collectVerifiedMinistryNameMatches(currentOrgRoleNames, ['Violão']))
      .toEqual(['role-guitar']);
  });

  it('handles ministryFunction arrays without duplicate or phantom assignments', () => {
    expect(collectVerifiedMinistryNameMatches(currentOrgRoleNames, [
      ['VOCAL', ' Vocal ', null, 1], undefined, 'vocal',
    ])).toEqual(['role-vocal']);
  });

  it('never matches a role that only exists in another organization', () => {
    expect(collectVerifiedMinistryNameMatches(currentOrgRoleNames, ['Teclado']))
      .toEqual([]);
    expect(collectVerifiedMinistryNameMatches(undefined, ['Vocal']))
      .toEqual([]);
  });

  it('detects ambiguous historical evidence instead of selecting the first role', () => {
    expect(collectVerifiedMinistryNameMatches(currentOrgRoleNames, [
      'Vocal', ['Violão'],
    ])).toEqual(['role-vocal', 'role-guitar']);
    const ambiguousSameName = new Map([['vocal', ['role-1', 'role-2']]]);
    expect(collectVerifiedMinistryNameMatches(ambiguousSameName, ['Vocal']))
      .toEqual(['role-1', 'role-2']);
  });

  it('does not accept objects, booleans or empty values as names', () => {
    expect(collectVerifiedMinistryNameMatches(currentOrgRoleNames, [
      { name: 'Vocal' }, false, null, '', 123,
    ])).toEqual([]);
  });
});
