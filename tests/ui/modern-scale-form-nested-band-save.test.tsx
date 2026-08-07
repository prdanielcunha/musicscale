import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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
        "scaleModal.newBandScale": "Nova Escala",
        "scaleModal.stepEvent": "Evento",
        "scaleModal.stepBuild": "Banda",
        "scaleModal.stepLink": "Banda",
        "scaleModal.stepReview": "Revisão",
        "scaleModal.dateLabel": "Data",
        "scaleModal.timeLabel": "Horário",
        "scaleModal.eventTypeLabel": "Culto/Evento",
        "scaleModal.locationLabel": "Local",
        "scaleModal.eventNameLabel": "Nome do Evento (Opcional)",
        "scaleModal.nextToBuild": "Avançar",
        "scaleModal.nextToReview": "Avançar",
        "scaleModal.saveScale": "Salvar Escala",
        "scaleModal.saveMusicScale": "Salvar Escala",
        "scaleModal.selectUserPlaceholder": "Selecione um integrante",
        "scaleModal.addInstrumentHint": "Adicionar {{instrument}}",
        "scaleModal.noBandScaleTitle": "Nenhuma escala de banda selecionada"
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
    if (flag === 'ff_ms_command_api_v1') return isCommandApiV1EnabledMock;
    return false;
  }
}));

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => ({
    songs: [],
    eventTypes: [{ id: 'et-1', name: 'Culto' }],
    locations: [{ id: 'loc-1', name: 'Templo' }],
    eventNames: [],
    instruments: [{ id: 'inst1', name: 'Violão', category: 'Base' }],
    tags: [],
    fixedBandScales: [],
    allUsers: [{ uid: 'u1', name: 'User One', assignments: [] }],
    populatedBandScales: [],
    populatedScales: [],
    refreshData: mockRefreshData,
  }),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    userProfile: { id: 'u1', name: 'User 1', organizationId: 'org-abc' },
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
        preselectedSongIds={[]}
        onSave={onSaveMusicScale}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );

    // Step 1: Event - Music Scale
    const dateInput = screen.getByLabelText(/Data/i);
    fireEvent.change(dateInput, { target: { value: '2026-08-20' } });
    
    const eventTypeSelect = screen.getByLabelText(/Culto\/Evento/i);
    fireEvent.change(eventTypeSelect, { target: { value: 'et-1' } });
    
    const locationSelect = screen.getByLabelText(/Local/i);
    fireEvent.change(locationSelect, { target: { value: 'loc-1' } });

    // Click "Nova Escala" to open nested BandScale form
    const newBandButton = screen.getByText('Nova Escala');
    fireEvent.click(newBandButton);

    // The nested form appears. It has its own steps.
    const nestedForms = screen.getAllByRole('dialog');
    const nestedForm = nestedForms[nestedForms.length - 1]; // Top-most modal

    // Step 1: Event - Band Scale
    // Wait for the next step button in nested form
    const nextToBuildButton = within(nestedForm).getByRole('button', { name: /Avançar/i });
    fireEvent.click(nextToBuildButton);

    // Step 2: Build - Band Scale
    await waitFor(() => {
      expect(within(nestedForm).getByText(/Violão/i)).toBeInTheDocument();
    });

    const addViolaoBtn = within(nestedForm).getByText(/Adicionar Violão/i);
    fireEvent.click(addViolaoBtn);

    const userSelects = within(nestedForm).getAllByRole('combobox');
    const userSelect = userSelects[0];
    fireEvent.change(userSelect, { target: { value: 'u1' } });

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

    const [payload, idempotencyKey] = mockBandScaleCommandsCreate.mock.calls[0];
    
    expect(payload.data).toBeUndefined(); // It should NOT be wrapped in { data }
    expect(payload.idempotencyKey).toBeUndefined(); 
    expect(payload.date).toBe('2026-08-20');
    expect(payload.eventTypeId).toBe('et-1');
    expect(payload.locationId).toBe('loc-1');
    expect(payload.assignments).toHaveLength(1);
    expect(payload.assignments[0].userId).toBe('u1');
    
    // time should be explicitly tested
    expect(['', null, undefined]).toContain(payload.time);

    expect(idempotencyKey).toBeTruthy();
    expect(typeof idempotencyKey).toBe('string');
  });

  it('2. CENÁRIO 2 - LEGACY WRITER: passes correct arguments', async () => {
    isCommandApiV1EnabledMock = false;
    await createNestedBandScale();

    await waitFor(() => {
      expect(mockBandScalesCreate).toHaveBeenCalledTimes(1);
    });

    const [payload] = mockBandScalesCreate.mock.calls[0];
    
    expect(payload.data).toBeUndefined(); 
    expect(payload.date).toBe('2026-08-20');
    expect(payload.eventTypeId).toBe('et-1');
    expect(payload.locationId).toBe('loc-1');
  });
  
  it('3. CENÁRIO 3 - INTEGRAÇÃO COM FORMULÁRIO PAI: after success, parent remains open', async () => {
    isCommandApiV1EnabledMock = true;
    const { nestedForm } = await createNestedBandScale();

    await waitFor(() => {
      expect(mockRefreshData).toHaveBeenCalled();
    });

    // The nested form should be closed, but the parent form should still be open
    await waitFor(() => {
      expect(nestedForm).not.toBeInTheDocument();
    });
    
    const remainingModals = screen.getAllByRole('dialog');
    expect(remainingModals.length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Data/i)).toBeInTheDocument();
  });

  it('4. CENÁRIO 4 - ERRO: when writer rejects, nested modal remains open', async () => {
    isCommandApiV1EnabledMock = true;
    mockBandScaleCommandsCreate.mockRejectedValueOnce(new Error('Simulated Save Error'));
    
    const { nestedForm } = await createNestedBandScale();

    await waitFor(() => {
      // The nested form should still be there because save failed
      expect(nestedForm).toBeInTheDocument();
    });
  });

  it('BandScale aninhada pode ser salva sem horário', async () => {
    isCommandApiV1EnabledMock = true;
    await createNestedBandScale();

    await waitFor(() => {
      expect(mockBandScaleCommandsCreate).toHaveBeenCalledTimes(1);
    });

    const [payload] = mockBandScaleCommandsCreate.mock.calls[0];
    // This confirms time is either empty string or null, which implies it works without a required time
    expect(['', null, undefined]).toContain(payload.time);
  });
});
