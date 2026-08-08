import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LoginPage from '../../pages/LoginPage';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../services/authService', () => ({
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
  getFirebaseErrorMessage: vi.fn(() => 'Error message'),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultLabel: string) => defaultLabel,
  }),
}));

afterEach(() => {
  cleanup();
});

describe('LoginPage Accessibility', () => {
  it('should associate email and password labels with their respective inputs and have accessible names', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    // Open email login options
    const emailButton = screen.getByRole('button', { name: /Acessar com e-mail/i });
    expect(emailButton).toBeInTheDocument();
    fireEvent.click(emailButton);

    // Verify accessible name for Email field (using async findBy because of motion transitions)
    const emailInput = await screen.findByRole('textbox', { name: /Endereço de e-mail/i });
    expect(emailInput).toBeInTheDocument();
    expect(emailInput).toHaveAttribute('id', 'login-email');

    // Verify accessible name for Password field
    const passwordInput = await screen.findByLabelText('Senha', { exact: true });
    expect(passwordInput).toBeInTheDocument();
    expect(passwordInput).toHaveAttribute('id', 'login-password');

    // Verify accessible name for toggle password button
    const toggleButton = screen.getByRole('button', { name: /Mostrar senha/i });
    expect(toggleButton).toBeInTheDocument();
  });

  it('should associate Seu Nome label with its input in register mode', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    // Open email login options
    const emailButton = screen.getByRole('button', { name: /Acessar com e-mail/i });
    fireEvent.click(emailButton);

    // Wait for and click register toggle
    const registerToggle = await screen.findByRole('button', { name: /Não tem conta\? Criar uma agora/i });
    fireEvent.click(registerToggle);

    // Verify accessible name for "Seu Nome"
    const nameInput = await screen.findByRole('textbox', { name: /Seu Nome/i });
    expect(nameInput).toBeInTheDocument();
    expect(nameInput).toHaveAttribute('id', 'register-display-name');
  });
});
