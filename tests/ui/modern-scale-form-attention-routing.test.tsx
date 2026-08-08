import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ModernScaleForm from '../../components/scales/ModernScaleForm';
import BandBuilder from '../../components/scales/BandBuilder';

vi.unmock('react-i18next');
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import pt from '../../locales/pt.json';
import en from '../../locales/en.json';
import es from '../../locales/es.json';

// Polyfill requestAnimationFrame for jsdom test environment to prevent infinite hangs
if (typeof window !== 'undefined') {
  window.requestAnimationFrame = (callback) => {
    return setTimeout(callback, 0) as any;
  };
  window.cancelAnimationFrame = (id) => {
    clearTimeout(id);
  };
}

// Polyfill crypto.randomUUID for jsdom test environment
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

// Initialize i18n
i18n
  .use(initReactI18next)
  .init({
    resources: {
      pt: { translation: pt },
      en: { translation: en },
      es: { translation: es }
    },
    lng: 'pt',
    fallbackLng: 'pt',
    interpolation: { escapeValue: false }
  });

// All necessary Context Mocks
let mockPopulatedBandScales = [
  { id: 'bs1', date: '2026-08-15', eventType: { name: 'Culto' }, assignments: [ { userId: 'u1', instrumentId: 'inst1' } ] }
];

vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: () => ({
    songs: [
      { id: 'song1', title: 'Song One', artist: 'Artist One', key: 'G', bpm: 80, tags: [] }
    ],
    eventTypes: [{ id: 'et-1', name: 'Culto' }],
    locations: [{ id: 'loc-1', name: 'Templo' }],
    eventNames: [],
    instruments: [{ id: 'inst1', name: 'Violão' }],
    tags: [],
    fixedBandScales: [],
    allUsers: [{ uid: 'u1', name: 'User One', assignments: [] }],
    populatedBandScales: mockPopulatedBandScales,
    populatedScales: [],
    refreshData: vi.fn(),
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
describe('ModernScaleForm Attention Routing & Focus', () => {
  beforeEach(async () => {
    mockPopulatedBandScales = [
      { id: 'bs1', date: '2026-08-15', eventType: { name: 'Culto' }, assignments: [ { userId: 'u1', instrumentId: 'inst1' } ] }
    ];
    await i18n.changeLanguage('pt');
  });

  it('1. escala musical com missing-team abre Banda', () => {
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="link"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const activeBtn = screen.getAllByRole('button').find(btn => btn.className.includes('text-primary'));
    expect(activeBtn).toHaveTextContent('Banda');
  });

  it('2. primeira banda recebe foco', async () => {
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="link"
        focusTarget="band-selector"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    await waitFor(() => {
      const option = screen.getByTestId('link-band-scale-bs1');
      expect(document.activeElement).toBe(option);
    });
  });

  it('3. Enter seleciona a banda', async () => {
    const user = userEvent.setup();
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="link"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const option = screen.getByTestId('link-band-scale-bs1');
    option.focus();
    await user.keyboard('{Enter}');
    expect(option).toHaveAttribute('aria-checked', 'true');
  });

  it('4. Espaço seleciona a banda', async () => {
    const user = userEvent.setup();
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="link"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const option = screen.getByTestId('link-band-scale-bs1');
    option.focus();
    await user.keyboard(' ');
    expect(option).toHaveAttribute('aria-checked', 'true');
  });

  it('5. ausência de bandas foca Criar escala de banda', async () => {
    mockPopulatedBandScales = [];
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="link"
        focusTarget="band-selector"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    await waitFor(() => {
      const btn = screen.getByLabelText('Criar Escala da Banda');
      expect(document.activeElement).toBe(btn);
    });
  });

  it('6. missing-repertoire abre Repertório', () => {
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="build"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const activeBtn = screen.getAllByRole('button').find(btn => btn.className.includes('text-primary'));
    expect(activeBtn).toHaveTextContent('Repertório');
  });

  it('7. busca do repertório recebe foco', async () => {
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="build"
        focusTarget="repertoire-selector"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Buscar por título, artista, tom ou tag...');
      expect(document.activeElement).toBe(input);
    });
  });

  it('8. banda vinculada vazia abre Formação', () => {
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="band"
        initialStep="build"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const activeBtn = screen.getAllByRole('button').find(btn => btn.className.includes('text-primary'));
    expect(activeBtn).toHaveTextContent('Formação');
  });

  it('9. mobile alterna para Funções antes de focar instrumento', async () => {
    const ref = React.createRef<any>();
    render(
      <BandBuilder
        ref={ref}
        formData={{ assignments: [] }}
        setFormData={vi.fn()}
        instrumentsByCat={[{ name: 'Sopro', instruments: [{ id: 'inst1', name: 'Sax', categoryId: 'cat1' }] }]}
        allUsers={[]}
        populatedBandScales={[]}
      />
    );
    const btn = screen.getByText('Sax');
    Object.defineProperty(btn, 'offsetParent', { value: null, configurable: true });

    const promise = ref.current.focusFirstInstrument();
    await promise;

    expect(screen.getByText('Escolha uma função e selecione integrantes compatíveis para este evento.')).toBeInTheDocument();
  });

  it('10. instrumento recebe foco somente depois da aba estar visível', async () => {
    const ref = React.createRef<any>();
    render(
      <BandBuilder
        ref={ref}
        formData={{ assignments: [] }}
        setFormData={vi.fn()}
        instrumentsByCat={[{ name: 'Sopro', instruments: [{ id: 'inst1', name: 'Sax', categoryId: 'cat1' }] }]}
        allUsers={[]}
        populatedBandScales={[]}
      />
    );
    const btn = screen.getByText('Sax');
    Object.defineProperty(btn, 'offsetParent', { value: null, configurable: true });

    const focused = await ref.current.focusFirstInstrument();
    expect(focused).toBe(true);
    expect(document.activeElement).toBe(btn);
  });

  it('11. escala de banda missing-time abre Evento', () => {
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="band"
        initialStep="event"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const activeBtn = screen.getAllByRole('button').find(btn => btn.className.includes('text-primary'));
    expect(activeBtn).toHaveTextContent('Evento');
  });

  it('12. horário recebe foco', async () => {
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="band"
        initialStep="event"
        focusTarget="event-time"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(document.getElementById('time'));
    });
  });

  it('13. escala de banda missing-location abre Evento', () => {
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="band"
        initialStep="event"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const activeBtn = screen.getAllByRole('button').find(btn => btn.className.includes('text-primary'));
    expect(activeBtn).toHaveTextContent('Evento');
  });

  it('14. local recebe foco', async () => {
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="band"
        initialStep="event"
        focusTarget="event-location"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    await waitFor(() => {
      expect(document.activeElement).toBe(document.getElementById('locationId'));
    });
  });

  it('15. initialStep é aplicado uma vez', () => {
    const { rerender } = render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="link"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const stepBtns = screen.getAllByRole('button').filter(btn => ['Evento', 'Banda', 'Repertório', 'Revisão'].includes(btn.textContent || ''));
    fireEvent.click(stepBtns[0]); // Click "Evento"

    let activeBtn = screen.getAllByRole('button').find(btn => btn.className.includes('text-primary'));
    expect(activeBtn).toHaveTextContent('Evento');

    rerender(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="link"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={true}
      />
    );

    activeBtn = screen.getAllByRole('button').find(btn => btn.className.includes('text-primary'));
    expect(activeBtn).toHaveTextContent('Evento');
  });

  it('16. rerender não força retorno', () => {
    const { rerender } = render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="build"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const stepBtns = screen.getAllByRole('button').filter(btn => ['Evento', 'Banda', 'Repertório', 'Revisão'].includes(btn.textContent || ''));
    fireEvent.click(stepBtns[3]); // Click "Revisão"

    let activeBtn = screen.getAllByRole('button').find(btn => btn.className.includes('text-primary'));
    expect(activeBtn).toHaveTextContent('Revisão');

    rerender(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="build"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );

    activeBtn = screen.getAllByRole('button').find(btn => btn.className.includes('text-primary'));
    expect(activeBtn).toHaveTextContent('Revisão');
  });

  it('17. fechar e reabrir sem options retorna à etapa padrão', () => {
    const { rerender } = render(
      <ModernScaleForm
        isOpen={false}
        scaleType="music"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );

    rerender(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );

    const activeBtn = screen.getAllByRole('button').find(btn => btn.className.includes('text-primary'));
    expect(activeBtn).toHaveTextContent('Evento');
  });

  it('18. requestAnimationFrame é cancelado no unmount', () => {
    const ref = React.createRef<any>();
    render(
      <BandBuilder
        ref={ref}
        formData={{ assignments: [] }}
        setFormData={vi.fn()}
        instrumentsByCat={[{ name: 'Sopro', instruments: [{ id: 'inst1', name: 'Sax', categoryId: 'cat1' }] }]}
        allUsers={[]}
        populatedBandScales={[]}
      />
    );

    const abortController = new AbortController();
    const promise = ref.current.focusFirstInstrument(abortController.signal);
    abortController.abort();

    return promise.then((res: any) => {
       expect(res).toBe(false);
    });
  });

  it('19. troca de organização impede foco atrasado', async () => {
    const ref = React.createRef<any>();
    render(
      <BandBuilder
        ref={ref}
        formData={{ assignments: [] }}
        setFormData={vi.fn()}
        instrumentsByCat={[{ name: 'Sopro', instruments: [{ id: 'inst1', name: 'Sax', categoryId: 'cat1' }] }]}
        allUsers={[]}
        populatedBandScales={[]}
      />
    );
    const abortController = new AbortController();
    abortController.abort();

    const focused = await ref.current.focusFirstInstrument(abortController.signal);
    expect(focused).toBe(false);
  });

  it('20. aria-label PT', async () => {
    await i18n.changeLanguage('pt');
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="link"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const option = screen.getByTestId('link-band-scale-bs1');
    const label = option.getAttribute('aria-label') || '';
    expect(label).toContain('Escala Culto');
    expect(label).toContain('1 integrante');
  });

  it('21. aria-label EN', async () => {
    await i18n.changeLanguage('en');
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="link"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const option = screen.getByTestId('link-band-scale-bs1');
    const label = option.getAttribute('aria-label') || '';
    expect(label).toContain('Schedule Culto');
    expect(label).toContain('1 member');
  });

  it('22. aria-label ES', async () => {
    await i18n.changeLanguage('es');
    render(
      <ModernScaleForm
        isOpen={true}
        scaleType="music"
        initialStep="link"
        onSave={vi.fn()}
        onClose={vi.fn()}
        isSubmitting={false}
      />
    );
    const option = screen.getByTestId('link-band-scale-bs1');
    const label = option.getAttribute('aria-label') || '';
    expect(label).toContain('Escala Culto');
    expect(label).toContain('1 integrante');
  });

  describe('State Guard and Defaults verification', () => {
    it('1. quando eventTypeId/locationId precisam de default: o estado é atualizado', async () => {
      render(
        <ModernScaleForm
          isOpen={true}
          scaleType="band"
          initialStep="event"
          onSave={vi.fn()}
          onClose={vi.fn()}
          isSubmitting={false}
        />
      );
      await waitFor(() => {
        expect(document.getElementById('eventTypeId')).toHaveValue('et-1');
        expect(document.getElementById('locationId')).toHaveValue('loc-1');
      });
    });

    it('2. quando não existe mudança: os dados existentes permanecem', async () => {
      const mockSave = vi.fn();
      render(
        <ModernScaleForm
          isOpen={true}
          scaleType="band"
          initialStep="event"
          onSave={mockSave}
          onClose={vi.fn()}
          isSubmitting={false}
          scaleToEdit={{
            id: 'existing-id',
            date: '2026-08-25',
            time: '18:00',
            eventTypeId: 'et-1',
            locationId: 'loc-1',
            eventNameId: '',
            assignments: [],
          }}
        />
      );
      await waitFor(() => {
        expect(document.getElementById('date')).toHaveValue('2026-08-25');
        expect(document.getElementById('time')).toHaveValue('18:00');
      });
    });

    it('3. re-render equivalente não reseta o formulário', async () => {
      const { rerender } = render(
        <ModernScaleForm
          isOpen={true}
          scaleType="band"
          initialStep="event"
          onSave={vi.fn()}
          onClose={vi.fn()}
          isSubmitting={false}
        />
      );

      const dateInput = document.getElementById('date') as HTMLInputElement;
      fireEvent.change(dateInput, { target: { value: '2026-08-29' } });
      expect(dateInput).toHaveValue('2026-08-29');

      rerender(
        <ModernScaleForm
          isOpen={true}
          scaleType="band"
          initialStep="event"
          onSave={vi.fn()}
          onClose={vi.fn()}
          isSubmitting={false}
        />
      );

      expect(document.getElementById('date')).toHaveValue('2026-08-29');
    });

    it('4. abertura de scaleToEdit continua carregando dados', async () => {
      render(
        <ModernScaleForm
          isOpen={true}
          scaleType="band"
          initialStep="event"
          onSave={vi.fn()}
          onClose={vi.fn()}
          isSubmitting={false}
          scaleToEdit={{
            id: 'edit-1',
            date: '2026-09-01',
            time: '10:00',
            eventTypeId: 'et-1',
            locationId: 'loc-1',
            eventNameId: '',
            assignments: [],
          }}
        />
      );
      await waitFor(() => {
        expect(document.getElementById('date')).toHaveValue('2026-09-01');
        expect(document.getElementById('time')).toHaveValue('10:00');
      });
    });
  });
});
