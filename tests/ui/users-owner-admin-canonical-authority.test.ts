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
  it('routes changed names through tenant member profile instead of global user writes', () => {
    const repository = readFileSync('services/MusicRepository.ts', 'utf8');
    const server = readFileSync('server.ts', 'utf8');
    expect(source).toContain('displayName: editName.trim()');
    expect(source).not.toContain('email: editEmail,');
    expect(repository).toContain("['roleId', 'musicscaleRole', 'ministryFunction', 'specialtyIds', 'displayName']");
    expect(repository).toContain('/musicscale-members/');
    expect(server).toContain('projectionData.displayName,');
    expect(server).toContain('isVerifiedTenantMemberForMusicScaleWrite(');
    expect(server).toContain('requestedFields.some(field => !MUSIC_SCALE_MEMBER_FIELDS.includes(field as any))');
    expect(source).toContain('email_managed_by_hub');
  });

});
