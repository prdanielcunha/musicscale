import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import AiSongImportModal, { mergeAiImportResponse } from '../../components/songs/AiSongImportModal';

// Mock contexts
vi.mock('../../contexts/ApiContext', () => ({  useApi: () => ({})}));
vi.mock('../../contexts/AuthContext', () => ({  useAuth: () => ({    userProfile: { uid: 'user1' },    permissions: { manageSongs: true },    organization: { id: 'org1' }  })}));
vi.mock('../../contexts/MusicDataContext', () => ({  useMusic: () => ({ refreshData: vi.fn(), songs: [] })}));
vi.mock('../../hooks/useEcosystemAdmin', () => ({  useEcosystemAdmin: () => ({ isEcosystemAdmin: false })}));
vi.mock('../../contexts/ToastContext', () => ({  useToast: () => ({ success: vi.fn(), error: vi.fn(), feedbackToast: vi.fn() })}));
vi.mock('../../contexts/ModalContext', () => ({  useModals: () => ({ openFeedback: vi.fn() })}));
vi.mock('../../hooks/useMusicScaleEntitlements', () => ({  useMusicScaleFeature: () => true}));

// Mock components that might be problematic in tests
vi.mock('../common/Modal', () => ({  default: ({ children }: any) => <div>{children}</div>}));
vi.mock('./DuplicateSongModal', () => ({  DuplicateSongModal: () => <div data-testid="duplicate-modal" />}));

// Mock translations
vi.mock('react-i18next', () => ({  useTranslation: () => ({    t: (key: string, fallback: string) => fallback  })}));

describe('AiSongImportModal Fixes', () => {
  it('does not render URL input and does not render SOURCE_BLOCKED or assisted_paste', () => {
    render(<AiSongImportModal isOpen={true} onClose={() => {}} />);
    // URL input should not exist
    expect(screen.queryByLabelText(/URL/i)).toBeNull();
    expect(screen.queryByPlaceholderText(/https/i)).toBeNull();
    // No "SOURCE_BLOCKED" mention in the document
    expect(screen.queryByText(/SOURCE_BLOCKED/i)).toBeNull();
  });

  it('shows error if rawText is empty and prevents backend call', () => {
    render(<AiSongImportModal isOpen={true} onClose={() => {}} />);
    const button = screen.getByText('Processar com IA');
    fireEvent.click(button);
    // Shows visible error message
    expect(screen.getByText('Cole a letra ou cifra para continuar.')).toBeDefined();
    // Ensure the textarea is focused
    const textarea = screen.getByPlaceholderText('Cole aqui a letra, a cifra ou o conteúdo completo da música...');
    expect(document.activeElement).toBe(textarea);
  });

  it('correctly merges AI import response when song has no metadata', () => {
    const mockData = {
      song: {
        title: "Test Song",
        artist: "Test Artist",
        key: "F#",
        chords: "F# C#/E# D#m B"
      },
      result: {
        metadata: {
          declaredKey: "F#",
          shapeKey: "E",
          capo: 2,
          transpositionSemitones: 2,
          normalizedToConcertKey: true,
          chordContentKey: "F#"
        }
      }
    };

    const merged = mergeAiImportResponse(mockData) as any;
    expect(merged.title).toBe("Test Song");
    expect(merged.artist).toBe("Test Artist");
    
    expect(merged.metadata).toBeDefined();
    expect(merged.metadata.declaredKey).toBe("F#");
    expect(merged.metadata.shapeKey).toBe("E");
    expect(merged.metadata.capo).toBe(2);
    expect(merged.metadata.transpositionSemitones).toBe(2);
    expect(merged.metadata.normalizedToConcertKey).toBe(true);
    expect(merged.metadata.chordContentKey).toBe("F#");
  });

  it('correctly overrides specific metadata fields from song', () => {
    const mockData = {
      song: {
        metadata: {
          chordContentKey: "F#"
        }
      },
      result: {
        metadata: {
          declaredKey: "F#",
          shapeKey: "E",
          capo: 2,
          transpositionSemitones: 2,
          normalizedToConcertKey: true,
          chordContentKey: "E"
        }
      }
    };

    const merged = mergeAiImportResponse(mockData) as any;
    expect(merged.metadata).toBeDefined();
    expect(merged.metadata.declaredKey).toBe("F#");
    expect(merged.metadata.shapeKey).toBe("E");
    expect(merged.metadata.capo).toBe(2);
    expect(merged.metadata.transpositionSemitones).toBe(2);
    expect(merged.metadata.normalizedToConcertKey).toBe(true);
    expect(merged.metadata.chordContentKey).toBe("F#");
  });

  it('handles defensive inputs correctly', () => {
    expect(mergeAiImportResponse(null)).toBeNull();

    const defensiveData = {
      song: "invalid",
      result: []
    };
    
    const merged1 = mergeAiImportResponse(defensiveData) as any;
    expect(merged1).toBeDefined();
    expect(Object.keys(merged1).every(k => isNaN(Number(k)))).toBe(true);
    expect(merged1.metadata).toEqual({});

    const stringMetadataData = {
      song: { metadata: "invalid string metadata" },
      result: { metadata: ["invalid", "array", "metadata"] }
    };
    const merged2 = mergeAiImportResponse(stringMetadataData) as any;
    expect(merged2.metadata).toEqual({});
  });
});
