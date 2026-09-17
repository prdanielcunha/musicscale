const CHORD_WORD_REGEX = /^([A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M|º|°|\d|7M|M7)*(?:\([^)]*\))?(?:\/[A-G][#b]?)?)$/;

const SECTION_PATTERNS = [
  /^(?:intro|introducao|introduccion|introduction)(?:\s+\d+)?$/,
  /^(?:inicio|abertura|opening|start|comienzo|apertura)$/,
  /^(?:parte|part)\s+(?:inicial|initial)$/,
  /^(?:primeira|segunda|terceira|quarta|quinta|primera|segunda|tercera|cuarta|quinta)\s+(?:parte|estrofe|estrofa)$/,
  /^(?:1|1a|1ª|1o|1º|2|2a|2ª|2o|2º|3|3a|3ª|3o|3º|4|4a|4ª|4o|4º|5|5a|5ª|5o|5º)\s+(?:parte|verso|verse|estrofe|estrofa)$/,
  /^parte\s+(?:\d+|[a-e])$/,
  /^part\s+(?:\d+|[a-e])$/,
  /^(?:v|v\.|verso|verse)\s*\d+$/,
  /^(?:(?:primeiro|segundo|terceiro|cuarto|quinto|primer|segundo|tercer|cuarto|quinto)\s+)?(?:verso|verse|estrofe|estrofa)(?:\s+\d+)?$/,
  /^(?:pre[- ]?refrao|pre[- ]?coro|pre[- ]?chorus|prechorus)(?:\s+\d+)?$/,
  /^(?:pos[- ]?refrao|post[- ]?chorus|postchorus)(?:\s+\d+)?$/,
  /^(?:refrao|coro|chorus)(?:\s+\d+)?$/,
  /^(?:ponte|puente|bridge)(?:\s+\d+)?$/,
  /^(?:instrumental|interludio|interlude|turnaround)(?:\s+\d+)?$/,
  /^(?:solo|riff)(?:\s+(?:intro|introducao|introduccion|guitarra|violao|baixo|teclado|instrumental))?(?:\s+\d+)?$/,
  /^(?:ministracao|ministracion|espontaneo|spontaneous|vamp|tag|break)(?:\s+\d+)?$/,
  /^(?:final|fim|encerramento|cierre|outro|ending|coda)(?:\s+\d+)?$/,
];

const fold = (value: string): string =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();

const stripInvisibleTextNoise = (value: string): string =>
  String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b-\u200d\u2060]/g, '');

export const isChordOnlyCandidate = (line: string): boolean => {
  const trimmed = String(line || '').trim();
  if (!trimmed) return false;

  const words = trimmed.split(/[\s|\[\]]+/);
  let chordCount = 0;
  let nonChordCount = 0;

  for (const word of words) {
    if (!word) continue;
    if (CHORD_WORD_REGEX.test(word)) chordCount += 1;
    else if (!/^[0-9()\-x~.]+$/.test(word)) nonChordCount += 1;
  }

  return chordCount > 0 && nonChordCount <= chordCount;
};

export const getRecognizedSectionKey = (line: string): string | null => {
  const trimmed = String(line || '').trim();
  if (!trimmed) return null;

  const bracketed = trimmed.match(/^\[([^\]]+)\]\s*$/);
  const rawLabel = bracketed ? bracketed[1] : trimmed.replace(/\s*[:.]\s*$/, '');
  const folded = fold(rawLabel)
    .replace(/^tab(?:latura)?\s*[-:]\s*/, '')
    .replace(/\s*\((?:\d+\s*x|x\s*\d+)\)\s*$/, '')
    .replace(/\s+(?:x\s*)?\d+\s*x\s*$/, '')
    .trim();

  if (!folded) return null;
  return SECTION_PATTERNS.some((pattern) => pattern.test(folded)) ? folded : null;
};

type NormalizedLine = {
  text: string;
  recoveredCorruptChord: boolean;
};

const recoverCorruptChordPrefix = (line: string): NormalizedLine => {
  const cleaned = stripInvisibleTextNoise(line);
  const leadingWhitespace = cleaned.match(/^\s*/)?.[0] || '';
  const trimmed = cleaned.trimStart();

  const plainPrefix = trimmed.match(/^(?:(?:"|“|”|'|‘|’)\s*)?>\s*(.+)$/);
  if (plainPrefix) {
    const candidate = plainPrefix[1];
    if (isChordOnlyCandidate(candidate)) {
      return { text: `${leadingWhitespace}${candidate}`, recoveredCorruptChord: true };
    }
  }

  const htmlPrefix = trimmed.match(/^(?:(?:&quot;|&#34;|&#x22;)\s*)?(?:&gt;|&#62;|&#x3e;)\s*(.+)$/i);
  if (htmlPrefix) {
    const candidate = htmlPrefix[1];
    if (isChordOnlyCandidate(candidate)) {
      return { text: `${leadingWhitespace}${candidate}`, recoveredCorruptChord: true };
    }
  }

  return { text: cleaned, recoveredCorruptChord: false };
};

export const hasRecoverableChordDocumentCorruption = (input: string): boolean => {
  if (typeof input !== 'string' || !input) return false;
  return input
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .some((rawLine) => recoverCorruptChordPrefix(rawLine).recoveredCorruptChord);
};

/**
 * Repairs only the proven rich-copy corruption prefix. Source order, repeated
 * lyrics/sections, blank lines, underscore prolongations and horizontal chord
 * columns are intentionally preserved. Import normalization must never infer
 * that repeated musical material is accidental: repetitions are meaningful in
 * worship charts and deleting/reordering them destroys chord-to-lyric fidelity.
 */
export const normalizeChordDocumentStructure = (input: string): string => {
  if (typeof input !== 'string' || input.length === 0) return '';

  const normalizedInput = input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');

  return normalizedInput
    .split('\n')
    .map((rawLine) => recoverCorruptChordPrefix(rawLine).text)
    .join('\n');
};

/**
 * Builds a lyrics-only document from the canonical chord document. This is a
 * deterministic fallback/guardrail for AI import previews and never invents
 * musical content.
 */
export const extractLyricsFromCanonicalChordDocument = (input: string): string => {
  const canonical = normalizeChordDocumentStructure(input);
  if (!canonical) return '';

  const output: string[] = [];
  for (const line of canonical.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (output.length > 0 && output[output.length - 1] !== '') output.push('');
      continue;
    }

    if (getRecognizedSectionKey(trimmed)) {
      output.push(trimmed);
      continue;
    }

    if (isChordOnlyCandidate(trimmed)) continue;

    const lyric = line
      .replace(/\[[A-G][#b]?(?:m|maj|min|dim|aug|sus|add|M|º|°|\d|7M|M7)*(?:\([^)]*\))?(?:\/[A-G][#b]?)?\]/g, '')
      .trim();
    if (lyric) output.push(lyric);
  }

  while (output.length > 0 && output[output.length - 1] === '') output.pop();
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};