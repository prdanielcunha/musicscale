import { deriveGlobalSongContentMetrics } from '../../utils/globalSongContentMetrics.js';

export async function processGlobalSongContentMetricsWritten(
  snapshot?: any
): Promise<void> {
  if (!snapshot) return;

  const data = snapshot.data();
  if (!data) return;

  const metrics = deriveGlobalSongContentMetrics({
    chords: data.chords,
    lyrics: data.lyrics,
  });

  if (
    data.hasChords === metrics.hasChords &&
    data.hasLyrics === metrics.hasLyrics &&
    data.isComplete === metrics.isComplete
  ) {
    return;
  }

  await snapshot.ref.update(metrics);
}
