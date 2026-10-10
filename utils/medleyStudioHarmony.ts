/**
 * Deterministic, advisory transition sketches only. We NEVER change a chart,
 * auto-play anything or describe inferred chords as confirmed source chords.
 */
export interface HarmonyCandidate {
  id: 'direct' | 'dominant' | 'two-five';
  chords: string[];
  confidence: 'medium' | 'low';
  explanation: 'direct' | 'dominant' | 'twoFive';
}
export interface HarmonyAnalysis {
  exitChord?: string;
  entryChord?: string;
  candidates: HarmonyCandidate[];
  reason?: 'missingChords' | 'sameChord';
}

const ROOTS: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const PITCHES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const CHORD = /^[A-G](?:#|b)?(?:m(?!aj)|maj|min|dim|aug|sus|add|M)?(?:[0-9+#b°ø()]*)?(?:\/[A-G](?:#|b)?)?$/;
const HEADER = /^\s*\[(?:intro|verso|verse|refr[aã]o|chorus|ponte|bridge|final|outro|solo|parte|pré-refr[aã]o|pre-chorus)[^\]]*\]\s*$/i;

export function detectedHarmonyEvents(source: string): string[] {
  const result: string[] = [];
  for (const line of source.split(/\r\n|\n|\r/)) {
    if (HEADER.test(line)) continue;
    const bracketless = line.replace(/\[[^\]]+\]/g, '').trim();
    if (!bracketless) continue;
    const tokens = bracketless.split(/\s+/).filter(Boolean);
    // Only chord-dominant lines. Never mine individual A, C, D letters out of lyrics.
    if (tokens.length > 0 && tokens.every(token => CHORD.test(token))) result.push(...tokens);
  }
  return result;
}
export function analyzeMedleyBridge(fromExcerpt: string, toExcerpt: string): HarmonyAnalysis {
  const exitChord = detectedHarmonyEvents(fromExcerpt).at(-1);
  const entryChord = detectedHarmonyEvents(toExcerpt)[0];
  if (!exitChord || !entryChord) return { exitChord, entryChord, candidates: [], reason: 'missingChords' };
  const direct: HarmonyCandidate = { id: 'direct', chords: [exitChord, entryChord], confidence: 'medium', explanation: 'direct' };
  if (exitChord === entryChord) return { exitChord, entryChord, candidates: [direct], reason: 'sameChord' };
  const match = /^([A-G](?:#|b)?)/.exec(entryChord);
  const root = match ? ROOTS[match[1]] : undefined;
  if (root === undefined) return { exitChord, entryChord, candidates: [direct] };
  const dominant = PITCHES[(root + 7) % 12] + '7';
  const two = PITCHES[(root + 2) % 12] + (/(?:^|[^a-z])m(?!aj)/i.test(entryChord.slice(match![1].length)) ? 'm7b5' : 'm7');
  return { exitChord, entryChord, candidates: [
    direct,
    { id: 'dominant', chords: [exitChord, dominant, entryChord], confidence: 'low', explanation: 'dominant' },
    { id: 'two-five', chords: [exitChord, two, dominant, entryChord], confidence: 'low', explanation: 'twoFive' },
  ] };
}
