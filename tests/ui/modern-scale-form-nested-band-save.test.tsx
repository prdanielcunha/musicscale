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

if (typeof window !== 'undefined') {
  window.requestAnimationFrame = (callback) => {
    return setTimeout(callback, 0) as any;
  };
  window.cancelAnimationFrame = (id) => {
    clearTimeout(id);
  };
}

if (typeof window !== 'undefined' && (!window.crypto || !window.crypto.randomUUID)) {
  const cryptoMock = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2)
  };
  (window as any).crypto = { ...window.crypto, ...cryptoMock };
}
if (typeof global !== 'undefined' && (!global.crypto || !(global.crypto as any).randomUUID)) {
  const cryptoMock = {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substring(2)
  };
  (global as any).crypto = { ...global.crypto, ...cryptoMock } as any;
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: { 
        "scaleModal.createNew": "Nova Escala",
        "scaleModal.createBandScaleBtn": "Nova Escala",
        "scaleModal.stepEvent": "Evento",
        "scaleModal.stepBuild": "Banda",
        "scaleModal.stepLink": "Banda",
        "scaleModal.stepLinkBand": "Banda",
        "scaleModal.stepFormation": "Formação",
        "scaleModal.stepReview": "Revisão",
        "scaleModal.date": "Data",
        "scaleModal.time": "Horário",
        "scaleModal.eventType": "Culto/Evento",
        "scaleModal.location": "Local",
        "scaleModal.eventName": "Nome do Evento (Opcional)",
        "scaleModal.next": "Avançar",
        "scaleModal.back": "Voltar",
        "scaleModal.cancel": "Cancelar",
        "scaleModal.saveScale": "Salvar Escala",
        "scaleModal.saveMusicScale": "Salvar Escala",
        "scaleModal.selectPlaceholder": "Selecione...",
        "scaleModal.selectUserPlaceholder": "Selecione um integrante",
        "scaleModal.addInstrumentHint": "Adicionar {{instrument}}",
        "scaleModal.noBandScaleTitle": "Nenhuma escala de banda selecionada",
        "scaleModal.linkBandScale": "Vincular Escala da Banda",
        "scaleModal.linkBandDesc": "Selecione uma escala da banda",
        "scaleModal.noBandScales": "Nenhuma escala da banda disponível",
        "scaleModal.noBandScalesDesc": "Criar nova escala da banda",
        "bandScaleModal.useSavedFormation": "Usar Formação Salva",
        "bandScaleModal.chooseFunction": "Escolher Função",
        "bandScaleModal.addAs": "Adicionar como",
        "scaleModal.reviewSummary": "Resumo da Escala",
        "scaleModal.requiredFields": "Preencha Data, Horário, Culto e Local antes de avançar.",
        "scaleModal.minimumOneSong": "Selecione pelo menos uma música para a escala de músicas.",
        "scaleModal.minimumOneMember": "Adicione pelo menos um integrante à escala da banda.",
        "scaleModal.bandScaleCreated": "Escala da banda criada e vinculada com sucesso.",
        "scaleModal.musicCount": "{{count}} músicas",
        "scaleModal.memberCount": "{{count}} integrantes",
        "scaleModal.bandLinked": "Banda vinculada",
        "scaleModal.bandNotLinked": "Sem banda",
        "scaleModal.musicLinked": "Músicas vinculadas",
        "scaleModal.musicNotLinked": "Sem músicas",
        "scaleModal.optional": "Opcional"
      } }
    },
    lng: "pt",
    fallbackLng: "pt",
    interpolation: { escapeValue: false }
  });

const mockBandScaleCommandsCreate = vi.fn();
const mockBandScalesCreate = vi.fn();
const mockRefreshData = vi.fn();

let isCommandApiV1EnabledMock = true;

vi.mock('../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: (flag: string) => {
    if (flag === 'musicscale.bandScaleCommandApiV1') {
      return isCommandApiV1EnabledMock;
    }
    if (flag === 'musicscale.musicScalePublishCommandV1') {
      return false;
    }
    return false;
  }
}));

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => ({
    songs: [{ id: 'song-1', title: 'Song 1' }],
    eventTypes: [{ id: 'et-1', name: 'Culto' }],
    locations: [{ id: 'loc-1', name: 'Templo' }],
    eventNames: [],
    instruments: [{ id: 'inst1', name: 'Violão', category: 'Instrumento' }],
    tags: [],
    fixedBandScales: [],
    allUsers: [{ uid: 'u1', id: 'u1', displayName: 'User One', specialtyIds: ['inst1'], organizationId: 'org-abc' }],
    populatedBandScales: [],
    populatedScales: [],
    refreshData: mockRefreshData,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    userProfile: { uid: 'u1', displayName: 'User 1', organizationId: 'org-abc' },
    user: { uid: 'u1' },
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
      orgId: 'org-abc'
    },
    updateScaleSongSettings: vi.fn(),
  }),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    toast: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('ModernScaleForm - Nested Band Scale Save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBandScaleCommandsCreate.mockResolvedValue({ scaleId: 'new-bs-1' });
    mockBandScalesCreate.mockResolvedValue('new-bs-1');
  });

  const createNestedBandScale = async () => {
    const onSaveMusicScale = vi.fn();
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        scaleToEdit={null}
        preselectedSongIds={['song-1']}
        onSave={onSaveMusicScale}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );

    // Step 0: Event - Parent Music Scale
    const dateInput = screen.getByLabelText(/Data/i);
    fireEvent.change(dateInput, { target: { value: '2026-08-20' } });
    
    const timeInput = screen.getByLabelText(/Horário/i);
    fireEvent.change(timeInput, { target: { value: '19:00' } });

    const eventTypeSelect = screen.getByLabelText(/Culto\/Evento/i);
    fireEvent.change(eventTypeSelect, { target: { value: 'et-1' } });
    
    const locationSelect = screen.getByLabelText(/Local/i);
    fireEvent.change(locationSelect, { target: { value: 'loc-1' } });

    // Advance parent MusicScale from Step 0 ('event') to Step 1 ('link')
    const parentNextBtn = screen.getByRole('button', { name: /Avançar/i });
    fireEvent.click(parentNextBtn);

    // Step 1: Link Band - Click "Nova Escala" to open nested BandScale form
    await waitFor(() => {
      expect(screen.getByText('Nova Escala')).toBeInTheDocument();
    });
    const newBandButton = screen.getByText('Nova Escala');
    fireEvent.click(newBandButton);

    // The nested BandScale form appears as top-most dialog
    const nestedForms = screen.getAllByRole('dialog');
    const nestedForm = nestedForms[nestedForms.length - 1];

    // Step 0: Event - Band Scale
    const nextToLinkButton = within(nestedForm).getByRole('button', { name: /Avançar/i });
    fireEvent.click(nextToLinkButton);

    // Step 1: Link Music - Band Scale
    const nextToBuildButton = within(nestedForm).getByRole('button', { name: /Avançar/i });
    fireEvent.click(nextToBuildButton);

    // Step 2: Build - Band Scale (BandBuilder)
    await waitFor(() => {
      expect(within(nestedForm).getByText(/Violão/i)).toBeInTheDocument();
    });

    const violaoInstrumentBtn = within(nestedForm).getByText(/Violão/i);
    fireEvent.click(violaoInstrumentBtn);

    await waitFor(() => {
      expect(within(nestedForm).getByTestId('add-assignment-u1-inst1')).toBeInTheDocument();
    });
    const addAssignmentBtn = within(nestedForm).getByTestId('add-assignment-u1-inst1');
    fireEvent.click(addAssignmentBtn);

    const nextToReviewBtn = within(nestedForm).getByRole('button', { name: /Avançar/i });
    fireEvent.click(nextToReviewBtn);

    // Step 3: Review - Band Scale
    await waitFor(() => {
      expect(within(nestedForm).getByRole('button', { name: /Salvar Escala/i })).toBeInTheDocument();
    });

    const saveScaleBtn = within(nestedForm).getByRole('button', { name: /Salvar Escala/i });
    fireEvent.click(saveScaleBtn);

    return { nestedForm };
  };

  it('1. CENÁRIO 1 - COMMAND API: passes correct arguments with time explicitly empty or null', async () => {
    isCommandApiV1EnabledMock = true;
    await createNestedBandScale();

    await waitFor(() => {
      expect(mockBandScaleCommandsCreate).toHaveBeenCalledTimes(1);
    });

    expect(mockBandScalesCreate).not.toHaveBeenCalled();

    const [payload, idempotencyKey] = mockBandScaleCommandsCreate.mock.calls[0];
    
    expect(payload.data).toBeUndefined(); // Must NOT be wrapped in { data }
    expect(payload.idempotencyKey).toBeUndefined(); 
    expect(payload.date).toBe('2026-08-20');
    expect(payload.eventTypeId).toBe('et-1');
    expect(payload.locationId).toBe('loc-1');
    expect(payload.assignments).toHaveLength(1);
    expect(payload.assignments[0].userId).toBe('u1');
    expect(payload.assignments[0].instrumentId).toBe('inst1');
    
    // time should be empty/null/undefined
    expect(['', null, undefined]).toContain(payload.time);

    expect(idempotencyKey).toBeTruthy();
    expect(typeof idempotencyKey).toBe('string');
    expect(idempotencyKey.length).toBeGreaterThan(0);
  });

  it('2. CENÁRIO 2 - LEGACY WRITER: passes correct arguments', async () => {
    isCommandApiV1EnabledMock = false;
    await createNestedBandScale();

    await waitFor(() => {
      expect(mockBandScalesCreate).toHaveBeenCalledTimes(1);
    });

    expect(mockBandScaleCommandsCreate).not.toHaveBeenCalled();

    const [payload] = mockBandScalesCreate.mock.calls[0];
    
    expect(payload.data).toBeUndefined(); 
    expect(payload.date).toBe('2026-08-20');
    expect(payload.eventTypeId).toBe('et-1');
    expect(payload.locationId).toBe('loc-1');
    expect(payload.assignments).toHaveLength(1);
    expect(payload.assignments[0].userId).toBe('u1');
    expect(payload.assignments[0].instrumentId).toBe('inst1');
  });
  
  it('3. CENÁRIO 3 - INTEGRAÇÃO COM FORMULÁRIO PAI: after success, parent remains open and receives bandScaleId', async () => {
    isCommandApiV1EnabledMock = true;
    const { nestedForm } = await createNestedBandScale();

    await waitFor(() => {
      expect(mockRefreshData).toHaveBeenCalled();
    });

    // The nested form should be closed
    await waitFor(() => {
      expect(nestedForm).not.toBeInTheDocument();
    });
    
    // The parent form remains open
    const remainingModals = screen.getAllByRole('dialog');
    expect(remainingModals.length).toBe(1);
    
    // Confirm parent form shows band is linked
    expect(screen.getByText(/Banda vinculada/i)).toBeInTheDocument();
  });

  it('4. CENÁRIO 4 - ERRO: when writer rejects, nested modal remains open with data preserved', async () => {
    isCommandApiV1EnabledMock = true;
    mockBandScaleCommandsCreate.mockRejectedValueOnce(new Error('Simulated Save Error'));
    
    const { nestedForm } = await createNestedBandScale();

    await waitFor(() => {
      expect(mockBandScaleCommandsCreate).toHaveBeenCalledTimes(1);
    });

    // The nested form should still be in document
    await waitFor(() => {
      expect(nestedForm).toBeInTheDocument();
    });

    // Save button is re-enabled for retry
    const saveButton = within(nestedForm).getByRole('button', { name: /Salvar Escala/i });
    expect(saveButton).not.toBeDisabled();

    // Member assignment is still preserved in review
    expect(within(nestedForm).getByText(/User One/i)).toBeInTheDocument();
  });

  it('BandScale aninhada pode ser salva sem horário', async () => {
    isCommandApiV1EnabledMock = true;
    await createNestedBandScale();

    await waitFor(() => {
      expect(mockBandScaleCommandsCreate).toHaveBeenCalledTimes(1);
    });

    const [payload] = mockBandScaleCommandsCreate.mock.calls[0];
    // Confirms time is empty string, null, or undefined and doesn't block saving
    expect(['', null, undefined]).toContain(payload.time);
  });
});
