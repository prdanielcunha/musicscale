import { describe, expect, it } from 'vitest';
import { getPrimaryDisplayRole } from '../../utils/roleResolver';

describe('global role display resolver', () => {
  it('prefers canonical ecosystem CEO over a stale local member profile', () => {
    const role = getPrimaryDisplayRole(
      { uid: 'user-1', systemRole: 'user', organizationRole: 'member' },
      { id: 'org-1' },
      'ceo',
    );

    expect(role.scope).toBe('ecosystem');
    expect(role.label).toBe('CEO do Ecossistema MillionsNest');
    expect(role.badgeVariant).toBe('ecosystemCeo');
  });

  it('prefers canonical global admin over a local organization owner role', () => {
    const role = getPrimaryDisplayRole(
      { uid: 'user-2', systemRole: 'user', organizationRole: 'owner' },
      { id: 'org-1', ownerUserId: 'user-2' },
      'global_admin',
    );

    expect(role.scope).toBe('ecosystem');
    expect(role.label).toBe('Administrador do Ecossistema MillionsNest');
    expect(role.badgeVariant).toBe('ecosystemAdmin');
  });

  it('lets the canonical non-global role override stale local global metadata', () => {
    const role = getPrimaryDisplayRole(
      { uid: 'user-3', systemRole: 'ceo', organizationRole: 'member' },
      { id: 'org-1' },
      'user',
    );

    expect(role.scope).toBe('organization');
    expect(role.label).toBe('Membro');
    expect(role.badgeVariant).toBe('member');
  });

  it('falls back to the local profile when no canonical ecosystem role is available', () => {
    const role = getPrimaryDisplayRole(
      { uid: 'user-4', systemRole: 'ecosystem_owner', organizationRole: 'member' },
      { id: 'org-1' },
    );

    expect(role.scope).toBe('ecosystem');
    expect(role.label).toBe('Dono do Ecossistema MillionsNest');
    expect(role.badgeVariant).toBe('ecosystemOwner');
  });

  it('keeps organization-role fallback for ordinary ecosystem users', () => {
    const role = getPrimaryDisplayRole(
      { uid: 'user-5', systemRole: 'user', organizationRole: 'leader' },
      { id: 'org-1' },
      'user',
    );

    expect(role.scope).toBe('organization');
    expect(role.label).toBe('Líder / Ministro');
    expect(role.badgeVariant).toBe('leader');
  });
});
