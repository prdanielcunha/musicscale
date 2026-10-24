import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BandPage from '../../pages/BandPage';

const state = vi.hoisted(() => ({
  owner: false, admin: false, global: false, capable: false,
  users: [] as any[],
  roles: [{ id: 'vocal', name: 'Vocal', organizationId: 'org-a' }],
  navigate: vi.fn(),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => state.navigate }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'actor' }, userProfile: {}, isOwner: state.owner, isAdmin: state.admin }),
}));
vi.mock('../../hooks/useCapability', () => ({
  useCapability: () => ({ hasCapability: (name: string) => state.capable && name === 'musicscale.members.manage' }),
}));
vi.mock('../../hooks/useEcosystemAdmin', () => ({ isGlobalPrivilegedUser: () => state.global }));
vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => ({ instruments: [], roles: state.roles, allUsers: state.users, loading: false, error: null }),
}));
// Exercise the directory entry point while the existing modal contract suite
// verifies canonical invitation creation, delivery and role selection.
vi.mock('../../components/team/CanonicalHubInviteModal', () => ({
  default: ({ isOpen, onClose, availableMusicScaleRoles }: any) => isOpen ? (
    <div role="dialog" aria-label="Convite MillionsNest">
      <span>{availableMusicScaleRoles.map((role: any) => role.name).join(', ')}</span>
      <button onClick={onClose}>Fechar convite</button>
    </div>
  ) : null,
}));

beforeEach(() => {
  state.owner = state.admin = state.global = state.capable = false;
  state.users = [];
  state.navigate.mockReset();
});
afterEach(cleanup);

describe('Integrantes directory invitation entry point', () => {
  it.each(['owner', 'admin', 'global', 'capable'] as const)('lets %s open and close the shared invite with available musical roles', grant => {
    state[grant] = true;
    render(<BandPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Convidar integrante' }));
    expect(screen.getByRole('dialog', { name: 'Convite MillionsNest' })).toHaveTextContent('Vocal');
    expect(state.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar convite' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the directory available without invitation management access', () => {
    render(<BandPage />);
    expect(screen.getByLabelText('Buscar por Nome/E-mail')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Convidar integrante' })).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('retains member details navigation alongside the invitation action', () => {
    state.owner = true;
    state.users = [{ uid: 'member-a', displayName: 'Maria', roleId: 'vocal', specialtyIds: [] }];
    render(<BandPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver ou editar Maria' }));
    expect(state.navigate).toHaveBeenCalledWith('/users', { state: { memberUid: 'member-a', origin: 'band-directory' } });
    expect(screen.getByRole('button', { name: 'Convidar integrante' })).toBeVisible();
  });
});
