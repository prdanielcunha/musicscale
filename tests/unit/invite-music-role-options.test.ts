import { describe, expect, it } from 'vitest';
import { resolveInviteMusicRoleOptions } from '../../utils/inviteMusicRoleOptions';
import type { Role } from '../../types';

const permissions = {
  canManageUsers: false, canManageRoles: false, canManageRepertoire: false,
  canManageScales: false, canViewContent: true, canManageChords: false,
};
const role = (id: string, name: string, organizationId = 'familia', overrides: Partial<typeof permissions> = {}): Role => ({
  id, name, organizationId, description: '', permissions: { ...permissions, ...overrides },
});

describe('invite musical role options (UI-only)', () => {
  it('shows duplicated labels once, handles case/accents/whitespace, and keeps original role data untouched', () => {
    const input = [
      role('z-admin', 'Administrador'),
      role('a-admin', ' administrador '),
      role('v1', 'Visitante'),
      role('v2', 'Visitante'),
      role('m1', 'Membro'),
      role('m2', 'Membro'),
      role('l1', 'Líder / Ministro'),
      role('m3', ' MÚSICO  / VOCAL '),
      role('m4', 'Musico / Vocal'),
    ];
    const snapshot = JSON.stringify(input);
    const opts = resolveInviteMusicRoleOptions(input, 'familia');
    expect(opts).toHaveLength(5);
    expect(opts.filter(x=>x.role.name.trim().toLowerCase().includes('administrador'))).toHaveLength(1);
    expect(opts.find(x=>x.role.id === 'a-admin')?.duplicateCount).toBe(2);
    expect(opts.every(x=>!x.ambiguous)).toBe(true);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('does not silently choose between roles with identical labels and different grants', () => {
    const opts = resolveInviteMusicRoleOptions([
      role('a', 'Administrador', 'familia', { canManageUsers: true }),
      role('b', 'Administrador', 'familia', { canManageUsers: false }),
      role('c', 'Vocal'),
    ], 'familia');
    expect(opts.find(x => x.role.name === 'Administrador')?.ambiguous).toBe(true);
    expect(opts.find(x => x.role.name === 'Vocal')?.ambiguous).toBe(false);
  });

  it('never exposes other organizations, protected roles or phantom IDs', () => {
    const opts = resolveInviteMusicRoleOptions([
      role('cross', 'Guitarrista', 'other'),
      role('ceo', 'CEO'),
      role('owner', 'Dono'),
      role('missing', ' '),
      role('vocal', 'Vocal', 'familia'),
    ], 'familia');
    expect(opts.map(x=>x.role.id)).toEqual(['vocal']);
  });
});
