import React, { ReactNode } from 'react';
import { render, waitFor, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModalProvider, useModals } from '../../contexts/ModalContext';
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
  ApiProvider: ({ children }: any) => <>{children}</>
}));

let currentFlag = true;
vi.mock('../../contexts/EcosystemContext', () => ({
  useEcosystem: () => ({
    organization: {
      id: 'org-1',
      get featureFlags() {
        return { 'musicscale.musicScalePublishCommandV1': currentFlag };
      },
      get features() {
        return { 'musicscale.musicScalePublishCommandV1': currentFlag };
      }
    }
  }),
}));

const mockUseAuth = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: any) => <>{children}</>
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
  
  const handlePublish = async () => {
    try {
      setLoading(true);
      const res = await handleSaveScale({
        intent: 'publish',
        data: {
          date: '2026-12-01',
          time: '19:00',
          eventTypeId: 'ev-1',
          locationId: 'loc-1',
          status: 'draft',
          songIds: ['song-1']
        } as any,
        scaleType: 'music'
      });
      setResult(JSON.stringify(res));
    } catch (e: any) {
      setResult(e.message);
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
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1', getIdToken: async () => 'mock-token' },
      userProfile: {},
      organization: {
        id: 'org-1',
        featureFlags: { 'musicscale.musicScalePublishCommandV1': false },
        features: { 'musicscale.musicScalePublishCommandV1': false }
      }
    });
    vi.clearAllMocks();  
  });

  it('handles feature flag and draft preservation correctly', async () => {
    const { rerender } = render(
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
    await new Promise(resolve => setTimeout(resolve, 100)); // wait for rerender
    const resultDiv = screen.getByTestId('result');

    // Escala nova sem ID, flag desabilitada, 3 tentativas
    for (let i = 0; i < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      fireEvent.click(btnPublish);
      await waitFor(() => expect(resultDiv.textContent).toContain('publish-unavailable'));
    }

    expect(mockApi.scales.create).toHaveBeenCalledTimes(0);
    expect(mockApi.scales.update).toHaveBeenCalledTimes(0);
    expect(mockApi.musicScaleCommands.publish).toHaveBeenCalledTimes(0);
    expect(mockApi.linkScales).toHaveBeenCalledTimes(0);

    // Flag habilitada
    mockUseAuth.mockReturnValue({
      user: { uid: 'u1', getIdToken: async () => 'mock-token' },
      userProfile: {},
      organization: {
        id: 'org-1',
        featureFlags: { 'musicscale.musicScalePublishCommandV1': true },
        features: { 'musicscale.musicScalePublishCommandV1': true }
      }
    });

    rerender(
      <BrowserRouter>
        <ToastProvider>
          <ModalProvider key="second">
            <TestComponent />
          </ModalProvider>
        </ToastProvider>
      </BrowserRouter>
    );

    await new Promise(r => setTimeout(r, 100));

    const btnOpen2 = screen.getByTestId('btn-open');
    fireEvent.click(btnOpen2); // set scale type again
    
    await new Promise(r => setTimeout(r, 100));

    const btnPublish2 = screen.getByTestId('btn-publish');
    const resultDiv2 = screen.getByTestId('result');

    // Simular API falhando após criar draft
    mockApi.scales.create.mockResolvedValueOnce('new-draft-id-1');
    mockApi.musicScaleCommands.publish.mockRejectedValueOnce(new Error('Internal Server Error'));

    fireEvent.click(btnPublish2);

    await waitFor(() => {
      expect(resultDiv2.textContent).toContain('publish-failed');
    });

    await waitFor(() => expect(resultDiv2.textContent).toContain('"draftPreserved":true'));

    expect(mockApi.scales.create).toHaveBeenCalledTimes(1);
    expect(mockApi.scales.update).toHaveBeenCalledTimes(0);
    expect(mockApi.musicScaleCommands.publish).toHaveBeenCalledTimes(1);
    expect(mockApi.musicScaleCommands.publish).toHaveBeenCalledWith(
      'new-draft-id-1',
      expect.any(Object),
      expect.any(String)
    );
  });
});
