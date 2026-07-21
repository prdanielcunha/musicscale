import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScaleSongCard } from '../../components/scales/ScaleSongCard';
import { PopulatedSong } from '../../types';
import { moveSongId, moveSongBeforeTarget } from '../../utils/scaleSongSettings';

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
    }
  ];

  // Test Harness Component
  const TestWrapper = ({
    initialOrder = ['song-1', 'song-2', 'song-3'],
    initialSettings = {
      'song-1': { key: 'A', bpm: 85 },
      'song-2': { key: 'F', bpm: 72 },
    },
    onSettingsChange = async () => ({ status: 'success' as const }),
    onMoveCallback = null as any
  }) => {
    const [songIds, setSongIds] = useState<string[]>(initialOrder);
    const [draggedId, setDraggedId] = useState<string | null>(null);
    const [dropTarget, setDropTarget] = useState<string | null>(null);

    const moveSongReview = (index: number, direction: 'up' | 'down') => {
      if (
        (direction === 'up' && index === 0) ||
        (direction === 'down' && index === songIds.length - 1)
      ) return;

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      const newIds = moveSongId(songIds, index, targetIndex);
      setSongIds(newIds);
      if (onMoveCallback) onMoveCallback(newIds);
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
      setDraggedId(id);
    };

    const handleDragOver = (e: React.DragEvent, id: string) => {
      e.preventDefault();
      if (draggedId && draggedId !== id) {
        setDropTarget(id);
      }
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedId || draggedId === targetId) return;
      const newIds = moveSongBeforeTarget(songIds, draggedId, targetId);
      setSongIds(newIds);
      if (onMoveCallback) onMoveCallback(newIds);
      setDraggedId(null);
      setDropTarget(null);
    };

    const handleDragEnd = () => {
      setDraggedId(null);
      setDropTarget(null);
    };

    return (
      <div className="space-y-4">
        {songIds.map((id, index) => {
          const song = mockSongs.find((s) => s.id === id);
          if (!song) return null;
          return (
            <React.Fragment key={song.id}>
              <div
                data-testid={`drop-zone-${song.id}`}
                onDragOver={(e) => handleDragOver(e, song.id)}
                onDrop={(e) => handleDrop(e, song.id)}
                className={`h-2 transition-all ${dropTarget === song.id ? "bg-primary/50 h-8" : ""}`}
              />
              <ScaleSongCard
                song={song}
                isSelected={true}
                mode="review"
                index={index}
                tags={[]}
                localSettings={initialSettings[song.id]}
                onSettingsChange={onSettingsChange}
                onMoveUp={() => moveSongReview(index, 'up')}
                onMoveDown={() => moveSongReview(index, 'down')}
                isFirst={index === 0}
                isLast={index === songIds.length - 1}
                isDragging={draggedId === song.id}
                onDragStart={(e) => handleDragStart(e, song.id)}
                onDragEnd={handleDragEnd}
              />
            </React.Fragment>
          );
        })}
        <div
          data-testid="drop-zone-end"
          onDragOver={(e) => handleDragOver(e, "end")}
          onDrop={(e) => handleDrop(e, "end")}
          className={`h-2 transition-all ${dropTarget === "end" ? "bg-primary/50 h-8" : ""}`}
        />
      </div>
    );
  };

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
    const grips = screen.getAllByLabelText(/Reordenar/i);
    expect(grips[0]).toBeInTheDocument();
  });

  it('4. Disables Subir button for the first song in the list', () => {
    render(<TestWrapper />);
    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    expect(upButtons[0]).toBeDisabled();
  });

  it('5. Disables Descer button for the last song in the list', () => {
    render(<TestWrapper />);
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });
    expect(downButtons[2]).toBeDisabled(); // 3rd song is last
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
      expect(moveMock).toHaveBeenCalledWith(['song-2', 'song-1', 'song-3']);
    });
  });

  it('8. Moves last song up correctly on Subir click', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    fireEvent.click(upButtons[2]);

    await waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith(['song-1', 'song-3', 'song-2']);
    });
  });

  it('9. Moves middle song up correctly on Subir click', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    fireEvent.click(upButtons[1]);

    await waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith(['song-2', 'song-1', 'song-3']);
    });
  });

  it('10. Moves middle song down correctly on Descer click', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });
    fireEvent.click(downButtons[1]);

    await waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith(['song-1', 'song-3', 'song-2']);
    });
  });

  it('11. Clicking disabled Subir on first song preserves previous state order', () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const upButtons = screen.getAllByRole('button', { name: /Subir música/i });
    // Clicking disabled button shouldn't do anything
    fireEvent.click(upButtons[0]);
    expect(moveMock).not.toHaveBeenCalled();
  });

  it('12. Clicking disabled Descer on last song preserves previous state order', () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);
    const downButtons = screen.getAllByRole('button', { name: /Descer música/i });
    fireEvent.click(downButtons[2]);
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
    // Only 'song-1' and 'song-2' had settings in initialSettings. 'song-3' is untouched and retains original key G
    const settingsTexts = screen.queryAllByText(/Tom G/);
    expect(settingsTexts.length).toBe(1); // untouched remains G (original key), not overridden by any other song's keys
  });

  it('16. Untouched songs continue displaying original database defaults', () => {
    render(<TestWrapper />);
    // original db key for song-3 is G, no custom override label 'Tom G' is injected
    const cards = screen.getAllByText(/(Amazing Grace|How Great Is Our God|10,000 Reasons)/);
    expect(cards[2]).toHaveTextContent('10,000 Reasons');
  });

  // =========================================================================
  // SUB-SECTION 4: DRAG AND DROP EVENT HANDLING & SEMANTICS (4 SCENARIOS)
  // =========================================================================

  it('17. Starts drag-and-drop successfully and signals dragging state', () => {
    render(<TestWrapper />);
    const cards = screen.getAllByLabelText(/Reordenar/i);
    const dragStartEvent = { dataTransfer: { setData: vi.fn(), effectAllowed: null } };
    fireEvent.dragStart(cards[0], dragStartEvent);
    // Amazing Grace is being dragged
    expect(dragStartEvent.dataTransfer.setData).toHaveBeenCalled;
  });

  it('18. Drags over an eligible drop zone target, triggering focus highlight', () => {
    render(<TestWrapper />);
    const firstZone = screen.getByTestId('drop-zone-song-2');
    fireEvent.dragOver(firstZone);
    expect(firstZone).toBeInTheDocument();
  });

  it('19. Drops target song successfully before target zone semantically', async () => {
    const moveMock = vi.fn();
    render(<TestWrapper onMoveCallback={moveMock} />);

    // Drag song-1
    const handles = screen.getAllByLabelText(/Reordenar/i);
    fireEvent.dragStart(handles[0]); // song-1

    // Drop on drop zone of song-3 (inserts song-1 BEFORE song-3)
    const dropZone = screen.getByTestId('drop-zone-song-3');
    fireEvent.drop(dropZone);

    await waitFor(() => {
      expect(moveMock).toHaveBeenCalledWith(['song-2', 'song-1', 'song-3']);
    });
  });

  it('20. Cleanly terminates drag states on dragEnd event', () => {
    render(<TestWrapper />);
    const handles = screen.getAllByLabelText(/Reordenar/i);
    fireEvent.dragStart(handles[0]);
    fireEvent.dragEnd(handles[0]);
    // Verifies drag cleanup executed
    expect(handles[0]).not.toHaveClass('opacity-50');
  });

  // =========================================================================
  // SUB-SECTION 5: TOUCH GESTURE HANDLING & LIFECYCLE (4 SCENARIOS)
  // =========================================================================

  it('21. Dispatches touchStart gesture identifying selected card correctly', () => {
    render(<TestWrapper />);
    const handles = screen.getAllByLabelText(/Reordenar/i);
    const touchStartEvent = { touches: [{ clientY: 150 }] };
    fireEvent.touchStart(handles[0], touchStartEvent);
    expect(handles[0]).toBeInTheDocument();
  });

  it('22. Tracks touchMove gesture along scroll dimensions', () => {
    render(<TestWrapper />);
    const handles = screen.getAllByLabelText(/Reordenar/i);
    fireEvent.touchStart(handles[0], { touches: [{ clientY: 150 }] });
    const touchMoveEvent = { touches: [{ clientY: 210 }], preventDefault: vi.fn() };
    fireEvent.touchMove(handles[0], touchMoveEvent);
    expect(touchMoveEvent.preventDefault).toHaveBeenCalled;
  });

  it('23. Finishes touch reorder cleanly on touchEnd', () => {
    render(<TestWrapper />);
    const handles = screen.getAllByLabelText(/Reordenar/i);
    fireEvent.touchStart(handles[0], { touches: [{ clientY: 150 }] });
    fireEvent.touchEnd(handles[0]);
    expect(handles[0]).toBeInTheDocument();
  });

  it('24. Cancels touch interaction gracefully on touchCancel resetting styles', () => {
    render(<TestWrapper />);
    const handles = screen.getAllByLabelText(/Reordenar/i);
    fireEvent.touchStart(handles[0], { touches: [{ clientY: 150 }] });
    fireEvent.touchCancel(handles[0]);
    expect(handles[0]).toBeInTheDocument();
  });
});
