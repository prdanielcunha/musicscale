import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AiConnectionDiagnosticsPage from '../../pages/AiConnectionDiagnosticsPage';

const probe = vi.hoisted(() => vi.fn());
vi.mock('../../services/firebase', () => ({ verifyMusicScaleAiConnection: probe }));
afterEach(() => { cleanup(); probe.mockReset(); });

describe('AI connection diagnostic without user authentication', () => {
  it('runs on demand, blocks concurrent probes, and reports success without exposing tokens', async () => {
    let finish!: () => void;
    probe.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    render(<AiConnectionDiagnosticsPage />);
    expect(probe).not.toHaveBeenCalled();
    const button = screen.getByRole('button', { name: 'Verificar conexão' });
    fireEvent.click(button);
    await waitFor(() => expect(probe).toHaveBeenCalledTimes(1));
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(probe).toHaveBeenCalledTimes(1);
    finish();
    await screen.findByText(/Conexão segura verificada/);
    expect(button).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent(/conta autenticada/);
  });

  it('shows only an allowlisted SDK code and allows another attempt after failure', async () => {
    probe.mockRejectedValueOnce({ code: 'appCheck/recaptcha-error', message: 'secret-token pasted-song' }).mockResolvedValueOnce(undefined);
    render(<AiConnectionDiagnosticsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar conexão' }));
    await screen.findByText('appCheck/recaptcha-error');
    expect(screen.queryByText(/secret-token|pasted-song/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Verificar conexão' }));
    await screen.findByText(/Conexão segura verificada/);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('never renders arbitrary error codes or raw exception messages', async () => {
    probe.mockRejectedValue({ code: 'token=secret-value', message: 'private-song' });
    render(<AiConnectionDiagnosticsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Verificar conexão' }));
    await screen.findByText('AI_CONNECTION_CHECK_FAILED');
    expect(screen.queryByText(/secret-value|private-song/)).toBeNull();
  });
});
