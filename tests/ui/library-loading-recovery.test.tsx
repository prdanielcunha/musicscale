import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import LibraryPage, { LIBRARY_LOAD_TIMEOUT_MS } from '../../pages/LibraryPage';
import { getGlobalSongs } from '../../services/globalLibraryService';

vi.mock('../../services/globalLibraryService', () => ({
  getGlobalSongs: vi.fn(),
  getGlobalLibraryMetrics: vi.fn().mockResolvedValue({ total: 0, completa: 0, cifra: 0, letra: 0 }),
  incrementGlobalSongImportCount: vi.fn(),
  updateGlobalSongStatus: vi.fn(),
  deleteGlobalSong: vi.fn(),
  updateGlobalSong: vi.fn(),
  updateGlobalSongFreshnessInBatch: vi.fn(),
  updateGlobalSongLanguageInBatch: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ organization: { id: 'org-1' }, user: { uid: 'user-1' }, userProfile: { uid: 'user-1' } }),
  useFeatures: () => ({ canAccessGlobalLibrary: () => true }),
}));
vi.mock('../../contexts/MusicDataContext', () => {
  const music = { songs: [], refreshData: vi.fn() };
  return { useMusic: () => music };
});
vi.mock('../../contexts/ApiContext', () => ({ useApi: () => ({}) }));
vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({ toast: vi.fn(), success: vi.fn(), error: vi.fn(), feedbackToast: vi.fn() }),
}));
vi.mock('../../hooks/useEcosystemAdmin', () => ({ useEcosystemAdmin: () => ({ isEcosystemAdmin: false }) }));
vi.mock('../../hooks/useMusicScaleEntitlements', () => ({
  useMusicScaleUsage: () => ({ usage: {}, limits: {} }),
  useMusicScaleEntitlements: () => ({ entitlements: {}, refresh: vi.fn() }),
  useMusicScalePlan: () => ({ plan: 'advanced', loading: false }),
  useMusicScaleFeature: () => true,
}));
vi.mock('../../hooks/useStarterPackAllowance', () => ({
  useStarterPackAllowance: () => ({ allowance: null, loading: false, error: null, refreshAllowance: vi.fn(), starterPack: [] }),
}));
vi.mock('../../components/library/LibrarySongCard', () => ({
  LibrarySongCard: ({ song }: any) => <div>{song.title}</div>,
}));
vi.mock('../../components/library/LibrarySongListRow', () => ({
  LibrarySongListRow: ({ song }: any) => <div>{song.title}</div>,
}));
vi.mock('../../components/library/LockedLibraryPreview', () => ({ LockedLibraryPreview: () => null }));
vi.mock('../../components/songs/AiSongImportModal', () => ({ default: () => null }));
vi.mock('../../components/songs/SongForm', () => ({ default: () => null }));
vi.mock('../../components/onboarding/StarterRepertoireModal', () => ({ StarterRepertoireModal: () => null }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback: string, values?: Record<string, string>) => {
    if (!values) return fallback;
    return Object.entries(values).reduce((text, [key, value]) => text.replace(`{{${key}}}`, value), fallback);
  } }),
}));

const mockedGetGlobalSongs = vi.mocked(getGlobalSongs);
const song = (id: string, title: string) => ({ id, title, artist: 'Artist', status: 'active' } as any);
const result = (songs: any[]) => ({ songs, lastVisible: null });
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const renderPage = () => render(<MemoryRouter><LibraryPage /></MemoryRouter>);

describe('LibraryPage recoverable loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renders successful results without an error state', async () => {
    mockedGetGlobalSongs.mockResolvedValue(result([song('one', 'Grace Song')]) as any);
    renderPage();
    expect(await screen.findByText('Grace Song')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível carregar a Biblioteca')).not.toBeInTheDocument();
  });

  it('keeps the normal empty state for a legitimate empty result', async () => {
    mockedGetGlobalSongs.mockResolvedValue(result([]) as any);
    renderPage();
    expect(await screen.findByText('A Biblioteca Viva está sendo preparada')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a recoverable error instead of the empty state after rejection', async () => {
    mockedGetGlobalSongs.mockRejectedValue(new Error('permission-denied'));
    renderPage();
    expect(await screen.findByText('Não foi possível carregar a Biblioteca')).toBeInTheDocument();
    expect(screen.queryByText('A Biblioteca Viva está sendo preparada')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });

  it('ends loading and shows the timeout-specific state deterministically', async () => {
    vi.useFakeTimers();
    mockedGetGlobalSongs.mockReturnValue(new Promise(() => {}) as any);
    renderPage();
    await act(async () => { await vi.advanceTimersByTimeAsync(LIBRARY_LOAD_TIMEOUT_MS); });
    expect(screen.getByText('A Biblioteca demorou para responder')).toBeInTheDocument();
    expect(screen.getByText('Verifique sua conexão e tente novamente.')).toBeInTheDocument();
  });

  it('retries the exact failed search and clears the error after success', async () => {
    vi.useFakeTimers();
    mockedGetGlobalSongs
      .mockResolvedValueOnce(result([]) as any)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(result([song('retry', 'Graça Recovered')]) as any);
    renderPage();
    await act(async () => {});
    fireEvent.change(screen.getByPlaceholderText(/Buscar por música/i), { target: { value: 'graça' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await act(async () => {});
    expect(screen.getByText('Graça Recovered')).toBeInTheDocument();
    expect(mockedGetGlobalSongs).toHaveBeenNthCalledWith(3, 'graça', undefined, 30);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores an older search response that resolves after the current search', async () => {
    vi.useFakeTimers();
    const initial = deferred<any>();
    const amor = deferred<any>();
    const graca = deferred<any>();
    mockedGetGlobalSongs
      .mockReturnValueOnce(initial.promise)
      .mockReturnValueOnce(amor.promise)
      .mockReturnValueOnce(graca.promise);
    renderPage();
    const input = screen.getByPlaceholderText(/Buscar por música/i);
    fireEvent.change(input, { target: { value: 'amor' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    fireEvent.change(input, { target: { value: 'graça' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    await act(async () => { graca.resolve(result([song('b', 'Graça Atual')])); });
    expect(screen.getByText('Graça Atual')).toBeInTheDocument();
    await act(async () => { amor.resolve(result([song('a', 'Amor Antigo')])); });
    expect(screen.queryByText('Amor Antigo')).not.toBeInTheDocument();
  });

  it('ignores a timed-out response after a newer query succeeds', async () => {
    vi.useFakeTimers();
    const timedOut = deferred<any>();
    mockedGetGlobalSongs
      .mockReturnValueOnce(timedOut.promise)
      .mockResolvedValueOnce(result([song('new', 'Nova Consulta')]) as any);
    renderPage();
    await act(async () => { await vi.advanceTimersByTimeAsync(LIBRARY_LOAD_TIMEOUT_MS); });
    const input = screen.getByPlaceholderText(/Buscar por música/i);
    fireEvent.change(input, { target: { value: 'nova' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(screen.getByText('Nova Consulta')).toBeInTheDocument();
    await act(async () => { timedOut.resolve(result([song('old', 'Resposta Tardia')])); });
    expect(screen.queryByText('Resposta Tardia')).not.toBeInTheDocument();
  });

  it('preserves the first page and shows retry when load-more fails', async () => {
    const firstPage = Array.from({ length: 30 }, (_, index) => song(`song-${index}`, `Song ${index}`));
    mockedGetGlobalSongs
      .mockResolvedValueOnce(result(firstPage) as any)
      .mockRejectedValueOnce(new Error('load-more failed'));
    renderPage();
    expect(await screen.findByText('Song 0')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais músicas' }));
    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(screen.getByText('Song 0')).toBeInTheDocument();
    expect(screen.queryByText('A Biblioteca Viva está sendo preparada')).not.toBeInTheDocument();
  });
});
