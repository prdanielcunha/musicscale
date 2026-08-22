export interface GlobalSongContentMetrics {
  hasChords: boolean;
  hasLyrics: boolean;
  isComplete: boolean;
}

function hasMeaningfulText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function deriveGlobalSongContentMetrics(input: {
  chords?: unknown;
  lyrics?: unknown;
}): GlobalSongContentMetrics {
  const hasChords = hasMeaningfulText(input.chords);
  const hasLyrics = hasMeaningfulText(input.lyrics);

  return {
    hasChords,
    hasLyrics,
    isComplete: hasChords && hasLyrics,
  };
}
