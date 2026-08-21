import { describe, expect, it } from 'vitest';
import { deriveGlobalSongContentMetrics } from '../../utils/globalSongContentMetrics.js';

describe('global song content metrics contract', () => {
  it('marks chords and lyrics as complete when both contain text', () => {
    expect(deriveGlobalSongContentMetrics({ chords: 'C G', lyrics: 'Letra' })).toEqual({
      hasChords: true,
      hasLyrics: true,
      isComplete: true,
    });
  });

  it('marks only chords when lyrics are absent', () => {
    expect(deriveGlobalSongContentMetrics({ chords: 'C G' })).toEqual({
      hasChords: true,
      hasLyrics: false,
      isComplete: false,
    });
  });

  it('marks only lyrics when chords are absent', () => {
    expect(deriveGlobalSongContentMetrics({ lyrics: 'Letra' })).toEqual({
      hasChords: false,
      hasLyrics: true,
      isComplete: false,
    });
  });

  it('treats empty chords as absent', () => {
    expect(deriveGlobalSongContentMetrics({ chords: '' }).hasChords).toBe(false);
  });

  it('treats whitespace-only chords as absent', () => {
    expect(deriveGlobalSongContentMetrics({ chords: '   ' }).hasChords).toBe(false);
  });

  it('treats newline/tab-only lyrics as absent', () => {
    expect(deriveGlobalSongContentMetrics({ lyrics: '\n\t ' }).hasLyrics).toBe(false);
  });

  it('treats undefined as absent', () => {
    expect(deriveGlobalSongContentMetrics({ chords: undefined, lyrics: undefined })).toEqual({
      hasChords: false,
      hasLyrics: false,
      isComplete: false,
    });
  });

  it('treats null as absent', () => {
    expect(deriveGlobalSongContentMetrics({ chords: null, lyrics: null })).toEqual({
      hasChords: false,
      hasLyrics: false,
      isComplete: false,
    });
  });

  it('treats numbers as absent', () => {
    expect(deriveGlobalSongContentMetrics({ chords: 123, lyrics: 456 })).toEqual({
      hasChords: false,
      hasLyrics: false,
      isComplete: false,
    });
  });

  it('treats booleans as absent', () => {
    expect(deriveGlobalSongContentMetrics({ chords: true, lyrics: false })).toEqual({
      hasChords: false,
      hasLyrics: false,
      isComplete: false,
    });
  });

  it('treats objects as absent', () => {
    expect(deriveGlobalSongContentMetrics({ chords: {}, lyrics: { text: 'x' } })).toEqual({
      hasChords: false,
      hasLyrics: false,
      isComplete: false,
    });
  });

  it('treats arrays as absent', () => {
    expect(deriveGlobalSongContentMetrics({ chords: ['C'], lyrics: ['Letra'] })).toEqual({
      hasChords: false,
      hasLyrics: false,
      isComplete: false,
    });
  });

  it('accepts chords with surrounding whitespace', () => {
    expect(deriveGlobalSongContentMetrics({ chords: '   C   G   ' }).hasChords).toBe(true);
  });

  it('accepts lyrics with surrounding whitespace', () => {
    expect(deriveGlobalSongContentMetrics({ lyrics: '  letra da música  ' }).hasLyrics).toBe(true);
  });

  it('does not mark complete when only chords exist', () => {
    const result = deriveGlobalSongContentMetrics({ chords: 'C' });
    expect(result.isComplete).toBe(result.hasChords && result.hasLyrics);
  });

  it('does not mark complete when only lyrics exist', () => {
    const result = deriveGlobalSongContentMetrics({ lyrics: 'L' });
    expect(result.isComplete).toBe(result.hasChords && result.hasLyrics);
  });

  it('marks complete when both derived flags are true', () => {
    const result = deriveGlobalSongContentMetrics({ chords: 'C', lyrics: 'L' });
    expect(result.isComplete).toBe(result.hasChords && result.hasLyrics);
  });

  it('keeps isComplete equal to hasChords && hasLyrics for invalid values', () => {
    const result = deriveGlobalSongContentMetrics({ chords: 0, lyrics: [] });
    expect(result.isComplete).toBe(result.hasChords && result.hasLyrics);
  });
});
