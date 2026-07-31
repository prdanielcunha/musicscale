import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { GlobalCreateAction } from '../../components/layout/GlobalCreateAction';
import * as CapabilityHook from '../../hooks/useCapability';
import * as ModalContext from '../../contexts/ModalContext';
import * as AuthContext from '../../contexts/AuthContext';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultLabel: string) => defaultLabel,
  }),
}));

const mockOpenScaleForm = vi.fn();
const mockOpenBandScaleForm = vi.fn();
const mockOpenSongForm = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(AuthContext, 'useAuth').mockReturnValue({ organization: { id: 'org_1' } } as any);
  vi.spyOn(ModalContext, 'useModals').mockReturnValue({
    openScaleForm: mockOpenScaleForm,
    openBandScaleForm: mockOpenBandScaleForm,
    openSongForm: mockOpenSongForm,
  } as any);
});

describe('GlobalCreateAction UI', () => {
  it('hides if user has no capabilities', () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => false });
    const { container } = render(
      <MemoryRouter>
        <GlobalCreateAction variant="desktop" />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders trigger if user has at least one capability', () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({
      hasCapability: (cap) => cap === 'musicscale.songs.edit'
    });
    render(
      <MemoryRouter>
        <GlobalCreateAction variant="desktop" />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument();
  });

  it('shows only authorized actions in menu', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({
      hasCapability: (cap) => cap === 'musicscale.songs.edit'
    });
    render(
      <MemoryRouter>
        <GlobalCreateAction variant="desktop" />
      </MemoryRouter>
    );
    
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    
    await waitFor(() => {
      expect(screen.getByText('Música')).toBeInTheDocument();
      expect(screen.queryByText('Escala de músicas')).not.toBeInTheDocument();
      expect(screen.queryByText('Escala da banda')).not.toBeInTheDocument();
    });
  });

  it('calls correct form method when clicked', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(
      <MemoryRouter>
        <GlobalCreateAction variant="desktop" />
      </MemoryRouter>
    );
    
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    
    await waitFor(() => {
      expect(screen.getByText('Escala de músicas')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Escala de músicas'));
    
    await waitFor(() => {
      expect(mockOpenScaleForm).toHaveBeenCalledTimes(1);
    });
    expect(mockOpenBandScaleForm).not.toHaveBeenCalled();
  });
  
  it('prevents double click', async () => {
    vi.spyOn(CapabilityHook, 'useCapability').mockReturnValue({ hasCapability: () => true });
    render(
      <MemoryRouter>
        <GlobalCreateAction variant="desktop" />
      </MemoryRouter>
    );
    
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));
    await waitFor(() => expect(screen.getByText('Música')).toBeInTheDocument());
    
    const songBtn = screen.getByText('Música');
    fireEvent.click(songBtn);
    fireEvent.click(songBtn); // double click
    
    await waitFor(() => {
      expect(mockOpenSongForm).toHaveBeenCalledTimes(1);
    });
  });
});
