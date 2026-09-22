import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('../../services/firebase', () => ({
  db: { mockDb: true },
  auth: { mockAuth: true },
}));

import ModernScaleForm from '../../components/scales/ModernScaleForm';

vi.unmock('react-i18next');
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

if (typeof window !== 'undefined' && (!window.crypto || !window.crypto.randomUUID)) {
  (window as any).crypto = {
    ...window.crypto,
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2),
  };
}
if (typeof global !== 'undefined' && (!global.crypto || !(global.crypto as any).randomUUID)) {
  (global as any).crypto = {
    ...global.crypto,
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2),
  };
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: {
        translation: {
          common: {
            cancel: 'Cancelar',
            save: 'Salvar',
            member: 'Integrante',
          },
          scaleModal: {
            musicScaleTitleNew: 'Nova Escala de Músicas',
            bandScaleTitleEdit: 'Editar Escala da Banda',
            scaleModalSubtitleMusic: 'Monte o repertório do culto.',
            scaleModalSubtitleBand: 'Formação da banda.',
            stepEvent: 'Evento',
            stepLinkBand: 'Banda',
            stepLinkMusic: 'Músicas',
            stepSetlist: 'Repertório',
            stepFormation: 'Formação',
            stepReview: 'Revisão',
            date: 'Data',
            time: 'Horário',
            eventType: 'Tipo de Evento',
            location: 'Local',
            eventName: 'Nome do Evento (Opcional)',
            selectPlaceholder: 'Selecione...',
            none: 'Nenhum',
            next: 'Avançar',
            back: 'Voltar',
            cancel: 'Cancelar',
            saveDraft: 'Salvar Rascunho',
            saveScale: 'Salvar Escala',
            publishScale: 'Publicar Escala',
            optional: 'Opcional',
            linkBandScale: 'Selecionar Escala Fixa da Banda',
            linkBandDesc: 'Escolha a formação fixa para este evento.',
            manageFixedBandScales: 'Gerenciar escalas fixas',
            fixedBandScaleSelectorLabel: 'Escala fixa da banda',
            noFixedBandScale: 'Sem escala fixa',
            selected: 'Selecionada',
            fixedBandScaleEventCopyHint: 'A formação será copiada para este evento.',
            linkMusicScale: 'Vincular Escala de Músicas',
            linkMusicDesc: 'Conecte a escala.',
            noMusicScales: 'Nenhuma escala de músicas encontrada',
            noMusicScalesDesc: 'Crie uma escala de músicas.',
            noMusicScalesNoPerm: 'Sem escalas disponíveis.',
            createNew: 'Criar Nova',
            musicCount_zero: '0 músicas',
            musicCount_one: '1 música',
            musicCount_other: '{{count}} músicas',
            memberCount_zero: '0 integrantes',
            memberCount_one: '1 integrante',
            memberCount_other: '{{count}} integrantes',
            bandLinked: 'Banda vinculada',
            bandNotLinked: 'Banda não vinculada',
            musicLinked: 'Músicas vinculadas',
            musicNotLinked: 'Músicas não vinculadas',
            observations: 'Observações',
            observationsPlaceholder: 'Observações...',
            reviewSummary: 'Resumo da Escala',
            minimumOneSong: 'Selecione pelo menos uma música.',
            minimumOneMember: 'Adicione pelo menos um integrante.',
            requiredFields: 'Preencha os campos obrigatórios.',
            invalidDuration: 'Informe uma duração válida.',
            fixedBandScaleApplyError: 'Não foi possível preparar a escala fixa.',
          },
          bandScaleModal: {
            noMusicScaleLinked: 'Nenhuma escala de músicas vinculada',
            reusableFormationTitle: 'Banda fixa e reutilizável',
            reusableFormationDescription: 'Use uma formação salva.',
            useSavedFormation: 'Usar formação salva',
            saveAsFixedFormation: 'Salvar como banda fixa',
            fixedFormationName: 'Nome da banda fixa',
            fixedFormationNamePlaceholder: 'Banda Principal',
            fixedFormationSave: 'Salvar banda fixa',
            chooseFunction: 'Escolher Função',
            addAs: 'Adicionar como',
          },
        },
      },
    },
    lng: 'pt',
    fallbackLng: 'pt',
    interpolation: { escapeValue: false },
  });

const mockBandScaleCommandsCreate = vi.fn();
const mockBandScalesCreate = vi.fn();
const mockFixedBandScalesCreate = vi.fn();
const mockRefreshData = vi.fn();
const mockToast = vi.fn();

let isCommandApiV1EnabledMock = true;

vi.mock('../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: (flag: string) => {
    if (flag === 'musicscale.bandScaleCommandApiV1') return isCommandApiV1EnabledMock;
    if (flag === 'musicscale.musicScalePublishCommandV1') return false;
    return false;
  },
}));

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => ({
    songs: [{ id: 'song-1', title: 'Song 1', artist: 'Artist', key: 'C' }],
    eventTypes: [{ id: 'et-1', name: 'Culto' }],
    locations: [{ id: 'loc-1', name: 'Templo' }],
    eventNames: [],
    instruments: [{ id: 'inst1', name: 'Violão', category: 'Instrumento' }],
    tags: [],
    fixedBandScales: [
      {
        id: 'fixed-1',
        name: 'Banda Principal',
        assignments: [{ userId: 'u1', instrumentId: 'inst1' }],
        createdBy: { uid: 'owner' },
        createdAt: '2026-09-22T00:00:00.000Z',
      },
    ],
    allUsers: [
      {
        uid: 'u1',
        id: 'u1',
        displayName: 'User One',
        email: 'user@example.com',
        specialtyIds: ['inst1'],
        organizationId: 'org-abc',
      },
    ],
    populatedBandScales: [],
    populatedScales: [],
    refreshData: mockRefreshData,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    userProfile: { uid: 'u1', displayName: 'User 1', organizationId: 'org-abc' },
    user: { uid: 'u1', getIdToken: vi.fn().mockResolvedValue('token') },
    organization: { id: 'org-abc' },
  }),
}));

vi.mock('../../hooks/useSafeAction', () => ({
  useSafeAction: () => ({
    executeSafeAction: vi.fn((fn) => fn()),
  }),
}));

vi.mock('../../hooks/useCapability', () => ({
  useCapability: () => ({
    hasCapability: () => true,
  }),
}));

vi.mock('../../contexts/ApiContext', () => ({
  useApi: () => ({
    bandScaleCommands: {
      create: mockBandScaleCommandsCreate,
    },
    bandScales: {
      create: mockBandScalesCreate,
      deleteMany: vi.fn(),
    },
    fixedBandScales: {
      create: mockFixedBandScalesCreate,
      update: vi.fn(),
      delete: vi.fn(),
    },
    scales: {
      deleteMany: vi.fn(),
    },
    songs: {
      update: vi.fn(),
    },
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    toast: mockToast,
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion') as any;
  return {
    ...actual,
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
    motion: {
      ...actual.motion,
      div: React.forwardRef((props: any, ref: any) => {
        const { animate, initial, exit, transition, variants, whileHover, whileTap, ...rest } = props;
        return React.createElement('div', { ref, ...rest });
      }),
      button: React.forwardRef((props: any, ref: any) => {
        const { animate, initial, exit, transition, variants, whileHover, whileTap, ...rest } = props;
        return React.createElement('button', { ref, ...rest });
      }),
    },
  };
});

const reachFixedBandStep = async (onSave = vi.fn().mockResolvedValue(undefined)) => {
  render(
    <ModernScaleForm
      isOpen={true}
      scaleType="music"
      scaleToEdit={null}
      preselectedSongIds={['song-1']}
      onSave={onSave}
      onClose={vi.fn()}
      isSubmitting={false}
    />,
  );

  const dialog = screen.getByTestId('music-scale-modal');
  fireEvent.change(within(dialog).getByLabelText(/^Data/i), { target: { value: '2026-09-28' } });
  fireEvent.change(within(dialog).getByLabelText(/Horário/i), { target: { value: '19:00' } });
  fireEvent.change(within(dialog).getByLabelText(/Tipo de Evento/i), { target: { value: 'et-1' } });
  fireEvent.change(within(dialog).getByLabelText(/^Local/i), { target: { value: 'loc-1' } });
  fireEvent.click(within(dialog).getByRole('button', { name: /Avançar/i }));

  await waitFor(() => {
    expect(within(dialog).getByLabelText(/Escala fixa da banda/i)).toBeInTheDocument();
  });

  return { dialog, onSave };
};

const selectFixedBandAndSaveDraft = async (onSave = vi.fn().mockResolvedValue(undefined)) => {
  const result = await reachFixedBandStep(onSave);
  const { dialog } = result;

  fireEvent.change(within(dialog).getByLabelText(/Escala fixa da banda/i), {
    target: { value: 'fixed-1' },
  });

  expect(within(dialog).getByText('Banda Principal')).toBeInTheDocument();
  expect(within(dialog).getByText(/User One/)).toBeInTheDocument();

  fireEvent.click(within(dialog).getByRole('button', { name: /Avançar/i }));
  fireEvent.click(within(dialog).getByRole('button', { name: /Avançar/i }));

  const saveDraft = await within(dialog).findByTestId('save-scale-draft');
  fireEvent.click(saveDraft);

  return result;
};

describe('ModernScaleForm - fixed band formations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isCommandApiV1EnabledMock = true;
    mockBandScaleCommandsCreate.mockResolvedValue({ scaleId: 'snapshot-bs-1' });
    mockBandScalesCreate.mockResolvedValue('snapshot-bs-legacy');
    mockFixedBandScalesCreate.mockResolvedValue('fixed-created');
  });

  it('uses a fixed formation and materializes an internal event snapshot through the command API', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await selectFixedBandAndSaveDraft(onSave);

    await waitFor(() => {
      expect(mockBandScaleCommandsCreate).toHaveBeenCalledTimes(1);
    });

    const [snapshot, idempotencyKey] = mockBandScaleCommandsCreate.mock.calls[0];
    expect(snapshot).toEqual(
      expect.objectContaining({
        date: '2026-09-28',
        time: '19:00',
        eventTypeId: 'et-1',
        locationId: 'loc-1',
        musicScaleId: null,
        assignments: [{ userId: 'u1', instrumentId: 'inst1' }],
      }),
    );
    expect(idempotencyKey).toEqual(expect.any(String));
    expect(mockBandScalesCreate).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          intent: 'save-draft',
          data: expect.objectContaining({
            bandScaleId: 'snapshot-bs-1',
            songIds: ['song-1'],
          }),
        }),
      );
    });
  });

  it('keeps the legacy repository fallback while the feature flag is disabled', async () => {
    isCommandApiV1EnabledMock = false;
    const onSave = vi.fn().mockResolvedValue(undefined);
    await selectFixedBandAndSaveDraft(onSave);

    await waitFor(() => {
      expect(mockBandScalesCreate).toHaveBeenCalledTimes(1);
    });
    expect(mockBandScaleCommandsCreate).not.toHaveBeenCalled();

    expect(mockBandScalesCreate.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        assignments: [{ userId: 'u1', instrumentId: 'inst1' }],
      }),
    );

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ bandScaleId: 'snapshot-bs-legacy' }),
        }),
      );
    });
  });

  it('does not expose per-event band-scale creation in the Music Scale flow', async () => {
    const { dialog } = await reachFixedBandStep();

    expect(within(dialog).getByRole('button', { name: /Gerenciar escalas fixas/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Criar Escala da Banda$/i })).not.toBeInTheDocument();
  });

  it('does not block BandScale navigation when event type and location are optional', async () => {
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="band"
        scaleToEdit={{
          id: 'legacy-band',
          eventTypeId: '',
          locationId: '',
          assignments: [{ userId: 'u1', instrumentId: 'inst1' }],
        }}
        preselectedSongIds={[]}
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />,
    );

    const dialog = screen.getByTestId('band-scale-modal');
    fireEvent.click(within(dialog).getByRole('button', { name: /Avançar/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(/Vincular Escala de Músicas/i)).toBeInTheDocument();
    });

    expect(mockToast).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', message: expect.stringMatching(/Preencha/i) }),
    );
  });
});
