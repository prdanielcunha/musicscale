import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../hooks/useCapability', () => ({
  useCapability: vi.fn(() => ({ hasCapability: vi.fn(() => ({ hasCapability: vi.fn(() => ({ hasCapability: vi.fn(() => true) })) })) })),
}));

import { ScaleSongCard } from '../../components/scales/ScaleSongCard';
import { PopulatedSong } from '../../types';

describe('ScaleSongCard Settings UI Integration Tests', () => {
  const mockSong: PopulatedSong = {
    id: 'song-123',
    organizationId: 'org-abc',
    title: 'Amazing Grace',
    artist: 'John Newton',
    key: 'G',
    originalKey: 'G',
    selectedKey: 'G',
    bpm: 80,
    status: 'active',
    tagIds: [],
    lyrics: 'Amazing Grace...',
    chords: '[G] Amazing Grace...',
    chordsUrl: '',
    videoUrl: '',
    createdAt: '2026-01-01T00:00:00Z',
    lastPlayed: null,
    createdBy: { uid: 'u1', displayName: 'User 1' } as any,
    tags: []
  };

  const mockTags: any[] = [];
  let onSettingsChangeMock: any;
  let onToggleMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    onSettingsChangeMock = vi.fn().mockImplementation(() => Promise.resolve());
    onToggleMock = vi.fn();
  });

  it('renders settings button and opens editor on click', async () => {
    render(
      <ScaleSongCard
        song={mockSong}
        isSelected={true}
        mode="review"
        tags={mockTags}
        onSettingsChange={onSettingsChangeMock}
        onToggle={onToggleMock}
      />
    );

    // Locate the settings button (the one that triggers editing)
    const editBtn = screen.getByText(/Editar/i);
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);

    // Editor panel should render fields for Key (Tom) and BPM
    expect(screen.getByText(/Tom desta escala/i)).toBeInTheDocument();
    expect(screen.getByText(/BPM desta escala/i)).toBeInTheDocument();
  });

  it('saves local settings immediately without global confirmation', async () => {
    const { container } = render(
      <ScaleSongCard
        song={mockSong}
        isSelected={true}
        mode="review"
        tags={mockTags}
        onSettingsChange={onSettingsChangeMock}
        onToggle={onToggleMock}
      />
    );

    fireEvent.click(screen.getByText(/Editar/i));

    // Change key value
    const selectKey = container.querySelector('select');
    expect(selectKey).toBeInTheDocument();
    fireEvent.change(selectKey!, { target: { value: 'A' } });

    // Apply button
    const applyBtn = screen.getByText(/Aplicar/i);
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(onSettingsChangeMock).toHaveBeenCalledWith('A', null, false);
    });
  });

  it('opens confirmation dialog for global settings change', async () => {
    const { container } = render(
      <ScaleSongCard
        song={mockSong}
        isSelected={true}
        mode="review"
        tags={mockTags}
        onSettingsChange={onSettingsChangeMock}
        onToggle={onToggleMock}
      />
    );

    fireEvent.click(screen.getByText(/Editar/i));

    // Select global mode radio (second input[type="radio"])
    const radios = container.querySelectorAll('input[type="radio"]');
    expect(radios.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(radios[1]);

    const selectKey = container.querySelector('select');
    fireEvent.change(selectKey!, { target: { value: 'A' } });

    const inputBpm = container.querySelector('input[type="number"]');
    fireEvent.change(inputBpm!, { target: { value: '85' } });

    // Apply button
    const applyBtn = screen.getByText(/Aplicar/i);
    fireEvent.click(applyBtn);

    // Confirmation dialog should appear with accessibility attributes
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/Confirmar Alteração Global/i)).toBeInTheDocument();

    // Confirm button
    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i });
    expect(confirmBtn).toBeInTheDocument();

    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onSettingsChangeMock).toHaveBeenCalledWith('A', 85, true);
    });
  });

  it('prevents multiple rapid submissions (concurrency/double-click lock)', async () => {
    let resolvePromise: any;
    const slowPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    onSettingsChangeMock.mockReturnValue(slowPromise);

    const { container } = render(
      <ScaleSongCard
        song={mockSong}
        isSelected={true}
        mode="review"
        tags={mockTags}
        onSettingsChange={onSettingsChangeMock}
        onToggle={onToggleMock}
      />
    );

    fireEvent.click(screen.getByText(/Editar/i));
    
    const radios = container.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    
    fireEvent.click(screen.getByText(/Aplicar/i));

    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i });

    // Double-click or rapid clicks
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);
    fireEvent.click(confirmBtn);

    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn).toHaveAttribute('aria-busy', 'true');

    // Only 1 call should be made to onSettingsChangeMock
    expect(onSettingsChangeMock).toHaveBeenCalledTimes(1);

    // Resolve the save
    resolvePromise();

    await waitFor(() => {
      expect(confirmBtn).not.toBeInTheDocument(); // Editor closed
    });
  });

  it('handles errors gracefully, maintains dialog state, and allows retry', async () => {
    onSettingsChangeMock.mockRejectedValue(new Error('Network error'));

    const { container } = render(
      <ScaleSongCard
        song={mockSong}
        isSelected={true}
        mode="review"
        tags={mockTags}
        onSettingsChange={onSettingsChangeMock}
        onToggle={onToggleMock}
      />
    );

    fireEvent.click(screen.getByText(/Editar/i));
    
    const radios = container.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    
    fireEvent.click(screen.getByText(/Aplicar/i));

    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i });
    fireEvent.click(confirmBtn);

    // Error alert should be displayed with aria-live polite
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toBeInTheDocument();
    expect(errorAlert).toHaveAttribute('aria-live', 'polite');
    expect(errorAlert.textContent).toContain('Erro ao atualizar música');

    // Panel should remain open and interactive
    expect(confirmBtn).not.toBeDisabled();
    expect(confirmBtn).toHaveAttribute('aria-busy', 'false');

    // Retrying with successful mock
    onSettingsChangeMock.mockResolvedValue({ status: 'success' });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onSettingsChangeMock).toHaveBeenCalledTimes(2);
      expect(confirmBtn).not.toBeInTheDocument(); // Editor closed on success
    });
  });

  it('handles deduplication response correctly and does not close dialog', async () => {
    // Resolve with deduplicated status
    onSettingsChangeMock.mockResolvedValue({ status: 'deduplicated' });

    const { container } = render(
      <ScaleSongCard
        song={mockSong}
        isSelected={true}
        mode="review"
        tags={mockTags}
        onSettingsChange={onSettingsChangeMock}
        onToggle={onToggleMock}
      />
    );

    fireEvent.click(screen.getByText(/Editar/i));
    
    const radios = container.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    
    fireEvent.click(screen.getByText(/Aplicar/i));

    const confirmBtn = screen.getByRole('button', { name: /Confirmar/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onSettingsChangeMock).toHaveBeenCalledTimes(1);
    });

    // Dialog must NOT be closed and no errors must be printed
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('closes dialog on Escape key press when not in flight', async () => {
    const { container } = render(
      <ScaleSongCard
        song={mockSong}
        isSelected={true}
        mode="review"
        tags={mockTags}
        onSettingsChange={onSettingsChangeMock}
        onToggle={onToggleMock}
      />
    );

    fireEvent.click(screen.getByText(/Editar/i));
    
    const radios = container.querySelectorAll('input[type="radio"]');
    fireEvent.click(radios[1]);
    
    fireEvent.click(screen.getByText(/Aplicar/i));

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Trigger escape
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });

    // Dialog should close (editor goes back to selection pane or is canceled)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
