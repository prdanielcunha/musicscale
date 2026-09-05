import { describe, expect, it } from 'vitest';
import { entitlementsService } from '../../services/entitlementsService';

describe('MusicScale entitlement status normalization', () => {
  const normalize = (status: string) =>
    entitlementsService.normalizeEntitlements(
      { plan: 'advanced', status },
      'org-billing-status-test',
    ).status;

  it('preserves canonical lifecycle states', () => {
    expect(normalize('active')).toBe('active');
    expect(normalize('trialing')).toBe('trialing');
    expect(normalize('past_due')).toBe('past_due');
    expect(normalize('canceled')).toBe('canceled');
    expect(normalize('expired')).toBe('expired');
    expect(normalize('inactive')).toBe('inactive');
    expect(normalize('none')).toBe('none');
  });

  it('normalizes Hub/Stripe aliases without hiding payment or expiry states', () => {
    expect(normalize('trial')).toBe('trialing');
    expect(normalize('cancelled')).toBe('canceled');
    expect(normalize('unpaid')).toBe('past_due');
    expect(normalize('incomplete')).toBe('past_due');
    expect(normalize('paused')).toBe('past_due');
    expect(normalize('incomplete_expired')).toBe('expired');
  });

  it('fails closed to inactive for unknown statuses', () => {
    expect(normalize('mystery_status')).toBe('inactive');
  });
});
