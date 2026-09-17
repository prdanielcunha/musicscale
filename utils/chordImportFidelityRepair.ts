import { getRecognizedSectionKey, isChordOnlyCandidate } from './chordDocumentNormalizer';

type ClipboardLine = { text: string; recoveredChord: boolean };

const corruptChord = (line: string): string | null => {
  const leading = line.match(/^\s*/)?.[0] || '';
  const trimmed = line.trimStart();
  const match = trimmed.match(
    /^(?:(?:"|“|”|'|‘|’|&quot;|&#34;|&#x22;)\s*)?(?:>|&gt;|&#62;|&#x3e;)\s*(.+)$/i,
  );
  if (!match) return null;
  const candidate = match[1].trim();
  if (!isChordOnlyCandidate(candidate)) return null;
  return `${leading}${candidate}`;
};

const asLines = (input: string): ClipboardLine[] =>
  input.replace(/\r\n?/g, '\n').split('\n').flatMap<ClipboardLine>((text) => {
    const recovered = corruptChord(text);
    if (recovered !== null) return [{ text: recovered, recoveredChord: true }];

    // CifraClub's rich clipboard can concatenate the section label with the
    // first chord row. Split it only after the corruption fingerprint proves
    // this is the affected clipboard format.
    const inlineSection = text.match(/^(\s*\[[^\]]+\])\s+(.+)$/);
    if (
      inlineSection &&
      getRecognizedSectionKey(inlineSection[1]) &&
      isChordOnlyCandidate(inlineSection[2])
    ) {
      return [
        { text: inlineSection[1], recoveredChord: false },
        { text: inlineSection[2], recoveredChord: false },
      ];
    }

    return [{ text, recoveredChord: false }];
  });

const isSection = (line: ClipboardLine): boolean => Boolean(getRecognizedSectionKey(line.text));
const isLyric = (line: ClipboardLine): boolean => {
  const trimmed = line.text.trim();
  if (!trimmed || isSection(line)) return false;
  // The generic chord heuristic intentionally tolerates one unknown token,
  // which makes short lyrics such as "Linha A" look chord-like. Validate the
  // individual tokens so that one lyric word cannot be absorbed into a chord
  // row merely because the last word happens to be A–G.
  if (!isChordOnlyCandidate(trimmed)) return true;
  return trimmed
    .split(/\s+/)
    .map((token) => token.replace(/^[([]+|[)\].,;:]+$/g, ''))
    .some((token) => /[A-Za-zÀ-ÿ]/.test(token) && !isChordOnlyCandidate(token));
};
const sameLyric = (left: ClipboardLine, right: ClipboardLine): boolean =>
  left.text.trim().normalize('NFC') === right.text.trim().normalize('NFC');

const previousNonBlank = (lines: ClipboardLine[], start: number): number => {
  for (let index = start; index >= 0; index -= 1) {
    if (lines[index].text.trim()) return index;
  }
  return -1;
};

const nextNonBlank = (lines: ClipboardLine[], start: number): number => {
  for (let index = start; index < lines.length; index += 1) {
    if (lines[index].text.trim()) return index;
  }
  return -1;
};

const indentRecoveredChord = (
  chord: ClipboardLine,
  lines: ClipboardLine[],
  lyricIndex: number,
): ClipboardLine => {
  const spacer = lines[lyricIndex - 1]?.text || '';
  if (spacer.length > 0 && spacer.trim() === '' && !chord.text.match(/^\s+/)) {
    return { ...chord, text: `${spacer}${chord.text}` };
  }
  return chord;
};

const repairSectionBoundaryDuplicates = (source: ClipboardLine[]): ClipboardLine[] => {
  const lines = [...source];
  let changed = true;

  while (changed) {
    changed = false;
    for (let sectionIndex = 0; sectionIndex < lines.length; sectionIndex += 1) {
      const sectionKey = getRecognizedSectionKey(lines[sectionIndex].text);
      if (!sectionKey) continue;

      const chordIndex = nextNonBlank(lines, sectionIndex + 1);
      if (chordIndex < 0 || !lines[chordIndex].recoveredChord) continue;

      const contentIndex = nextNonBlank(lines, chordIndex + 1);
      if (contentIndex < 0) continue;
      const nextSectionIndex = isSection(lines[contentIndex])
        ? contentIndex
        : nextNonBlank(lines, contentIndex + 1);
      if (
        nextSectionIndex < 0 ||
        getRecognizedSectionKey(lines[nextSectionIndex].text) !== sectionKey
      ) continue;

      const previousIndex = previousNonBlank(lines, sectionIndex - 1);
      const repeatsPreviousLyric =
        !isSection(lines[contentIndex]) &&
        previousIndex >= 0 &&
        isLyric(lines[previousIndex]) &&
        isLyric(lines[contentIndex]) &&
        sameLyric(lines[previousIndex], lines[contentIndex]);

      if (!isSection(lines[contentIndex]) && !repeatsPreviousLyric) continue;

      const replacement: ClipboardLine[] = [];
      if (repeatsPreviousLyric) {
        replacement.push(
          indentRecoveredChord(lines[chordIndex], lines, previousIndex),
          lines[contentIndex],
        );
      } else {
        replacement.push(lines[chordIndex]);
      }
      replacement.push(lines[sectionIndex]);

      let replaceStart = sectionIndex;
      if (repeatsPreviousLyric) {
        replaceStart = previousIndex;
        if (
          previousIndex > 0 &&
          lines[previousIndex - 1].text.length > 0 &&
          lines[previousIndex - 1].text.trim() === ''
        ) {
          replaceStart = previousIndex - 1;
        }
      }

      lines.splice(replaceStart, nextSectionIndex - replaceStart + 1, ...replacement);
      changed = true;
      break;
    }
  }

  return lines;
};

const repairDuplicatedLyricRows = (source: ClipboardLine[]): ClipboardLine[] => {
  const lines = [...source];
  let changed = true;

  while (changed) {
    changed = false;
    for (let lyricIndex = 0; lyricIndex < lines.length; lyricIndex += 1) {
      if (!isLyric(lines[lyricIndex])) continue;
      const chordIndex = nextNonBlank(lines, lyricIndex + 1);
      const repeatedIndex = chordIndex >= 0 ? nextNonBlank(lines, chordIndex + 1) : -1;
      if (
        chordIndex < 0 || repeatedIndex < 0 ||
        !lines[chordIndex].recoveredChord ||
        !isLyric(lines[repeatedIndex]) ||
        !sameLyric(lines[lyricIndex], lines[repeatedIndex])
      ) continue;

      const chord = indentRecoveredChord(lines[chordIndex], lines, lyricIndex);
      let replaceStart = lyricIndex;
      if (
        lyricIndex > 0 &&
        lines[lyricIndex - 1].text.length > 0 &&
        lines[lyricIndex - 1].text.trim() === ''
      ) {
        replaceStart = lyricIndex - 1;
      }
      lines.splice(replaceStart, repeatedIndex - replaceStart + 1, chord, lines[repeatedIndex]);
      changed = true;
      break;
    }
  }

  return lines;
};

const joinChordFragments = (fragments: ClipboardLine[]): ClipboardLine => {
  let result = fragments[0].text.trimEnd();
  for (const fragment of fragments.slice(1)) {
    const chord = fragment.text.trim();
    const desiredColumn = fragment.text.length - fragment.text.trimStart().length;
    const gap = desiredColumn > result.length
      ? ' '.repeat(desiredColumn - result.length)
      : '    ';
    result += `${gap}${chord}`;
  }
  return { text: result, recoveredChord: true };
};

const mergeRecoveredChordFragments = (source: ClipboardLine[]): ClipboardLine[] => {
  const output: ClipboardLine[] = [];
  let index = 0;

  while (index < source.length) {
    if (!isChordOnlyCandidate(source[index].text.trim()) || isLyric(source[index])) {
      output.push(source[index]);
      index += 1;
      continue;
    }

    const fragments: ClipboardLine[] = [];
    let cursor = index;
    while (cursor < source.length) {
      if (source[cursor].text.trim() === '') {
        cursor += 1;
        continue;
      }
      if (!isChordOnlyCandidate(source[cursor].text.trim()) || isLyric(source[cursor])) break;
      fragments.push(source[cursor]);
      cursor += 1;
    }

    const followedByLyric = cursor < source.length && isLyric(source[cursor]);
    const containsRecovered = fragments.some((fragment) => fragment.recoveredChord);
    if (fragments.length > 1 && followedByLyric && containsRecovered) {
      output.push(joinChordFragments(fragments));
      index = cursor;
      continue;
    }

    // Instrumental rows have no lyric after them. In the corrupted clipboard
    // each recovered chord closes the original row, so rebuild row by row
    // instead of combining the entire intro/interlude into one progression.
    if (fragments.length > 1 && containsRecovered) {
      let group: ClipboardLine[] = [];
      for (const fragment of fragments) {
        group.push(fragment);
        if (fragment.recoveredChord) {
          output.push(group.length > 1 ? joinChordFragments(group) : group[0]);
          group = [];
        }
      }
      output.push(...group);
      index = cursor;
      continue;
    }

    output.push(source[index]);
    index += 1;
  }

  return output;
};

/**
 * Reconstructs the deterministic corruption emitted by rich mobile clipboard
 * markup used by chord sites. The quote/blockquote chord marker is the proof
 * that repair is safe; ordinary charts are returned byte-for-byte unchanged.
 */
export function repairChordImportFidelity(input: string): string {
  if (!input || typeof input !== 'string') return input || '';
  const parsed = asLines(input);
  if (!parsed.some((line) => line.recoveredChord)) return input;

  const boundaries = repairSectionBoundaryDuplicates(parsed);
  const lyricRows = repairDuplicatedLyricRows(boundaries);
  const chordRows = mergeRecoveredChordFragments(lyricRows);
  return chordRows.map((line) => line.text).join('\n');
}
