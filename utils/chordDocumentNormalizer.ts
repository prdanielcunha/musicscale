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

const splitRecognizedSectionPrefix = (line: string): string[] => {
  const cleaned = stripInvisibleTextNoise(line);
  const trimmed = cleaned.trim();
  const bracketed = trimmed.match(/^\[([^\]]+)\]\s*(.+)$/);
  if (!bracketed) return [cleaned];

  const section = `[${bracketed[1].trim()}]`;
  if (!getRecognizedSectionKey(section)) return [cleaned];

  const remainder = bracketed[2].trim();
  if (!remainder) return [section];
  return [section, remainder];
};

export const hasRecoverableChordDocumentCorruption = (input: string): boolean => {
  if (typeof input !== 'string' || !input) return false;

  // Keep this gate intentionally narrow. A valid chart may legitimately use
  // forms such as "[Intro] E G#m C#m" on one line. Structural repair is only
  // allowed when the paste contains the proven corruption fingerprint from
  // imported blockquote/escaped markup, e.g. `">D4`, `> C9` or `&gt;G`.
  // Once that fingerprint exists anywhere in the document, the deterministic
  // repair may also split section+chord lines and remove duplicate artifacts.
  const normalizedInput = input.replace(/\r\n?/g, '\n');
  return normalizedInput
    .split('\n')
    .some((rawLine) => recoverCorruptChordPrefix(rawLine).recoveredCorruptChord);
};

const isMeaningfulLyric = (line: string): boolean => {
  const trimmed = line.trim();
  return Boolean(trimmed) && !isChordOnlyCandidate(trimmed) && !getRecognizedSectionKey(trimmed);
};

const nextNonBlankIndex = (lines: NormalizedLine[], start: number): number => {
  for (let index = start; index < lines.length; index += 1) {
    if (lines[index].text.trim()) return index;
  }
  return -1;
};

const repairInternalLyricPlaceholderUnderscores = (line: string): string =>
  line.replace(/(\p{L})_{2,}(\p{L})/gu, '$1$2');

/**
 * Some rich-copy chord pages emit the tail of the previous musical block after
 * the next section marker and then repeat that same section marker. The
 * recovered blockquote chord is the proof that this is corruption rather than
 * an intentional repeated section. Move the stranded block back before the
 * boundary and keep exactly one section marker.
 */
const repairStrandedContentAcrossDuplicateSectionBoundary = (
  lines: NormalizedLine[],
): NormalizedLine[] => {
  const output: NormalizedLine[] = [];
  let index = 0;

  while (index < lines.length) {
    const current = lines[index];
    const sectionKey = getRecognizedSectionKey(current.text);

    if (!sectionKey) {
      output.push(current);
      index += 1;
      continue;
    }

    let cursor = index + 1;
    let matchingSectionIndex = -1;
    let sawRecoveredChord = false;

    while (cursor < lines.length) {
      const candidate = lines[cursor];
      const candidateSectionKey = getRecognizedSectionKey(candidate.text);

      if (candidateSectionKey) {
        if (candidateSectionKey === sectionKey) {
          matchingSectionIndex = cursor;
        }
        break;
      }

      if (candidate.recoveredCorruptChord) {
        sawRecoveredChord = true;
      }
      cursor += 1;
    }

    if (matchingSectionIndex !== -1 && sawRecoveredChord) {
      // Everything between the duplicated markers is a stranded tail from the
      // preceding block. Preserve its exact order/spacing, then place one marker.
      output.push(...lines.slice(index + 1, matchingSectionIndex));
      output.push(current);
      index = matchingSectionIndex + 1;
      continue;
    }

    output.push(current);
    index += 1;
  }

  return output;
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

  const source: NormalizedLine[] = [];
  for (const rawLine of normalizedInput.split('\n')) {
    for (const expandedLine of splitRecognizedSectionPrefix(rawLine)) {
      source.push(recoverCorruptChordPrefix(expandedLine));
    }
  }

  // Lyric extenders occupy musical columns. Removing them here would move
  // syllables left while leaving their chords at the original positions.

  const repaired: NormalizedLine[] = [];

  // Known copy/import corruption fingerprint, allowing blank spacer lines:
  // lyric -> quote/blockquote-prefixed chord -> same lyric.
  // The malformed chord belongs immediately before the surviving lyric.
  let index = 0;
  while (index < source.length) {
    const current = source[index];
    if (isMeaningfulLyric(current.text)) {
      const chordIndex = nextNonBlankIndex(source, index + 1);
      const repeatedIndex = chordIndex >= 0 ? nextNonBlankIndex(source, chordIndex + 1) : -1;
      const chord = chordIndex >= 0 ? source[chordIndex] : null;
      const repeated = repeatedIndex >= 0 ? source[repeatedIndex] : null;

      if (
        chord &&
        repeated &&
        chord.recoveredCorruptChord &&
        current.text.trim() === repeated.text.trim()
      ) {
        repaired.push(chord, repeated);
        index = repeatedIndex + 1;
        continue;
      }
    }

    repaired.push(current);
    index += 1;
  }

  const boundaryRepaired = repairStrandedContentAcrossDuplicateSectionBoundary(repaired);

  // Drop a repeated section only when a recovered corrupt chord occurred
  // between equal section markers and no lyric occurred. This keeps legitimate
  // repeated instrumental sections intact while removing the import fingerprint.
  const withoutDuplicateSections: NormalizedLine[] = [];
  let activeSectionKey: string | null = null;
  let sawLyricSinceSection = false;
  let sawRecoveredChordSinceSection = false;

  for (const entry of boundaryRepaired) {
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
    .filter((line, lineIndex, lines) => {
      if (line.trim() !== '') return true;
      const previous = lines[lineIndex - 1] || '';
      const next = lines[lineIndex + 1] || '';
      return !getRecognizedSectionKey(previous) && !getRecognizedSectionKey(next);
    })
    .join('\n')
    .trim();
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
    if (lyric) output.push(repairInternalLyricPlaceholderUnderscores(lyric));
  }

  while (output.length > 0 && output[output.length - 1] === '') output.pop();
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
};
