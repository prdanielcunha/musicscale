import '@testing-library/jest-dom';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UsersPage from '../../pages/UsersPage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import pt from '../../locales/pt.json';
import { MemoryRouter } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

import { ToastProvider } from "../../contexts/ToastContext";
vi.unmock('react-i18next');
i18n
  .use(initReactI18next)
  .init({
    resources: { pt: { translation: pt } },
    lng: 'pt',
    fallbackLng: 'pt',
    interpolation: { escapeValue: false }
  });

vi.mock('../../hooks/useCapability', () => ({
  useCapability: () => ({ hasCapability: () => true })
}));

const mockUsers = [
  { uid: 'u1', email: 'test1@test.com', displayName: 'Incomplete', roleId: '' },
  { uid: 'u2', email: 'test2@test.com', displayName: 'Complete', roleId: 'r1', specialtyIds: ['i1'] }
];

const mockRoles = [
  { id: 'r1', name: 'Member', permissions: {} }
];

const mockInstruments = [
  { id: 'i1', name: 'Vocal', category: 'Voz' }
];

const apiUpdateMock = vi.fn().mockResolvedValue(undefined);

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
  AuthContext: {}
}));

vi.mock('../../contexts/ApiContext', () => ({
  useApi: vi.fn(),
  ApiContext: {}
}));

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: vi.fn(),
  MusicDataContext: {}
}));

import { useApi } from '../../contexts/ApiContext';
import { useMusic } from '../../contexts/MusicDataContext';

describe('UsersPage Integration ExistingMemberSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPage = (users = mockUsers) => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: 'u3' } as any,
      userProfile: { uid: 'u3', email: 'a@a.com', organizationRole: 'admin', organizationId: 'org1' } as any,
      organization: { id: 'org1', ownerUserId: 'owner' } as any,
      isGlobal: false,
      isAuthenticated: true,
      loading: false,
      entitlements: {} as any,
      refreshProfile: vi.fn(),
      signOut: vi.fn()
    } as any);

    vi.mocked(useApi).mockReturnValue({
      users: {
        list: vi.fn().mockResolvedValue(users),
        update: apiUpdateMock
      }
    } as any);

    vi.mocked(useMusic).mockReturnValue({
      roles: mockRoles,
      instruments: mockInstruments,
      loading: false
    } as any);

    return render(
      <MemoryRouter>
        <ToastProvider><UsersPage /></ToastProvider>
      </MemoryRouter>
    );
  };

  it('1. integrante incompleto mostra "Configurar pessoa";', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.configureAction)).toBeInTheDocument();
    });
  });

  it('2. clicar abre o guia;', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(pt.teamSetup.progress.configureAction)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(pt.teamSetup.progress.configureAction));
    expect(screen.getByText(pt.teamSetup.existingMember.steps.choosePerson)).toBeInTheDocument();
  });
});
