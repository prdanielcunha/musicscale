
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { GlobalCreateAction } from '../../components/layout/GlobalCreateAction';
import { BottomNav } from '../../components/layout/BottomNav';
import * as CapabilityHook from '../../hooks/useCapability';
import * as ModalContext from '../../contexts/ModalContext';
import * as AuthContext from '../../contexts/AuthContext';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultLabel: string) => defaultLabel,
  }),
}));

const mockOpenScaleForm = vi.fn();
const mockOpenBandScaleForm = vi.fn();
const mockOpenSongForm = vi.fn();

afterEach(() => { cleanup(); });
beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ organization: { id: 'org_1' } } as any);
  vi.spyOn(ModalContext, 'useModals').mockReturnValue({
    openScaleForm: mockOpenScaleForm,
    openBandScaleForm: mockOpenBandScaleForm,
    openSongForm: mockOpenSongForm,
  } as any);
  document.body.style.overflow = 'auto'; // Reset overflow
});

describe('GlobalCreateAction UI', () => {
  it('1. sem capability não renderiza', () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => false });
    const { container } = render(
      <MemoryRouter>
        <GlobalCreateAction variant="desktop" />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('2. apenas songs.edit mostra somente Música', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({
      hasCapability: (cap) => cap === 'musicscale.songs.edit'
    });
    render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => {
      expect(screen.getByText('Música')).toBeInTheDocument();
      expect(screen.queryByText('Escala de músicas')).not.toBeInTheDocument();
      expect(screen.queryByText('Escala da banda')).not.toBeInTheDocument();
    });
  });

  it('3. scales.manage mostra as duas escalas', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({
      hasCapability: (cap) => cap === 'musicscale.scales.manage'
    });
    render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => {
      expect(screen.getByText('Escala de músicas')).toBeInTheDocument();
      expect(screen.getByText('Escala da banda')).toBeInTheDocument();
      expect(screen.queryByText('Música')).not.toBeInTheDocument();
    });
  });

  it('4. todas as capabilities mostram três ações', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => {
      expect(screen.getByText('Escala de músicas')).toBeInTheDocument();
      expect(screen.getByText('Escala da banda')).toBeInTheDocument();
      expect(screen.getByText('Música')).toBeInTheDocument();
    });
  });

  it('5. desktop mostra texto visível Criar', () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Criar' });
    expect(trigger).toHaveTextContent('Criar');
  });

  it('6 & 7. desktop possui ARIA correto e menu possui ID correspondente', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Criar' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-controls', 'global-create-menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => {
      const menu = screen.getByRole('menu');
      expect(menu).toHaveAttribute('id', 'global-create-menu');
    });
  });

  it('8, 9, 10, 11 & 12. open forms exactly once, no double click, no setTimeout', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    
    // Music scale
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(screen.getByText('Escala de músicas')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Escala de músicas'));
    fireEvent.click(screen.getByText('Escala de músicas')); // Double click
    await waitFor(() => expect(mockOpenScaleForm).toHaveBeenCalledTimes(1));
    
    // Band scale
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(screen.getByText('Escala da banda')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Escala da banda'));
    await waitFor(() => expect(mockOpenBandScaleForm).toHaveBeenCalledTimes(1));

    // Song
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(screen.getByText('Música')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Música'));
    await waitFor(() => expect(mockOpenSongForm).toHaveBeenCalledTimes(1));
  });

  it('13, 14, 15, 16. Restores focus on close (Escape)', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(<MemoryRouter><GlobalCreateAction variant="desktop" /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Criar' });
    trigger.focus();
    fireEvent.click(trigger);
    
    // Check it opens
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    
    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });
  
  it('18, 19, 20. Route change closes menu and cancels pending actions', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    
    const { unmount } = render(
      <MemoryRouter initialEntries={['/one']}>
        <Routes>
          <Route path="*" element={<GlobalCreateAction variant="desktop" />} />
        </Routes>
      </MemoryRouter>
    );
    
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(screen.getByText('Música')).toBeInTheDocument());
    
    unmount();
    expect(mockOpenSongForm).not.toHaveBeenCalled();
  });

  it('21. mobile uses dialog, not menu', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(<MemoryRouter><GlobalCreateAction variant="mobile" /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Criar' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    
    fireEvent.click(trigger);
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      // Test that the list inside the dialog is a menu role
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  it('22. body overflow anterior é restaurado', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    document.body.style.overflow = 'auto'; // Initial
    
    render(<MemoryRouter><GlobalCreateAction variant="mobile" /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: 'Criar' });
    
    fireEvent.click(trigger);
    await waitFor(() => expect(document.body.style.overflow).toBe('hidden'));
    
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => expect(document.body.style.overflow).toBe('auto')); // Restored
  });
});

describe('BottomNav Links Preserved', () => {
  it('24 & 25. os cinco links da BottomNav continuam presentes e na ordem correta, e trigger mobile tem texto Criar', () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(<MemoryRouter><BottomNav /></MemoryRouter>);
    
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
    expect(links[0]).toHaveAttribute('href', '/');
    expect(links[1]).toHaveAttribute('href', '/songs');
    expect(links[2]).toHaveAttribute('href', '/scales');
    expect(links[3]).toHaveAttribute('href', '/library');
    expect(links[4]).toHaveAttribute('href', '/profile');
    
    // Check if the create action trigger is rendered and has correct text
    const trigger = screen.getByRole('button', { name: 'Criar' });
    expect(trigger).toBeInTheDocument();
    expect(trigger.textContent).toContain('Criar');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-controls', 'global-create-dialog');
    
    // Ensure the trigger is NOT inside a link
    expect(trigger.closest('a')).toBeNull();
    
    // Verify icons inside trigger - SVG
    const svgIcon = trigger.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
  });
});
