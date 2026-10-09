import { describe, expect, it } from 'vitest';
import { getCanonicalInvitationJoinUrl } from '../../lib/canonicalInvitationRedirect';

describe('canonical MusicScale invitation entry', () => {
  it('routes organization-bound email/link invitations to the Hub without losing their token', () => {
    expect(getCanonicalInvitationJoinUrl('/join/org-123', '?token=abc%2Bdef%2Fghi'))
      .toBe('https://millionsnest.com/join/org-123?token=abc%2Bdef%2Fghi');
    expect(getCanonicalInvitationJoinUrl('/join/org_ABC/', '?token=once-only'))
      .toBe('https://millionsnest.com/join/org_ABC?token=once-only');
  });

  it('does not intercept historical MusicScale invitation forms or unrelated routes', () => {
    expect(getCanonicalInvitationJoinUrl('/join', '?token=legacy')).toBeNull();
    expect(getCanonicalInvitationJoinUrl('/invite', '?invite=legacy')).toBeNull();
    expect(getCanonicalInvitationJoinUrl('/login', '?token=valid')).toBeNull();
    expect(getCanonicalInvitationJoinUrl('/join/org-123', '?invite=legacy')).toBeNull();
  });

  it('rejects malformed or missing org IDs and tokens, and never uses caller-controlled destinations', () => {
    expect(getCanonicalInvitationJoinUrl('/join/%2Fadmin', '?token=abc')).toBeNull();
    expect(getCanonicalInvitationJoinUrl('/join/org-123', '?token=')).toBeNull();
    expect(getCanonicalInvitationJoinUrl('/join/org-123', '?token=%20%20')).toBeNull();
    expect(getCanonicalInvitationJoinUrl('/join/org-123', '?token=' + 'a'.repeat(4097))).toBeNull();
    expect(getCanonicalInvitationJoinUrl('//evil.example/join/org', '?token=x')).toBeNull();
    expect(getCanonicalInvitationJoinUrl('/join/org-123', '?token=safe&returnUrl=https%3A%2F%2Fevil.example'))
      .toBe('https://millionsnest.com/join/org-123?token=safe');
  });
});
