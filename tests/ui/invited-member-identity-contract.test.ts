import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('invited member identity and role contract', () => {
  it('resolves existing member identity through the authenticated server directory', () => {
    const server = read('server.ts');
    const repository = read('services/MusicRepository.ts');

    expect(server).toContain('/api/orgs/:organizationId/member-directory');
    expect(server).toContain('auth.getUsers');
    expect(server).toContain('memberData.emailNormalized');
    expect(server).toContain('authData.displayName');
    expect(server).toContain('Cache-Control');

    expect(repository).toContain('/member-directory');
    expect(repository).toContain('Authorization: `Bearer ${token}`');
    expect(repository).toContain("displayName: member.displayName || member.email || ''");
  });

  it('never converts an ordinary organization member into the MusicScale Visitante role', () => {
    const usersPage = read('pages/UsersPage.tsx');

    expect(usersPage).toContain('u.roleId || u.musicscaleRole || ministryRole');
    expect(usersPage).not.toContain('u.musicscaleRole || u.ministryFunction || u.organizationRole || u.roleId');
    expect(usersPage).not.toContain("else match = roles.find(r => r.name === 'Visitante');");
  });

  it('does not stamp legacy Visitante onto accounts created before organization assignment', () => {
    const firestoreService = read('services/firestoreService.ts');

    expect(firestoreService).toContain('if (orgId && defaultRole)');
    expect(firestoreService).not.toContain("roleId: defaultRole?.id || 'visitor'");
    expect(firestoreService).not.toContain("role: defaultRole?.name || 'Visitante'");
  });
});
