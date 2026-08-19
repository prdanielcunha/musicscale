import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const auth = vi.hoisted(() => ({
  moduleLoads: 0,
  rejectModuleLoad: false,
  signInWithGoogle: vi.fn(),
  signInWithEmail: vi.fn(),
  signUpWithEmail: vi.fn(),
}));

vi.mock('../../services/authService', () => {
  auth.moduleLoads++;
  if (auth.rejectModuleLoad) throw new Error('auth chunk unavailable');
  return {
    signInWithGoogle: auth.signInWithGoogle,
    signInWithEmail: auth.signInWithEmail,
    signUpWithEmail: auth.signUpWithEmail,
  };
});

const Destination = () => {
  const location = useLocation();
  return <div>destination:{location.pathname}</div>;
};

async function renderLogin(path = '/login') {
  window.history.replaceState({}, '', path);
  const { default: LoginPage } = await import('../../pages/LoginPage');
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openEmailForm() {
  fireEvent.click(screen.getByRole('button', { name: /Acessar com e-mail/i }));
  return screen.findByRole('textbox', { name: /Endereço de e-mail/i });
}

async function fillCredentials() {
  const emailInput = await openEmailForm();
  fireEvent.change(emailInput, { target: { value: 'member@example.com' } });
  fireEvent.change(screen.getByLabelText('Senha', { exact: true }), { target: { value: 'secret123' } });
}

describe('LoginPage deferred authentication runtime', () => {
  beforeEach(() => {
    vi.resetModules();
    auth.moduleLoads = 0;
    auth.rejectModuleLoad = false;
    auth.signInWithGoogle.mockReset().mockResolvedValue({ user: { uid: 'google-user' } });
    auth.signInWithEmail.mockReset().mockResolvedValue({ user: { uid: 'email-user' } });
    auth.signUpWithEmail.mockReset().mockResolvedValue({ user: { uid: 'new-user' } });
  });

  afterEach(() => cleanup());

  it('renders cold login without loading or calling the authentication service', async () => {
    await renderLogin();
    expect(screen.getByRole('button', { name: /Continuar com Google/i })).toBeEnabled();
    expect(auth.moduleLoads).toBe(0);
    expect(auth.signInWithGoogle).not.toHaveBeenCalled();
    expect(auth.signInWithEmail).not.toHaveBeenCalled();
    expect(auth.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('loads Google authentication on request and preserves a safe redirect', async () => {
    await renderLogin('/login?redirect=%2Fsongs');
    fireEvent.click(screen.getByRole('button', { name: /Continuar com Google/i }));
    await screen.findByText('destination:/songs');
    expect(auth.moduleLoads).toBe(1);
    expect(auth.signInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('passes email, password, and remember-me to deferred email authentication', async () => {
    await renderLogin();
    await fillCredentials();
    fireEvent.click(screen.getByText('Permanecer conectado'));
    fireEvent.click(screen.getByRole('button', { name: 'Acessar Plataforma' }));
    await screen.findByText('destination:/start');
    expect(auth.signInWithEmail).toHaveBeenCalledWith('member@example.com', 'secret123', false);
    expect(auth.signUpWithEmail).not.toHaveBeenCalled();
  });

  it('passes registration fields to deferred signup', async () => {
    await renderLogin();
    await fillCredentials();
    fireEvent.click(screen.getByRole('button', { name: /Não tem conta\? Criar uma agora/i }));
    fireEvent.change(await screen.findByRole('textbox', { name: /Seu Nome/i }), { target: { value: 'New Member' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar Conta' }));
    await screen.findByText('destination:/start');
    expect(auth.signUpWithEmail).toHaveBeenCalledWith('member@example.com', 'secret123', 'New Member');
    expect(auth.signInWithEmail).not.toHaveBeenCalled();
  });

  it('resolves loading and renders the mapped authentication failure', async () => {
    auth.signInWithGoogle.mockRejectedValue({ code: 'auth/popup-blocked' });
    await renderLogin();
    fireEvent.click(screen.getByRole('button', { name: /Continuar com Google/i }));
    expect(await screen.findByText('O popup de login foi bloqueado pelo navegador. Permita popups para este site.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /Continuar com Google/i })).toBeEnabled());
  });

});
