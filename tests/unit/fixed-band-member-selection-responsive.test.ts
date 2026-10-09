import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const builder = readFileSync('components/scales/BandBuilder.tsx', 'utf8');
const form = readFileSync('components/database/FixedBandScaleFormModal.tsx', 'utf8');
const manager = readFileSync('components/database/FixedBandScaleManager.tsx', 'utf8');

describe('fixed band modal: select a real member before saving', () => {
  it('shows both function and people panels on tablet and compact desktop widths', () => {
    // Existing code used lg (1024 px), hiding the entire people roster on
    // screenshots at 768-1023 px, even when a specialty had been selected.
    expect(form).toContain('compactDesktopLayout');
    expect(builder).toContain("'md:flex-row'");
    expect(builder).toContain("'md:w-[36%]'");
    expect(builder).toContain("'md:w-[64%]'");
    expect(builder).toContain("'hidden md:flex'");
  });

  it('switches from functions to member choices automatically on phones', () => {
    expect(builder).toContain("window.innerWidth < 768");
    expect(builder).toContain("setMobileTab('formation')");
    expect(builder).toContain('setSelectedInstruments(prev => {');
  });

  it('offers retry for empty/error member directories and does not invent people', () => {
    expect(form).toContain('memberDirectoryState={usersStatus}');
    expect(form).toContain('onRetryMemberDirectory');
    expect(builder).toContain('fixed-band-member-directory-empty');
    expect(builder).toContain('membersLoadFailed');
    expect(builder).toContain('allUsers.length === 0');
  });

  it('keeps saving gated on actual named formations and user assignments', () => {
    expect(form).toContain('!formData.name.trim() || validAssignments.length === 0');
    expect(form).toContain('assignment.userId && assignment.instrumentId');
    expect(form).toContain('saveRequiresNameAndMember');
    expect(manager).toContain('api.fixedBandScales.create(data)');
    expect(manager).toContain('setSaveError(');
    expect(form).toContain('role="alert"');
  });
});
