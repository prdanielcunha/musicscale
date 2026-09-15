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
    if (CHORD_WORD_REGEX.test(word)) {
      chordCount += 1;
    } else if (!/^[0-9()\-x~.]+$/.test(word)) {
      nonChordCount += 1;
    }
  }

  if (chordCount === 0) return false;
  return nonChordCount <= chordCount;
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
    const candidate = plainPrefix[1].trim();
    if (isChordOnlyCandidate(candidate)) {
      return {
        text: `${leadingWhitespace}${candidate}`,
        recoveredCorruptChord: true,
      };
    }
  }

  const htmlPrefix = trimmed.match(/^(?:(?:&quot;|&#34;|&#x22;)\s*)?(?:&gt;|&#62;|&#x3e;)\s*(.+)$/i);
  if (htmlPrefix) {
    const candidate = htmlPrefix[1].trim();
    if (isChordOnlyCandidate(candidate)) {
      return {
        text: `${leadingWhitespace}${candidate}`,
        recoveredCorruptChord: true,
      };
    }
  }

  return { text: cleaned, recoveredCorruptChord: false };
};

const isMeaningfulLyric = (line: string): boolean => {
  const trimmed = line.trim();
  return Boolean(trimmed) && !isChordOnlyCandidate(trimmed) && !getRecognizedSectionKey(trimmed);
};

/**
 * Repairs only deterministic formatting corruption. It deliberately does not
 * invent lyrics, chords, sections or keys, and it preserves horizontal chord
 * spacing on already-valid lines.
 */
export const normalizeChordDocumentStructure = (input: string): string => {
  if (typeof input !== 'string' || input.length === 0) return '';

  const normalizedInput = input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n');

  const source = normalizedInput.split('\n').map(recoverCorruptChordPrefix);
  const repaired: NormalizedLine[] = [];

  // Known copy/import corruption fingerprint:
  // lyric -> quote/blockquote-prefixed chord -> same lyric.
  // In that narrow case the first lyric is a duplicate and the recovered
  // chord belongs immediately before the surviving lyric.
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const chord = source[index + 1];
    const repeated = source[index + 2];

    if (
      repeated &&
      chord?.recoveredCorruptChord &&
      isMeaningfulLyric(current.text) &&
      current.text.trim() === repeated.text.trim()
    ) {
      repaired.push(chord, repeated);
      index += 2;
      continue;
    }

    repaired.push(current);
  }

  // Drop a duplicated section marker only when the duplicate is proven to be
  // part of the same corrupt import fragment (a recovered malformed chord was
  // seen and no lyric appeared between the two equal section markers).
  const withoutDuplicateSections: NormalizedLine[] = [];
  let activeSectionKey: string | null = null;
  let sawLyricSinceSection = false;
  let sawRecoveredChordSinceSection = false;

  for (const entry of repaired) {
    const sectionKey = getRecognizedSectionKey(entry.text);
    if (sectionKey) {
      if (
        sectionKey === activeSectionKey &&
        sawRecoveredChordSinceSection &&
        !sawLyricSinceSection
      ) {
        while (
          withoutDuplicateSections.length > 0 &&
          withoutDuplicateSections[withoutDuplicateSections.length - 1].text.trim() === ''
        ) {
          withoutDuplicateSections.pop();
        }
        continue;
      }

      activeSectionKey = sectionKey;
      sawLyricSinceSection = false;
      sawRecoveredChordSinceSection = false;
      withoutDuplicateSections.push(entry);
      continue;
    }

    if (entry.text.trim()) {
      if (entry.recoveredCorruptChord) {
        sawRecoveredChordSinceSection = true;
      } else if (!isChordOnlyCandidate(entry.text)) {
        sawLyricSinceSection = true;
      }
    }

    withoutDuplicateSections.push(entry);
  }

  // One blank line is enough between musical blocks. Section spacing is a UI
  // responsibility, so blank lines immediately around section labels are
  // removed to avoid the giant gaps seen on mobile.
  const compact: string[] = [];
  for (const entry of withoutDuplicateSections) {
    const line = entry.text;
    if (line.trim() === '') {
      if (compact.length === 0 || compact[compact.length - 1].trim() === '') continue;
      compact.push('');
      continue;
    }
    compact.push(line);
  }

  while (compact.length > 0 && compact[compact.length - 1].trim() === '') {
    compact.pop();
  }

  return compact
    .filter((line, index, lines) => {
      if (line.trim() !== '') return true;
      const previous = lines[index - 1] || '';
      const next = lines[index + 1] || '';
      return !getRecognizedSectionKey(previous) && !getRecognizedSectionKey(next);
    })
    .join('\n')
    .trim();
};
