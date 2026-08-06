import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  describe('Transposition and Normalization', () => {
    beforeEach(() => {
       global.fetch = vi.fn();
    });

    it('sets initial physical chord key correctly and separates title/artist', async () => {
      const mockResponse = {
        ok: true,
        song: {
          title: "Toda Terra",
          artist: "Gabriela Rocha",
          originalKey: "E",
          chords: "[Intro] E\n\n[Primeira Parte]\nE\nEu ouvi uma vez\nE7M\nEu li no Teu Livro\nA\nO que o Senhor fez\nA7M\nFaz mais uma vez",
          metadata: {
            chordContentKey: "E",
            chordContentKeyValidationStatus: "MATCH"
          }
        },
        result: {}
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => mockResponse
      });

      render(<AiSongImportModal isOpen={true} onClose={() => {}} />);
      
      // Paste something and click process
      const textarea = screen.getByPlaceholderText('Cole aqui a letra, a cifra ou o conteúdo completo da música...');
      fireEvent.change(textarea, { target: { value: 'some content' } });
      fireEvent.click(screen.getByText('Processar com IA'));

      // Wait for preview step
      const applyBtn = await screen.findByText('Aplicar tom');
      expect(applyBtn).toBeDefined();

      // Check title and artist inputs
      const titleInput = screen.getByDisplayValue("Toda Terra");
      expect(titleInput).toBeDefined();
      const artistInput = screen.getByDisplayValue("Gabriela Rocha");
      expect(artistInput).toBeDefined();

      // Check keys
      const eSpans = screen.getAllByText("E", { selector: 'span.font-bold.text-slate-500' });
      expect(eSpans.length).toBeGreaterThan(0);

      // Change target key without applying
      const selectTarget = screen.getByRole('combobox', { name: "Tom para tocar" });
      fireEvent.change(selectTarget, { target: { value: 'G' } });
      
      // Chords should remain E before apply
      const initialChordsTextarea = screen.getByDisplayValue(/\[Intro\] E/i);
      expect(initialChordsTextarea).toBeDefined();

      console.log("CHORDS BEFORE APPLY:", (initialChordsTextarea as HTMLTextAreaElement).value);
      
      const currentChordKeySpan = screen.getAllByText("E", { selector: 'span.font-bold.text-slate-500' });
      console.log("current chord key span:", currentChordKeySpan.map(s => s.textContent));

      // Now apply
      fireEvent.click(applyBtn);

      // Wait for chords to change
      await waitFor(() => {
        const textboxes = screen.getAllByRole('textbox');
        const chordsBox = textboxes.find(t => (t as HTMLTextAreaElement).value.includes('[Intro]\nG'));
        if (!chordsBox) {
           console.log("CURRENT CHORDS:", (textboxes[textboxes.length-1] as HTMLTextAreaElement).value);
        }
        expect(chordsBox).toBeDefined();
      });

      // Find again to perform assertions
      const textboxes = screen.getAllByRole('textbox');
      const chordsTextarea = textboxes.find(t => (t as HTMLTextAreaElement).value.includes('[Intro]\nG')) as HTMLTextAreaElement;
      
      expect(chordsTextarea.value).toContain("\nG\nEu ouvi uma vez");
      expect((chordsTextarea as HTMLTextAreaElement).value).toContain("\nG7M\nEu li no Teu Livro");
      expect((chordsTextarea as HTMLTextAreaElement).value).toContain("\nC\nO que o Senhor fez");

      // Success message should appear only once (aria-live polite)
      const successMsgs = screen.getAllByText(/A cifra foi atualizada de/i);
      expect(successMsgs.length).toBe(1);

      // Current chord key should now be G
      const gSpans = screen.getAllByText("G");
      expect(gSpans.length).toBeGreaterThan(0);
    });

    it('does not transpose if no chords are present and does not change state', async () => {
       const mockResponse = {
        ok: true,
        song: {
          title: "Toda Terra",
          originalKey: "E",
          chords: "No chords here",
          metadata: { chordContentKey: "E" }
        },
        result: {}
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => mockResponse
      });

      render(<AiSongImportModal isOpen={true} onClose={() => {}} />);
      fireEvent.change(screen.getByPlaceholderText('Cole aqui a letra, a cifra ou o conteúdo completo da música...'), { target: { value: 'some content' } });
      fireEvent.click(screen.getByText('Processar com IA'));

      const applyBtn = await screen.findByText('Aplicar tom');
      const selectTarget = screen.getByRole('combobox', { name: "Tom para tocar" });
      fireEvent.change(selectTarget, { target: { value: 'G' } });
      
      fireEvent.click(applyBtn);

      const errorMsg = await screen.findByText("Não há acordes para transpor.");
      expect(errorMsg).toBeDefined();

      // Chords remain the same
      const chordsTextareaNoChords = screen.getByDisplayValue("No chords here");
      expect(chordsTextareaNoChords).toBeDefined();
    });
  });
});
