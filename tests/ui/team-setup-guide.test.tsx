import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TeamSetupGuide } from '../../components/team/TeamSetupGuide';
import { UserProfile, Role, Instrument } from '../../types';

// Mock auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'owner-1' },
    userProfile: { uid: 'owner-1', role: 'Dono', systemRole: 'user', organizationId: 'org-1' },
  }),
}));

// Mock ecosystem context
vi.mock('../../contexts/EcosystemContext', () => ({
  useEcosystem: () => ({ isGlobal: false }),
}));

// Mock api context
vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => ({
    users: {
      update: vi.fn().mockResolvedValue({}),
    },
  }),
}));

// Mock toast context
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
  }),
}));

const mockUsers: UserProfile[] = [
  { uid: 'owner-1', email: 'owner@test.com', displayName: 'Dono Org', roleId: 'role-owner', specialtyIds: ['inst-1'] } as UserProfile,
  { uid: 'user-2', email: 'membro@test.com', displayName: 'Membro Teste', roleId: '', specialtyIds: [] } as UserProfile,
];

const mockRoles: Role[] = [
  {
    id: 'role-owner',
    name: 'Dono',
    description: 'Acesso total',
    permissions: {
      canManageUsers: true,
      canManageRoles: true,
      canManageRepertoire: true,
      canManageScales: true,
      canViewContent: true,
      canManageChords: true,
    },
  },
  {
    id: 'role-musician',
    name: 'Músico',
    description: 'Acesso a músicas e escalas',
    permissions: {
      canManageUsers: false,
      canManageRoles: false,
      canManageRepertoire: false,
      canManageScales: false,
      canViewContent: true,
      canManageChords: false,
    },
  },
];

const mockInstruments: Instrument[] = [
  { id: 'inst-1', name: 'Ministro de Louvor', category: 'Ministro' },
  { id: 'inst-2', name: 'Violão', category: 'Instrumento' },
];

describe('TeamSetupGuide Component UI', () => {
  const onRefreshUsers = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Step 1 (Understanding) correctly with start button', () => {
    render(
      <MemoryRouter>
        <TeamSetupGuide
          users={mockUsers}
          roles={mockRoles}
          instruments={mockInstruments}
          isOverLimit={false}
          onRefreshUsers={onRefreshUsers}
          onClose={onClose}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Configure sua equipe')).toBeInTheDocument();
    expect(screen.getByText('Vínculo com a organização')).toBeInTheDocument();
    expect(screen.getByText('Perfil de acesso')).toBeInTheDocument();
    expect(screen.getByText('Funções na equipe')).toBeInTheDocument();

    const startButton = screen.getByRole('button', { name: /Começar configuração/i });
    expect(startButton).toBeInTheDocument();
  });

  it('advances from Step 1 to Step 2 (Choose person) when clicking Começar configuração', () => {
    render(
      <MemoryRouter>
        <TeamSetupGuide
          users={mockUsers}
          roles={mockRoles}
          instruments={mockInstruments}
          isOverLimit={false}
          onRefreshUsers={onRefreshUsers}
          onClose={onClose}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /Começar configuração/i }));

    expect(screen.getByText('ESCOLHER PESSOA')).toBeInTheDocument();
    expect(screen.getByText('Membro Teste')).toBeInTheDocument();
  });
});
