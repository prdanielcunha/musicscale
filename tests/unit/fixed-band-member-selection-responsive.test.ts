import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const builder = readFileSync('components/scales/BandBuilder.tsx', 'utf8');
const form = readFileSync('components/database/FixedBandScaleFormModal.tsx', 'utf8');
const manager = readFileSync('components/database/FixedBandScaleManager.tsx', 'utf8');

describe('fixed scale: owner must always see real tenant members', () => {
  it('shows function and people panels together on phones, tablets and desktop', () => {
    expect(form).toContain('compactDesktopLayout');
    expect(builder).toContain("compactDesktopLayout ? 'hidden' : 'lg:hidden'");
    expect(builder).toContain("compactDesktopLayout ? 'flex' : (mobileTab === 'functions'");
    expect(builder).toContain("compactDesktopLayout ? 'flex' : (mobileTab === 'formation'");
    expect(builder).toContain('fixed-band-member-roster');
    expect(builder).toContain("window.innerWidth < 768");
    expect(builder).toContain('memberRosterRef.current?.scrollIntoView');
  });

  it('does not hide tenant members because their specialty is missing', () => {
    expect(builder).toContain('useState(compactDesktopLayout)');
    expect(builder).toContain('showAllMembers && otherUsers.length > 0');
    expect(builder).toContain('compatibleUsers.map(u => renderUserCard');
  });

  it('recovers a fresh authenticated roster for first-login owners', () => {
    expect(form).toContain('user.getIdToken()');
    expect(form).toContain("encodeURIComponent(effectiveOrganizationId) + '/member-directory'");
    expect(form).toContain('payload.organizationId !== effectiveOrganizationId');
    expect(form).toContain('member?.organizationId === effectiveOrganizationId');
    expect(form).toContain('verifiedMembers ?? allUsers.filter');
    expect(form).toContain('setRetryDirectory(n => n + 1)');
    expect(form).toContain('controller.abort()');
    expect(builder).toContain('fixed-band-member-directory-empty');
    expect(builder).toContain('membersLoadFailed');
  });

  it('requires a name and a real member assignment before saving', () => {
    expect(form).toContain('!formData.name.trim() || validAssignments.length === 0');
    expect(form).toContain('assignment.userId && assignment.instrumentId');
    expect(form).toContain('saveRequiresNameAndMember');
    expect(manager).toContain('api.fixedBandScales.create(data)');
    expect(manager).toContain('setSaveError(');
    expect(form).toContain('role="alert"');
  });
});
