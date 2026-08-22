import { deriveGlobalSongContentMetrics } from '../../utils/globalSongContentMetrics.js';
import { buildGlobalSongSearchFields } from '../../utils/searchEngine.js';

function areDerivedValuesEqual(current: unknown, expected: unknown): boolean {
  if (Array.isArray(current) || Array.isArray(expected)) {
    if (!Array.isArray(current) || !Array.isArray(expected)) return false;
    return current.length === expected.length && current.every((value, index) => value === expected[index]);
  }
  return current === expected;
}

export async function processGlobalSongContentMetricsWritten(
  snapshot?: any
): Promise<void> {
  if (!snapshot) return;

  const data = snapshot.data();
  if (!data) return;

  const expectedDerivedFields: Record<string, unknown> = {
    ...deriveGlobalSongContentMetrics({
      chords: data.chords,
      lyrics: data.lyrics,
    }),
    ...buildGlobalSongSearchFields(data),
  };

  const updates: Record<string, unknown> = {};
  for (const [field, expectedValue] of Object.entries(expectedDerivedFields)) {
    if (!areDerivedValuesEqual(data[field], expectedValue)) {
      updates[field] = expectedValue;
    }
  }

  if (Object.keys(updates).length === 0) return;

  await snapshot.ref.update(updates);
}
