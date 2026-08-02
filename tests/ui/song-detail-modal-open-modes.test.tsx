import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SongDetailModal from '../../components/songs/SongDetailModal';

// Mock contexts and hooks
vi.mock('../../contexts/MusicDataContext', () => ({
  useMusic: vi.fn(() => ({
    songs: [],
    populatedScales: [],
  })),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    userProfile: { uid: 'user123', organizationId: 'org123' },
  })),
}));

vi.mock('../../contexts/ModalContext', () => ({
  useModals: vi.fn(() => ({
    openScaleDetail: vi.fn(),
    saveChord: vi.fn(),
    isSubmitting: false,
    openFeedback: vi.fn(),
  })),
}));

vi.mock('../../contexts/ApiContext', () => ({
  useApi: vi.fn(() => ({})),
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: vi.fn(() => ({
    feedbackToast: vi.fn(),
  })),
}));

vi.mock('../../hooks/useCapability', () => ({
  useCapability: vi.fn(() => ({
    hasCapability: vi.fn(() => true),
  })),
}));

// Mock Metronome to keep it simple
vi.mock('../../components/common/Metronome', () => ({
  default: () => <div data-testid="mock-metronome">Metronome</div>,
}));

// Mock ChordsViewerModal, LyricsViewerModal, WebViewerModal
vi.mock('../../components/songs/ChordsViewerModal', () => ({
  default: ({ isOpen, onClose }: any) => isOpen ? (
    <div data-testid="mock-chords-viewer">
      Chords Viewer
      <button onClick={onClose} data-testid="close-chords-btn">Close Chords</button>
    </div>
  ) : null,
}));

vi.mock('../../components/songs/LyricsViewerModal', () => ({
  default: ({ isOpen, onClose }: any) => isOpen ? (
    <div data-testid="mock-lyrics-viewer">
      Lyrics Viewer
      <button onClick={onClose} data-testid="close-lyrics-btn">Close Lyrics</button>
    </div>
  ) : null,
}));

vi.mock('../../components/common/WebViewerModal', () => ({
  default: ({ isOpen, onClose }: any) => isOpen ? (
    <div data-testid="mock-web-viewer">
      Web Viewer
      <button onClick={onClose} data-testid="close-web-btn">Close Web</button>
    </div>
  ) : null,
}));

const mockSong = {
  id: 'song123',
  title: 'Minha Música',
  artist: 'Meu Artista',
  key: 'C',
  bpm: 120,
  lyrics: 'Minha letra de teste',
  chords: 'C G Am F',
  chordsUrl: 'https://cifras.com/minha-musica',
  tags: [],
};

describe('SongDetailModal Open Modes', () => {
  const mockOnClose = vi.fn();
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnCreateScale = vi.fn();
  const mockOnNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve abrir no modo de detalhes por padrão (openMode não especificado)', () => {
    render(
      <SongDetailModal
        song={mockSong as any}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateScale={mockOnCreateScale}
        scaleContext={null}
        onNavigate={mockOnNavigate}
      />
    );

    expect(screen.getAllByText('Minha Música')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Meu Artista')[0]).toBeInTheDocument();
    expect(screen.queryByTestId('mock-chords-viewer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-lyrics-viewer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mock-web-viewer')).not.toBeInTheDocument();
  });

  it('deve abrir o visualizador de cifras diretamente quando openMode === "chords"', () => {
    render(
      <SongDetailModal
        song={mockSong as any}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateScale={mockOnCreateScale}
        scaleContext={null}
        onNavigate={mockOnNavigate}
        openMode="chords"
      />
    );

    expect(screen.getByTestId('mock-chords-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-lyrics-viewer')).not.toBeInTheDocument();
  });

  it('deve abrir o visualizador de letras diretamente quando openMode === "lyrics"', () => {
    render(
      <SongDetailModal
        song={mockSong as any}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateScale={mockOnCreateScale}
        scaleContext={null}
        onNavigate={mockOnNavigate}
        openMode="lyrics"
      />
    );

    expect(screen.getByTestId('mock-lyrics-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-chords-viewer')).not.toBeInTheDocument();
  });

  it('deve abrir o visualizador de cifraclube/web diretamente se openMode === "chords" mas apenas chordsUrl existir', () => {
    const songWithUrlOnly = {
      ...mockSong,
      chords: '',
    };

    render(
      <SongDetailModal
        song={songWithUrlOnly as any}
        onClose={mockOnClose}
        onEdit={mockOnEdit}
        onDelete={mockOnDelete}
        onCreateScale={mockOnCreateScale}
        scaleContext={null}
        onNavigate={mockOnNavigate}
        openMode="chords"
      />
    );

    expect(screen.getByTestId('mock-web-viewer')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-chords-viewer')).not.toBeInTheDocument();
  });
});
