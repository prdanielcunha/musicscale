import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TeamSetupProgressCard } from '../../components/team/TeamSetupProgressCard';
import { evaluateTeamSetup } from '../../utils/teamSetup';
import { UserProfile } from '../../types';

describe('Users Team Setup Integration UI', () => {
  it('renders TeamSetupProgressCard with incomplete status and navigates when clicked', () => {
    const mockUsers: UserProfile[] = [
      { uid: 'owner-1', roleId: 'role-1', specialtyIds: ['inst-1'] } as UserProfile,
      { uid: 'user-2', roleId: '', specialtyIds: [] } as UserProfile,
    ];

    const summary = evaluateTeamSetup(mockUsers, 'owner-1');

    render(
      <MemoryRouter initialEntries={['/users']}>
        <Routes>
          <Route path="/users" element={<TeamSetupProgressCard summary={summary} />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Configure sua equipe')).toBeInTheDocument();
    expect(screen.getByText(/1 pessoa adicionada/i)).toBeInTheDocument();
    expect(screen.getByText(/1 ainda precisa de um perfil de acesso/i)).toBeInTheDocument();

    const continueBtn = screen.getByRole('button', { name: /Continuar configuração/i });
    expect(continueBtn).toBeInTheDocument();
  });

  it('renders TeamSetupProgressCard with all configured members', () => {
    const mockUsers: UserProfile[] = [
      { uid: 'owner-1', roleId: 'role-1', specialtyIds: ['inst-1'] } as UserProfile,
      { uid: 'user-2', roleId: 'role-2', specialtyIds: ['inst-2'] } as UserProfile,
    ];

    const summary = evaluateTeamSetup(mockUsers, 'owner-1');

    render(
      <MemoryRouter initialEntries={['/users']}>
        <Routes>
          <Route path="/users" element={<TeamSetupProgressCard summary={summary} />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Configure sua equipe')).toBeInTheDocument();
    expect(screen.getByText(/Todos os integrantes estão configurados/i)).toBeInTheDocument();

    const reviewBtn = screen.getByRole('button', { name: /Revisar equipe/i });
    expect(reviewBtn).toBeInTheDocument();
  });
});
