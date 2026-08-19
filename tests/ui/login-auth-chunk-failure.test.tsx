import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const moduleState = vi.hoisted(() => ({ loadAttempts: 0 }));

vi.mock('../../services/authService', () => {
  moduleState.loadAttempts++;
  throw new Error('auth chunk unavailable');
});

import LoginPage from '../../pages/LoginPage';

afterEach(() => cleanup());

describe('LoginPage deferred authentication chunk failure', () => {
  it('resolves loading, keeps the UI usable, and starts no authentication mutation', async () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Continuar com Google/i }));
    expect(await screen.findByText('Ocorreu um erro desconhecido. Tente novamente.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Continuar com Google/i })).toBeEnabled());
    expect(moduleState.loadAttempts).toBe(1);
    expect(screen.queryByText(/destination:/)).not.toBeInTheDocument();
  });
});
