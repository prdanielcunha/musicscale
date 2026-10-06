import { describe, expect, it } from 'vitest';
import { resolveMemberDirectoryMusicProfile } from '../../services/server/musicScaleMemberProjection.js';

describe('member directory legacy MusicScale profile recovery', () => {
  it('restores legacy MusicScale role, ministry function and specialties only for the same tenant', () => {
    const result = resolveMemberDirectoryMusicProfile(
      {},
      { organizationRole: 'member', role: 'member' },
      {
        organizationId: 'org-1',
        role: 'Músico',
        ministryFunction: 'Guitarrista',
        specialtyIds: ['guitar', ' vocal ', 'guitar'],
      },
      'org-1',
    );

    expect(result.legacyUserFallbackAllowed).toBe(true);
    expect(result.musicscaleRole).toBe('Músico');
    expect(result.ministryFunction).toBe('Guitarrista');
    expect(result.specialtyIds).toEqual(['guitar', 'vocal']);
  });

  it('never imports legacy user MusicScale fields from another organization', () => {
    const result = resolveMemberDirectoryMusicProfile(
      {},
      { organizationRole: 'member', role: 'member' },
      {
        organizationId: 'org-2',
        role: 'Músico',
        ministryFunction: 'Baterista',
        specialtyIds: ['drums'],
      },
      'org-1',
    );

    expect(result.legacyUserFallbackAllowed).toBe(false);
    expect(result.musicscaleRole).toBe('');
    expect(result.ministryFunction).toBeNull();
    expect(result.specialtyIds).toEqual([]);
  });

  it('keeps explicit projection fields authoritative, including an intentional empty specialty list', () => {
    const result = resolveMemberDirectoryMusicProfile(
      {
        roleId: 'role-projection',
        musicscaleRole: 'leader',
        ministryFunction: ['Ministro'],
        specialtyIds: [],
      },
      {
        roleId: 'role-member',
        musicscaleRole: 'musician',
        ministryFunction: 'Tecladista',
        specialtyIds: ['keys'],
      },
      {
        organizationId: 'org-1',
        role: 'Músico',
        ministryFunction: 'Baterista',
        specialtyIds: ['drums'],
      },
      'org-1',
    );

    expect(result.roleId).toBe('role-projection');
    expect(result.musicscaleRole).toBe('leader');
    expect(result.ministryFunction).toEqual(['Ministro']);
    expect(result.specialtyIds).toEqual([]);
  });

  it('uses canonical MusicScale fields before the legacy user profile but never treats member access role as ministry role', () => {
    const result = resolveMemberDirectoryMusicProfile(
      {},
      {
        role: 'admin',
        musicscaleRole: 'Ministro',
        ministryFunction: 'Ministro',
        specialtyIds: ['minister'],
      },
      {
        organizationId: 'org-1',
        role: 'Músico',
        ministryFunction: 'Guitarrista',
        specialtyIds: ['guitar'],
      },
      'org-1',
    );

    expect(result.musicscaleRole).toBe('Ministro');
    expect(result.ministryFunction).toBe('Ministro');
    expect(result.specialtyIds).toEqual(['minister']);
    expect(result.musicscaleRole).not.toBe('admin');
  });
});
