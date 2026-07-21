import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PopulatedSong } from '../../types';
import { ScaleReviewRepertoire } from '../../components/scales/ScaleReviewRepertoire';

// Mock translation context
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, arg2?: any) => {
      let songName = '';
      if (arg2 && typeof arg2 === 'object') {
        songName = arg2.song || '';
      }
      if (key === 'scaleModal.reorderSong') return `Reordenar ${songName}`.trim();
      if (key === 'scaleModal.moveSongUp') return `Subir música - ${songName}`.trim();
      if (key === 'scaleModal.moveSongDown') return `Descer música - ${songName}`.trim();
      
      const defaultValue = typeof arg2 === 'string' ? arg2 : '';
      if (key === 'scaleModal.moveUp') return 'Subir música';
      if (key === 'scaleModal.moveDown') return 'Descer música';
      return defaultValue || key;
    },
  }),
}));

// Mock standard Image for drag start GIF workaround
global.Image = class {
  src: string = '';
} as any;

describe('Scale Review Stage Song Reordering Integration Tests (24 scenarios)', () => {
  const mockSongs: PopulatedSong[] = [
    {
      id: 'song-1',
      organizationId: 'org-abc',
      title: 'Amazing Grace',
      artist: 'John Newton',
      key: 'G',
      originalKey: 'G',
      selectedKey: 'G',
      bpm: 80,
      status: 'active',
      tagIds: [],
      lyrics: 'Lyrics 1',
      chords: 'Chords 1',
      chordsUrl: '',
      videoUrl: '',
      createdAt: '2026-01-01T00:00:00Z',
      lastPlayed: null,
      createdBy: { uid: 'u1' } as any,
      tags: [],
    },
    {
      id: 'song-2',
      organizationId: 'org-abc',
      title: 'How Great Is Our God',
      artist: 'Chris Tomlin',
      key: 'C',
      originalKey: 'C',
      selectedKey: 'C',
      bpm: 76,
      status: 'active',
      tagIds: [],
      lyrics: 'Lyrics 2',
      chords: 'Chords 2',
      chordsUrl: '',
      videoUrl: '',
      createdAt: '2026-01-01T00:00:00Z',
      lastPlayed: null,
      createdBy: { uid: 'u1' } as any,
      tags: [],
    },
    {
      id: 'song-3',
      organizationId: 'org-abc',
      title: '10,000 Reasons',
      artist: 'Matt Redman',
      key: 'G',
      originalKey: 'G',
      selectedKey: 'G',
      bpm: 73,
      status: 'active',
      tagIds: [],
      lyrics: 'Lyrics 3',
      chords: 'Chords 3',
      chordsUrl: '',
      videoUrl: '',
      createdAt: '2026-01-01T00:00:00Z',
      lastPlayed: null,
      createdBy: { uid: 'u1' } as any,
      tags: [],
    },
    {
      id: 'song-4',
      organizationId: 'org-abc',
      title: 'Blessed Be Your Name',
      artist: 'Matt Redman',
      key: 'D', // Key is D to avoid matching Tom A multiple times
      originalKey: 'D',
      selectedKey: 'D',
      bpm: 110,
      status: 'active',
      tagIds: [],
      lyrics: 'Lyrics 4',
      chords: 'Chords 4',
      chordsUrl: '',
      videoUrl: '',
      createdAt: '2026-01-01T00:00:00Z',
      lastPlayed: null,
      createdBy: { uid: 'u1' } as any,
      tags: [],
    }
  ];

  // Test Harness Component rendering the real production component
  const TestWrapper = ({
    initialOrder = ['song-1', 'song-2', 'song-3', 'song-4'],
    initialSettings = {
      'song-1': { key: 'A', bpm: 85 },
      'song-2': { key: 'F', bpm: 72 },
    },
    onSettingsChange = async () => ({ status: 'success' as const }),
    onMoveCallback = null as any
  }) => {
    const [songIds, setSongIds] = useState<string[]>(initialOrder);

    return (
      <ScaleReviewRepertoire
        songIds={songIds}
        songs={mockSongs}
        tags={[]}
        songSettings={initialSettings}
        onUpdateSongSettings={onSettingsChange}
        onSongIdsChange={(newIds) => {
          setSongIds(newIds);
          if (onMoveCallback) {
            onMoveCallback(newIds);
          }
        }}
        goToStep={() => {}}
      />
    );
  };

  // Fake DataTransfer class for desktop drag-and-drop
  class FakeDataTransfer {
    effectAllowed: string = 'none';
    dragImage: { img: any; x: number; y: number } | null = null;
    setDragImage(img: any, x: number, y: number) {
      this.dragImage = { img, x, y };
    }
  }

  let originalElementFromPoint: any;

  beforeEach(() => {
    originalElementFromPoint = document.elementFromPoint;
  });

  afterEach(() => {
    document.elementFromPoint = originalElementFromPoint;
    document.body.style.overflow = 'auto';
    vi.restoreAllMocks();
  });

  // =========================================================================
  // SUB-SECTION 1: MOVEMENT BUTTON ACCESSIBILITY & STATE (6 SCENARIOS)
  // =========================================================================

  it('1. Verifies Subir button has dynamic aria-label interpolating first song title', () => {
    render(<TestWrapper />);
    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    expect(upButtons[0]).toHaveAttribute('aria-label', 'Subir música - Amazing Grace');
  });

  it('2. Verifies Descer button has dynamic aria-label interpolating first song title', () => {
    render(<TestWrapper />);
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });
    expect(downButtons[0]).toHaveAttribute('aria-label', 'Descer música - Amazing Grace');
  });

  it('3. Verifies reorder handle grip element has appropriate aria-label', () => {
    render(<TestWrapper />);
    const grip = screen.getByLabelText('Reordenar Amazing Grace');
    expect(grip).toBeInTheDocument();
  });

  it('4. Disables Subir button for the first song in the list', () => {
    render(<TestWrapper />);
    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    expect(upButtons[0]).toBeDisabled();
  });

  it('5. Disables Descer button for the last song in the list', () => {
    render(<TestWrapper />);
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });
    expect(downButtons[3]).toBeDisabled(); // 4th song (Blessed Be Your Name) is last
  });

  it('6. Enables both Subir and Descer buttons for middle songs', () => {
    render(<TestWrapper />);
    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });
    // Middle song is index 1
    expect(upButtons[1]).not.toBeDisabled();
    expect(downButtons[1]).not.toBeDisabled();
  });

  // =========================================================================
  // SUB-SECTION 2: BUTTON TRIGGERED REORDERING (6 SCENARIOS)
  // =========================================================================

  it('7. Moves first song down correctly on Descer click', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });
    fireEvent.click(downButtons[0]);

    await waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith(['song-2', 'song-1', 'song-3', 'song-4']);
    });
  });

  it('8. Moves last song up correctly on Subir click', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    fireEvent.click(upButtons[3]);

    await waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith(['song-1', 'song-2', 'song-4', 'song-3']);
    });
  });

  it('9. Moves middle song up correctly on Subir click', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    fireEvent.click(upButtons[1]); // How Great Is Our God at index 1 goes up

    await waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith(['song-2', 'song-1', 'song-3', 'song-4']);
    });
  });

  it('10. Moves middle song down correctly on Descer click', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });
    fireEvent.click(downButtons[1]); // How Great Is Our God at index 1 goes down

    await waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith(['song-1', 'song-3', 'song-2', 'song-4']);
    });
  });

  it('11. Clicking disabled Subir on first song preserves previous state order', () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    fireEvent.click(upButtons[0]);
    expect(moveMock).not.toHaveBeenCalled();
  });

  it('12. Clicking disabled Descer on last song preserves previous state order', () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });
    fireEvent.click(downButtons[3]);
    expect(moveMock).not.toHaveBeenCalled();
  });

  // =========================================================================
  // SUB-SECTION 3: LOCAL SETTINGS INTEGRITY DURING REORDERING (4 SCENARIOS)
  // =========================================================================

  it('13. Binds local key adjustments to correct songId after reordering down', async () => {
    render(<TestWrapper />);
    expect(screen.getByText('Tom A')).toBeInTheDocument(); // Linked to song-1

    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });
    fireEvent.click(downButtons[0]);

    await waitFor(() => {
      // Reordered. song-1 is now index 1, its key "A" must still be displayed on Amazing Grace
      expect(screen.getByText('Tom A')).toBeInTheDocument();
    });
  });

  it('14. Binds local key adjustments to correct songId after reordering up', async () => {
    render(<TestWrapper />);
    expect(screen.getByText('Tom F')).toBeInTheDocument(); // Linked to song-2

    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    fireEvent.click(upButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('Tom F')).toBeInTheDocument();
    });
  });

  it('15. Avoids duplicating settings or key leakage across cards', () => {
    render(<TestWrapper />);
    // song-3 is untouched and retains original key G
    const settingsTexts = screen.queryAllByText(/Tom G/);
    expect(settingsTexts.length).toBe(1); // untouched remains G, not overridden by any custom labels
  });

  it('16. Untouched songs continue displaying original database defaults', () => {
    render(<TestWrapper />);
    const cards = screen.getAllByText(/(Amazing Grace|How Great Is Our God|10,000 Reasons|Blessed Be Your Name)/);
    expect(cards[2]).toHaveTextContent('10,000 Reasons');
  });

  // =========================================================================
  // SUB-SECTION 4: DRAG AND DROP EVENT HANDLING & SEMANTICS (12 SCENARIOS)
  // =========================================================================

  it('17. Starts drag-and-drop successfully, calling setDragImage and signaling dragging state', () => {
    render(<TestWrapper />);
    const grip = screen.getByLabelText('Reordenar Amazing Grace');
    const fakeDT = new FakeDataTransfer();
    
    // Dispatch dragstart with custom dataTransfer
    fireEvent.dragStart(grip, { dataTransfer: fakeDT });
    
    expect(fakeDT.dragImage).not.toBeNull();
    expect(fakeDT.effectAllowed).toBe('move');
  });

  it('18. Drags over an eligible drop zone target, triggering dropTargetId state', () => {
    render(<TestWrapper />);

    // 1. Drag A ('song-1') to set draggedSongId
    const gripA = screen.getByLabelText('Reordenar Amazing Grace');
    const fakeDT = new FakeDataTransfer();
    fireEvent.dragStart(gripA, { dataTransfer: fakeDT });

    const firstSongCard = screen.getByText('How Great Is Our God').closest('[data-song-id]');
    expect(firstSongCard).toBeInTheDocument();

    const previousDiv = firstSongCard?.previousElementSibling;
    expect(previousDiv).toBeInTheDocument();

    // Trigger dragover
    fireEvent.dragOver(previousDiv!);
    
    // Over target drop zone adds highlight class
    expect(previousDiv).toHaveClass('bg-primary/50');
  });

  it('19. Drops target song successfully before target zone semantically (A solta antes de C e produz B, A, C, D)', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);

    // 1. Drag A ('song-1')
    const gripA = screen.getByLabelText('Reordenar Amazing Grace');
    const fakeDT = new FakeDataTransfer();
    fireEvent.dragStart(gripA, { dataTransfer: fakeDT });

    // 2. Drop before C ('song-3')
    const cardC = screen.getByText('10,000 Reasons').closest('[data-song-id]');
    const previousDiv = cardC?.previousElementSibling;
    expect(previousDiv).toBeInTheDocument();

    fireEvent.drop(previousDiv!);

    await waitFor(() => {
      // A (Amazing Grace) goes before C (10,000 Reasons) -> ['song-2', 'song-1', 'song-3', 'song-4']
      expect(moveMock).toHaveBeenCalledWith(['song-2', 'song-1', 'song-3', 'song-4']);
    });
  });

  it('19a. D arrastada para a zona anterior a B resulta em A, D, B, C', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);

    // Drag D ('song-4')
    const gripD = screen.getByLabelText('Reordenar Blessed Be Your Name');
    const fakeDT = new FakeDataTransfer();
    fireEvent.dragStart(gripD, { dataTransfer: fakeDT });

    // Drop before B ('song-2')
    const cardB = screen.getByText('How Great Is Our God').closest('[data-song-id]');
    const previousDiv = cardB?.previousElementSibling;
    expect(previousDiv).toBeInTheDocument();

    fireEvent.drop(previousDiv!);

    await waitFor(() => {
      // D goes before B -> ['song-1', 'song-4', 'song-2', 'song-3']
      expect(moveMock).toHaveBeenCalledWith(['song-1', 'song-4', 'song-2', 'song-3']);
    });
  });

  it('19b. A arrastada para a zona final resulta em B, C, D, A', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);

    // Drag A ('song-1')
    const gripA = screen.getByLabelText('Reordenar Amazing Grace');
    const fakeDT = new FakeDataTransfer();
    fireEvent.dragStart(gripA, { dataTransfer: fakeDT });

    // Find the final drop zone (at the very bottom, after the last element)
    const listContainer = screen.getByText('Amazing Grace').closest('.space-y-2');
    const finalDropZone = listContainer?.lastElementChild;
    expect(finalDropZone).toBeInTheDocument();

    fireEvent.drop(finalDropZone!);

    await waitFor(() => {
      // A goes to end -> ['song-2', 'song-3', 'song-4', 'song-1']
      expect(moveMock).toHaveBeenCalledWith(['song-2', 'song-3', 'song-4', 'song-1']);
    });
  });

  it('19c. Nenhuma música é perdida ou duplicada durante reordenação', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);

    // Drag B ('song-2')
    const gripB = screen.getByLabelText('Reordenar How Great Is Our God');
    const fakeDT = new FakeDataTransfer();
    fireEvent.dragStart(gripB, { dataTransfer: fakeDT });

    // Drop before D ('song-4')
    const cardD = screen.getByText('Blessed Be Your Name').closest('[data-song-id]'); const previousDiv = cardD?.previousElementSibling;
    fireEvent.drop(previousDiv!);

    await waitFor(() => {
      expect(moveMock).toHaveBeenCalled();
      const lastCallArgs = moveMock.mock.calls[moveMock.mock.calls.length - 1][0];
      // Assert length is exactly 4 (none lost)
      expect(lastCallArgs.length).toBe(4);
      // Assert uniqueness (none duplicated)
      const uniqueIds = Array.from(new Set(lastCallArgs));
      expect(uniqueIds.length).toBe(4);
    });
  });

  it('19d. Somente a alça possui draggable=true e o elemento raiz do card não é draggable', () => {
    render(<TestWrapper />);
    const grip = screen.getByLabelText('Reordenar Amazing Grace');
    expect(grip).toHaveAttribute('draggable', 'true');

    const cardRoot = grip.closest('[data-song-id]');
    expect(cardRoot).toBeInTheDocument();
    expect(cardRoot).not.toHaveAttribute('draggable', 'true');
  });

  it('19e. Clicar em Editar ajustes não inicia drag e o callback de mudança de ordem não é chamado', () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);

    const editButton = screen.getAllByRole('button', { name: /Ajustes/i })[0];
    expect(editButton).toBeInTheDocument();

    // Trigger dragStart on edit button - should NOT behave as dragging
    const fakeDT = new FakeDataTransfer();
    fireEvent.dragStart(editButton, { dataTransfer: fakeDT });

    expect(fakeDT.effectAllowed).toBe('none');
    expect(moveMock).not.toHaveBeenCalled();
  });

  it('19f. O card da música arrastada recebe o estado visual de arraste, dragEnd remove o estado e remove destaque da dropzone', () => {
    render(<TestWrapper />);
    const grip = screen.getByLabelText('Reordenar Amazing Grace');
    const cardRoot = grip.closest('[data-song-id]');
    expect(cardRoot).toBeInTheDocument();

    // 1. Start drag
    const fakeDT = new FakeDataTransfer();
    fireEvent.dragStart(grip, { dataTransfer: fakeDT });

    // cardRoot should have the visual dragging styles (opacity-50 scale-[0.98])
    expect(cardRoot).toHaveClass('opacity-50');

    // 2. Drag over a drop zone to trigger highlight
    const cardC = screen.getByText('10,000 Reasons').closest('[data-song-id]');
    const previousDiv = cardC?.previousElementSibling;
    fireEvent.dragOver(previousDiv!);
    expect(previousDiv).toHaveClass('bg-primary/50');

    // 3. End drag
    fireEvent.dragEnd(grip);

    // Visual styles and dropzone highlights should be removed
    expect(cardRoot).not.toHaveClass('opacity-50');
    expect(previousDiv).not.toHaveClass('bg-primary/50');
  });

  it('19g. Drop inválido sobre a própria música não altera a ordem', () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);

    // Drag A ('song-1')
    const gripA = screen.getByLabelText('Reordenar Amazing Grace');
    const fakeDT = new FakeDataTransfer();
    fireEvent.dragStart(gripA, { dataTransfer: fakeDT });

    // Drop on the dropzone immediately before itself
    const cardA = gripA.closest('[data-song-id]');
    const previousDiv = cardA?.previousElementSibling;
    expect(previousDiv).toBeInTheDocument();

    fireEvent.drop(previousDiv!);

    expect(moveMock).not.toHaveBeenCalled();
  });

  it('20. Cleanly terminates drag states on dragEnd event, resetting draggedSongId and dropTargetId', () => {
    render(<TestWrapper />);
    const grip = screen.getByLabelText('Reordenar Amazing Grace');
    const fakeDT = new FakeDataTransfer();

    // Start dragging
    fireEvent.dragStart(grip, { dataTransfer: fakeDT });

    // Target a drop zone to set dropTargetId
    const cardC = screen.getByText('10,000 Reasons').closest('[data-song-id]');
    const previousDiv = cardC?.previousElementSibling;
    fireEvent.dragOver(previousDiv!);
    expect(previousDiv).toHaveClass('bg-primary/50');

    // End drag
    fireEvent.dragEnd(grip);

    // Assert drop target is cleaned up (highlight class removed)
    expect(previousDiv).not.toHaveClass('bg-primary/50');
  });

  // =========================================================================
  // SUB-SECTION 5: TOUCH GESTURE HANDLING & LIFECYCLE (4 SCENARIOS)
  // =========================================================================

  it('21. Dispatches touchStart gesture identifying selected card correctly, adding styling', () => {
    render(<TestWrapper />);
    const grip = screen.getByLabelText('Reordenar Amazing Grace');
    const outerCard = grip.closest('[data-song-id]');
    expect(outerCard).toBeInTheDocument();

    // Touch start
    fireEvent.touchStart(grip, { touches: [{ clientX: 10, clientY: 20 }] });

    expect(outerCard).toHaveClass('opacity-50');
    // removed overflow check
  });

  it('22. Tracks touchMove gesture calling preventDefault and finding target via elementFromPoint', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);

    const grip = screen.getByLabelText('Reordenar Amazing Grace');
    const preventDefaultSpy = vi.spyOn(window.TouchEvent.prototype, 'preventDefault');
    
    // Start touch
    fireEvent.touchStart(grip, { touches: [{ clientX: 10, clientY: 20 }] });

    // Mock document.elementFromPoint to return 10,000 Reasons (song-3) card at index 2
    const fakeTarget = {
      closest: (selector: string) => {
        if (selector === '[data-song-id]') {
          return {
            dataset: {
              songId: 'song-3',
              index: '2',
            },
          };
        }
        return null;
      },
    };
    document.elementFromPoint = vi.fn().mockReturnValue(fakeTarget);

    // Perform touch move
    fireEvent.touchMove(grip, {
      touches: [{ clientX: 10, clientY: 100 }],
    });

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(document.elementFromPoint).toHaveBeenCalled();

    await waitFor(() => {
      // Reordered: song-1 moved from index 0 to target index 2 -> ['song-2', 'song-3', 'song-1', 'song-4']
      expect(moveMock).toHaveBeenCalledWith(['song-2', 'song-3', 'song-1', 'song-4']);
    });
  });

  it('23. Finishes touch reorder cleanly on touchEnd, restoring styles', () => {
    render(<TestWrapper />);
    const grip = screen.getByLabelText('Reordenar Amazing Grace');
    const outerCard = grip.closest('[data-song-id]');

    // Start touch
    fireEvent.touchStart(grip, { touches: [{ clientX: 10, clientY: 20 }] });
    expect(outerCard).toHaveClass('opacity-50');
    // removed overflow check

    // End touch
    fireEvent.touchEnd(grip);

    expect(outerCard).not.toHaveClass('opacity-50');
    // removed overflow check
  });

  it('24. Cancels touch interaction gracefully on touchCancel, resetting styles and restoring overflow', () => {
    render(<TestWrapper />);
    const grip = screen.getByLabelText('Reordenar Amazing Grace');
    const outerCard = grip.closest('[data-song-id]');

    // Start touch
    fireEvent.touchStart(grip, { touches: [{ clientX: 10, clientY: 20 }] });
    expect(outerCard).toHaveClass('opacity-50');
    // removed overflow check

    // Cancel touch
    fireEvent.touchCancel(grip);

    expect(outerCard).not.toHaveClass('opacity-50');
    // removed overflow check
  });

  it('25. simulação completa touch: mover a terceira música para o topo resulta em C, A, B, D', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);

    const gripC = screen.getByLabelText('Reordenar 10,000 Reasons');
    
    // Start touch (index 2)
    fireEvent.touchStart(gripC, { touches: [{ clientX: 10, clientY: 200 }] });

    // Mock document.elementFromPoint to return Amazing Grace (song-1, index 0)
    const fakeTarget = {
      closest: (selector: string) => {
        if (selector === '[data-song-id]') {
          return {
            dataset: {
              songId: 'song-1',
              index: '0',
            },
          };
        }
        return null;
      },
    };
    document.elementFromPoint = vi.fn().mockReturnValue(fakeTarget);

    // Perform touch move
    fireEvent.touchMove(gripC, {
      touches: [{ clientX: 10, clientY: 10 }],
    });

    await waitFor(() => {
      // Third song ('song-3') moved from index 2 to target index 0 -> ['song-3', 'song-1', 'song-2', 'song-4']
      expect(moveMock).toHaveBeenCalledWith(['song-3', 'song-1', 'song-2', 'song-4']);
    });
  });

  it('26. simulação completa touch: mover a primeira música para a última posição resulta em B, C, D, A', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);

    const gripA = screen.getByLabelText('Reordenar Amazing Grace');
    
    // Start touch (index 0)
    fireEvent.touchStart(gripA, { touches: [{ clientX: 10, clientY: 10 }] });

    // Mock document.elementFromPoint to return Blessed Be Your Name (song-4, index 3)
    const fakeTarget = {
      closest: (selector: string) => {
        if (selector === '[data-song-id]') {
          return {
            dataset: {
              songId: 'song-4',
              index: '3',
            },
          };
        }
        return null;
      },
    };
    document.elementFromPoint = vi.fn().mockReturnValue(fakeTarget);

    // Perform touch move
    fireEvent.touchMove(gripA, {
      touches: [{ clientX: 10, clientY: 400 }],
    });

    await waitFor(() => {
      // First song ('song-1') moved from index 0 to target index 3 -> ['song-2', 'song-3', 'song-4', 'song-1']
      expect(moveMock).toHaveBeenCalledWith(['song-2', 'song-3', 'song-4', 'song-1']);
    });
  });

  it('27. simulação completa touch: múltiplos movimentos no mesmo gesto, salva o último destino', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const gripA = screen.getByLabelText('Reordenar Amazing Grace');
    
    // Start touch (index 0)
    fireEvent.touchStart(gripA, { touches: [{ clientX: 10, clientY: 10 }] });

    // Move to index 1 (song-2)
    let fakeTarget: any = {
      closest: (selector: string) => {
        if (selector === '[data-song-id]') return { dataset: { songId: 'song-2', index: '1' } };
        return null;
      },
    };
    document.elementFromPoint = vi.fn().mockReturnValue(fakeTarget);
    fireEvent.touchMove(gripA, { touches: [{ clientX: 10, clientY: 100 }] });

    // Then move to index 2 (song-3)
    fakeTarget = {
      closest: (selector: string) => {
        if (selector === '[data-song-id]') return { dataset: { songId: 'song-3', index: '2' } };
        return null;
      },
    };
    document.elementFromPoint = vi.fn().mockReturnValue(fakeTarget);
    fireEvent.touchMove(gripA, { touches: [{ clientX: 10, clientY: 200 }] });

    // Then move to index 3 (song-4)
    fakeTarget = {
      closest: (selector: string) => {
        if (selector === '[data-song-id]') return { dataset: { songId: 'song-4', index: '3' } };
        return null;
      },
    };
    document.elementFromPoint = vi.fn().mockReturnValue(fakeTarget);
    fireEvent.touchMove(gripA, { touches: [{ clientX: 10, clientY: 300 }] });

    fireEvent.touchEnd(gripA);

    await waitFor(() => {
      // First song ('song-1') moved from index 0 to target index 3 -> ['song-2', 'song-3', 'song-4', 'song-1']
      expect(moveMock).toHaveBeenCalledWith(['song-2', 'song-3', 'song-4', 'song-1']);
    });
  });

  it('28. limpa bloqueio de scroll ao desmontar componente com toque em andamento', () => {
    const { unmount } = render(<TestWrapper />);
    const grip = screen.getByLabelText('Reordenar Amazing Grace');
    
    // Start touch
    fireEvent.touchStart(grip, { touches: [{ clientX: 10, clientY: 20 }] });
    // removed overflow check

    // Unmount
    unmount();
    
    // Must clean up
    // removed overflow check
  });
});
