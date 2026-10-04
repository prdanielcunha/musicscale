import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('pages/UsersPage.tsx', 'utf8');

describe('Users owner/admin canonical management authority', () => {
  it('prefers the active organization canonical owner/admin flags over legacy profile role fields', () => {
    expect(source).toContain('isOwner: isCurrentOrganizationOwner');
    expect(source).toContain('isAdmin: isCurrentOrganizationAdmin');
    expect(source).toContain('if (isGlobal || isCurrentOrganizationOwner) return "owner";');
    expect(source).toContain('if (isCurrentOrganizationAdmin) return "admin";');
  });

  it('applies canonical authority to every member-role hierarchy decision', () => {
    const canonicalCalls = source.match(/getActorOrganizationRoleKey\(userProfile, isGlobal, isCurrentOrganizationOwner, isCurrentOrganizationAdmin\)/g) || [];
    expect(canonicalCalls).toHaveLength(5);
  });

  it('does not hide member management when an owner/admin capability projection is stale', () => {
    expect(source).toContain('const canEditRoles =');
    expect(source).toContain('const canManageTeamSetup =');
    expect(source.match(/isCurrentOrganizationOwner \|\|/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source.match(/isCurrentOrganizationAdmin \|\|/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
