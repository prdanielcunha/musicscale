import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Role } from '../../types';

vi.mock('../../components/common/Modal', () => ({
  default: ({ children, title, isOpen }: any) => isOpen ? <div aria-label={title}>{children}</div> : null
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'owner', getIdToken: async () => 'id-token' },
    userProfile: { organizationRole: 'owner' },
    organization: { id: 'familia', name: 'Família OBPC', ownerUid: 'owner' },
    isOwner: true, isAdmin: true, isGlobalAdmin: false,
    permissions: { manageMembers: true }
  })
}));
vi.mock('../../contexts/EcosystemContext', () => ({
  useEcosystem: () => ({ context: { currentOrganizationId: 'familia' } })
}));
vi.mock('../../hooks/useEcosystemAdmin', () => ({
  isGlobalPrivilegedUser: () => false
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_: string, fallback: string, args: Record<string,string> = {}) =>
      fallback.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => String(args[key] ?? '')),
  })
}));

import { CanonicalHubInviteModal } from '../../components/team/CanonicalHubInviteModal';
const role = (id: string, name: string): Role => ({
  id, name, organizationId: 'familia', description: '',
  permissions: {canManageUsers: false, canManageRoles: false,
    canManageRepertoire: false, canManageScales: false,
    canViewContent: true, canManageChords: false}
});

afterEach(() => vi.unstubAllGlobals());

describe('MusicScale Hub invite modal crash and duplication regressions', () => {
  it('choosing a musical function on iPhone path renders and generates an invitation without dereferencing null prop', async () => {
    const request = vi.fn(async () => ({
      ok: true, json: async () => ({
        success: true, invitation: { id: 'invite-1', targetAppId: 'musicscale' },
        inviteUrl: 'https://musicscale.millionsnest.com/join/familia?token=example-token',
        musicScaleRoleBound: true
      }),
    }));
    vi.stubGlobal('fetch', request);
    render(<CanonicalHubInviteModal isOpen onClose={() => {}} availableMusicScaleRoles={[
      role('leader', 'Líder / Ministro'),
      role('voice', 'Músico / Vocal')
    ]} />);
    fireEvent.click(screen.getByText('Por link'));
    fireEvent.change(screen.getByLabelText(/Função musical no MusicScale/), { target: { value: 'leader' } });
    expect(screen.getByText(/função Líder \/ Ministro/)).toBeTruthy();
    fireEvent.click(screen.getByText('Gerar link desta função'));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({
      organizationId: 'familia', organizationRole: 'member', mode: 'link', roleId: 'leader'
    });
    expect(await screen.findByDisplayValue('https://musicscale.millionsnest.com/join/familia?token=example-token')).toBeTruthy();
  });

  it('shows each repeated name only once without silently inviting with conflicting permissions', () => {
    const a = role('a', 'Administrador');
    const b = role('b', 'Administrador');
    b.permissions.canManageUsers = true;
    render(<CanonicalHubInviteModal isOpen onClose={() => {}} availableMusicScaleRoles={[
      a, b, role('v1', 'Visitante'), role('v2', 'visitante')
    ]} />);
    const select = screen.getByLabelText(/Função musical no MusicScale/) as HTMLSelectElement;
    expect([...select.options].filter(o=>o.textContent?.startsWith('Administrador'))).toHaveLength(1);
    expect([...select.options].find(o=>o.textContent?.startsWith('Administrador'))?.disabled).toBe(true);
    expect([...select.options].filter(o=>o.textContent?.toLowerCase() === 'visitante')).toHaveLength(1);
    expect(screen.getByRole('status').textContent).toContain('permissões diferentes');
  });
});
