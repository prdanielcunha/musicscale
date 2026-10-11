import { getRecognizedSectionKey, normalizeChordDocumentStructure } from './chordDocumentNormalizer';

/** Chord tokens: never infer new words, delete repetitions or reorder lines. */
const CHORD = /^[A-G](?:#|b)?(?:(?:maj|min|dim|aug|sus|add)(?:2|4|6|7|9|11|13)?|(?:m|M)?(?:2|4|5|6|7|9|11|13)(?:M|maj)?|m|M|º|°|ø)?(?:\([0-9#b+,\-]+\))?(?:\/(?:[A-G][#b]?|[0-9]+))?$/;
const isChordRow = (line: string): boolean => {
  const parts = line.trim().replace(/^[:|\s]+|[:|\s]+$/g, '').split(/[\s|]+/).filter(Boolean);
  if (!parts.length) return false;
  // Single notes on separate rows are chords, except A/B/C/D/E/F/G can also
  // be meaningful single-word lyrics: prefer preserving the ambiguous word.
  return parts.length >= 2 && parts.every(part => CHORD.test(part) || /^(?:\d+x|x\d+)$/i.test(part));
};
const isTablature = (line: string): boolean =>
  /^\s*(?:e|B|G|D|A|E|[1-6])\s*\|[-\d\sxhpbr\/\\~().|:]+$/i.test(line) ||
  /^\s*[-|.\d]+\s*$/.test(line);
const isChartMetadata = (line: string): boolean =>
  /^(?:tom|key|capo|capotraste|afinac(?:ao|ion)|tuning|bpm|tempo|compasso)\s*:/i.test(line.trim());

/**
 * Deterministically extracts what is written in a stored chord chart.
 * Never calls AI or invents missing verses; source chart is not mutated.
 * Conservative on ambiguous lines: a sung phrase is better preserved than lost.
 */
export function generateLyricsFromChords(chords: string): { lyrics: string; hasSungContent: boolean } {
  const canonical = normalizeChordDocumentStructure(chords);
  const result: string[] = [];
  let hasSungContent = false;
  for (const line of canonical.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (result.length && result[result.length - 1] !== '') result.push('');
      continue;
    }
    if (isChartMetadata(trimmed) || isTablature(trimmed) || isChordRow(trimmed)) continue;
    // Bracket labels may be chords (e.g. [Am D/F#]) or meaningful medley titles.
    const bracket = trimmed.match(/^\[([^\]]+)\]$/);
    if (bracket && bracket[1].split(/\s+/).every(token => CHORD.test(token))) continue;
    const section = getRecognizedSectionKey(trimmed);
    if (section) {
      // Ignore purely instrumental cues in the lyrics view.
      if (/^(?:intro|introdu|solo|riff|instrumental|interlud|turnaround|final|fim|outro|ending|coda)/i.test(section)) continue;
      result.push(trimmed);
      continue;
    }
    // Chords embedded inline, e.g. [G]Senhor [D/F#]meu Deus.
    const withoutInlineChords = trimmed.replace(/\[([^\]]+)\]/g, (match, token: string) => CHORD.test(token.trim()) ? '' : match);
    const lyric = withoutInlineChords.trim();
    if (!lyric || isChordRow(lyric) || isTablature(lyric)) continue;
    // Don't count unknown bracket-only labels or musical cues as verses.
    const isUnknownHeader = /^\[[^\]]+\]$/.test(lyric);
    if (!isUnknownHeader) hasSungContent = true;
    result.push(lyric);
  }
  while (result.length && result[result.length - 1] === '') result.pop();
  return { lyrics: result.join('\n').replace(/\n{3,}/g, '\n\n').trim(), hasSungContent };
}
