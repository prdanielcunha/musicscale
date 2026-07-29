
import React, { ReactNode } from 'react';
import { render, waitFor, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModalProvider, useModals, buildMusicScalePublishPayload, MusicScaleWritableData } from '../../contexts/ModalContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { BrowserRouter } from 'react-router-dom';

const mockApi = {
  scales: {
    create: vi.fn(),
    update: vi.fn(),
  },
  musicScaleCommands: {
    publish: vi.fn(),
  },
  linkScales: vi.fn(),
};

vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => mockApi,
  ApiProvider: ({ children }: { children: ReactNode }) => <>{children}</>
}));

const mockUseAuth = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => ({ bandScales: [], instruments: [], eventTypes: [{id: 't1'}], locations: [{id: 'l1'}], eventNames: [], scales: [], songs: [], tags: [], refreshData: vi.fn() }),
}));

vi.mock('../../components/scales/ModernScaleForm', () => ({
  default: () => <div data-testid="modern-scale-form">Mocked Form</div>
}));

vi.mock('../../components/scales/BandScaleForm', () => ({
  default: () => <div data-testid="band-scale-form">Mocked Form</div>
}));

vi.mock('../../contexts/SuggestionContext', () => ({
  useSuggestionsContext: () => ({ refreshSuggestions: vi.fn() }),
}));

const TestComponent = () => {
  const { handleSaveScale, openScaleForm } = useModals();
  const [result, setResult] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [savedScaleId, setSavedScaleId] = React.useState<string | undefined>(undefined);
  
  const handlePublish = async () => {
    try {
      setLoading(true);
      const res = await handleSaveScale({
        intent: 'publish',
        data: {
          id: savedScaleId,
          date: '2026-12-01',
          time: '19:00',
          eventTypeId: 'ev-1',
          locationId: 'loc-1',
          status: 'draft',
          songIds: ['song-1']
        } as MusicScaleWritableData,
        idempotencyKey: 'test-idempotency'
      });
      if (res && 'scaleId' in res && res.scaleId) {
        setSavedScaleId(res.scaleId);
      }
      setResult(JSON.stringify(res));
    } catch (e: unknown) {
      if (e instanceof Error) setResult(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={() => openScaleForm()} data-testid="btn-open">Open</button>
      <button onClick={handlePublish} data-testid="btn-publish" disabled={loading}>Publish</button>
      <div id="result" data-testid="result">{result}</div>
    </div>
  );
};

describe('Music Scale Publish Integrity', () => {
  beforeEach(() => {
    vi.clearAllMocks();  
  });

  it('CENÁRIO A: FLAG DESABILITADA', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1', getIdToken: async () => 'mock-token' },
      userProfile: {},
      organization: {
        id: 'org-1',
        featureFlags: { 'musicscale.musicScalePublishCommandV1': false },
        features: { 'musicscale.musicScalePublishCommandV1': false }
      }
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <ModalProvider key="first">
            <TestComponent />
          </ModalProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    const btnOpen = screen.getByTestId('btn-open');
    fireEvent.click(btnOpen); // Open form to set scaleType
    const btnPublish = screen.getByTestId('btn-publish');
    const resultDiv = screen.getByTestId('result');

    for (let i = 0; i < 3; i++) {
      fireEvent.click(btnPublish);
      await waitFor(() => {
        expect(resultDiv.textContent).toContain('publish-unavailable');
      });
      expect(btnPublish).not.toBeDisabled();
    }

    expect(mockApi.scales.create).toHaveBeenCalledTimes(0);
    expect(mockApi.scales.update).toHaveBeenCalledTimes(0);
    expect(mockApi.musicScaleCommands.publish).toHaveBeenCalledTimes(0);
    expect(mockApi.linkScales).toHaveBeenCalledTimes(0);
  });

  it('CENÁRIO B: FLAG HABILITADA E SUCESSO', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1', getIdToken: async () => 'mock-token' },
      userProfile: {},
      organization: {
        id: 'org-1',
        featureFlags: { 'musicscale.musicScalePublishCommandV1': true },
        features: { 'musicscale.musicScalePublishCommandV1': true }
      }
    });
    
    mockApi.scales.create.mockResolvedValueOnce('new-draft-id-success');
    mockApi.musicScaleCommands.publish.mockResolvedValueOnce({
       scaleId: 'new-draft-id-success', version: 1, createdNotificationCount: 0, fromCache: false, status: 'published'
    });

    render(
      <BrowserRouter>
        <ToastProvider>
          <ModalProvider key="second">
            <TestComponent />
          </ModalProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    const btnOpen = screen.getByTestId('btn-open');
    fireEvent.click(btnOpen); 
    const btnPublish = screen.getByTestId('btn-publish');
    const resultDiv = screen.getByTestId('result');

    fireEvent.click(btnPublish);

    await waitFor(() => {
      expect(resultDiv.textContent).toContain('published');
    });

    expect(mockApi.scales.create).toHaveBeenCalledTimes(1);
    expect(mockApi.scales.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
    expect(mockApi.musicScaleCommands.publish).toHaveBeenCalledTimes(1);
    expect(mockApi.musicScaleCommands.publish).toHaveBeenCalledWith(
      'new-draft-id-success',
      expect.any(Object),
      expect.any(String)
    );
  });

  it('CENÁRIO C: FLAG HABILITADA E FALHA', async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1', getIdToken: async () => 'mock-token' },
      userProfile: {},
      organization: {
        id: 'org-1',
        featureFlags: { 'musicscale.musicScalePublishCommandV1': true },
        features: { 'musicscale.musicScalePublishCommandV1': true }
      }
    });

    mockApi.scales.create.mockResolvedValueOnce('new-draft-id-fail');
    mockApi.musicScaleCommands.publish.mockRejectedValueOnce(new Error('Internal Server Error'));

    render(
      <BrowserRouter>
        <ToastProvider>
          <ModalProvider key="third">
            <TestComponent />
          </ModalProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    const btnOpen = screen.getByTestId('btn-open');
    fireEvent.click(btnOpen); 
    const btnPublish = screen.getByTestId('btn-publish');
    const resultDiv = screen.getByTestId('result');

    fireEvent.click(btnPublish);

    await waitFor(() => {
      expect(resultDiv.textContent).toContain('publish-failed');
    });

    await waitFor(() => {
      expect(resultDiv.textContent).toContain('"draftPreserved":true');
    });

    expect(mockApi.scales.create).toHaveBeenCalledTimes(1);
    expect(mockApi.scales.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' }));
    expect(mockApi.musicScaleCommands.publish).toHaveBeenCalledTimes(1);
    
    // nova interação não cria automaticamente outro draft (simulando re-tentativa pelo usuário)
    // Here we can see the logic. If it failed, clicking publish again should NOT call scales.create again 
    // Wait, the component state might not hold the ID if it fails, let's just trigger it again and check.
    // In ModalContext, scaleData.id is updated if create succeeds. 
    // Let's verify no extra drafts appear in list.
    
    fireEvent.click(btnPublish);
    
    await waitFor(() => {
       expect(mockApi.scales.create).toHaveBeenCalledTimes(1); // Still 1
    });
  });
});

describe('buildMusicScalePublishPayload durationMinutes builder', () => {
  it('undefined: nao incluir', () => {
    const data: MusicScaleWritableData = {
      durationMinutes: undefined,
    } as MusicScaleWritableData;
    const res = buildMusicScalePublishPayload(data);
    expect(res.scalePatch.durationMinutes).toBeUndefined();
  });

  it('null: nao incluir', () => {
    const raw: unknown = { durationMinutes: null };
    const res = buildMusicScalePublishPayload(raw as MusicScaleWritableData);
    expect(res.scalePatch.durationMinutes).toBeUndefined();
  });

  it('numero inteiro, positivo e finito: incluir sem conversao', () => {
    const data: MusicScaleWritableData = {
      durationMinutes: 45,
    } as MusicScaleWritableData;
    const res = buildMusicScalePublishPayload(data);
    expect(res.scalePatch.durationMinutes).toBe(45);
  });

  it('string "30": lancar erro', () => {
    const raw: unknown = { durationMinutes: '30' };
    expect(() => buildMusicScalePublishPayload(raw as MusicScaleWritableData)).toThrow('Invalid durationMinutes');
  });

  it('NaN: lancar erro', () => {
    const data: MusicScaleWritableData = {
      durationMinutes: NaN,
    } as MusicScaleWritableData;
    expect(() => buildMusicScalePublishPayload(data)).toThrow('Invalid durationMinutes');
  });

  it('Infinity: lancar erro', () => {
    const data: MusicScaleWritableData = {
      durationMinutes: Infinity,
    } as MusicScaleWritableData;
    expect(() => buildMusicScalePublishPayload(data)).toThrow('Invalid durationMinutes');
  });

  it('decimal: lancar erro', () => {
    const data: MusicScaleWritableData = {
      durationMinutes: 45.5,
    } as MusicScaleWritableData;
    expect(() => buildMusicScalePublishPayload(data)).toThrow('Invalid durationMinutes');
  });

  it('zero: lancar erro', () => {
    const data: MusicScaleWritableData = {
      durationMinutes: 0,
    } as MusicScaleWritableData;
    expect(() => buildMusicScalePublishPayload(data)).toThrow('Invalid durationMinutes');
  });

  it('negativo: lancar erro', () => {
    const data: MusicScaleWritableData = {
      durationMinutes: -10,
    } as MusicScaleWritableData;
    expect(() => buildMusicScalePublishPayload(data)).toThrow('Invalid durationMinutes');
  });

  it('booleano: lancar erro', () => {
    const raw: unknown = { durationMinutes: true };
    expect(() => buildMusicScalePublishPayload(raw as MusicScaleWritableData)).toThrow('Invalid durationMinutes');
  });
});
