import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', getIdToken: vi.fn() },
    userProfile: { uid: 'user-1', roleId: 'owner' },
    organization: {
      id: 'org-bootstrap',
      name: 'My Workspace',
      slug: 'org-bootstrap',
      city: null,
      state: null,
      onboardingState: 'pending_profile',
    },
    subscription: { status: 'trialing', plan: 'pro' },
    refreshAuthData: vi.fn(),
    isSupportMode: false,
  }),
}));

vi.mock('../../services/firestoreService', () => ({
  seedDefaultRolesForOrg: vi.fn(),
  seedDefaultInstrumentsForOrg: vi.fn(),
  seedDefaultTagsForOrg: vi.fn(),
  seedDefaultEventTypesForOrg: vi.fn(),
  seedDefaultLocationsForOrg: vi.fn(),
}));

import TenantOnboarding from '../../pages/TenantOnboarding';

describe('TenantOnboarding bootstrap profile completion', () => {
  it('does not treat the placeholder Hub slug as completed onboarding', async () => {
    render(<MemoryRouter><TenantOnboarding /></MemoryRouter>);

    expect(screen.getByText('Complete seu Cadastro')).toBeInTheDocument();
    expect(screen.getByText('Informe os dados da sua igreja para preparar o MusicScale.')).toBeInTheDocument();

    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText('Ex: Igreja Central / Banda Viva') as HTMLInputElement;
      expect(nameInput.value).toBe('');
    });

    expect(screen.queryByText('Voltar')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar Configuração' })).toBeDisabled();
  });
});
