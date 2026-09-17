import { isChordOnlyCandidate } from './chordDocumentNormalizer';

const BRACKETED_SECTION_REGEX = /^\s*\[[^\]]+\]\s*$/;

const normalizeComparableLyric = (value: string): string =>
  value
    .trim()
    .normalize('NFC')
    .replace(/\s+/g, ' ');

const stripOuterProgressionParens = (value: string): string =>
  value
    .trim()
    .replace(/^\(\s*/, '')
    .replace(/\s*\)$/, '')
    .trim();

const isChordFragment = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isChordOnlyCandidate(trimmed)) return true;

  const withoutOuterParens = stripOuterProgressionParens(trimmed);
  return Boolean(withoutOuterParens) && isChordOnlyCandidate(withoutOuterParens);
};

const isSection = (value: string): boolean => BRACKETED_SECTION_REGEX.test(value);

const isMeaningfulLyric = (value: string): boolean => {
  const trimmed = value.trim();
  return Boolean(trimmed) && !isSection(trimmed) && !isChordFragment(trimmed);
};

const joinChordFragments = (fragments: string[]): string => {
  if (fragments.length === 0) return '';
  if (fragments.length === 1) return fragments[0];

  const first = fragments[0];
  const indent = first.match(/^\s*/)?.[0] ?? '';
  const compact = fragments.map((fragment) => fragment.trim());

  const beginsParen = compact[0].startsWith('(');
  const endsParen = compact[compact.length - 1].endsWith(')');

  const body = compact
    .map((fragment, index) => {
      let next = fragment;
      if (index > 0 && beginsParen) next = next.replace(/^\(\s*/, '');
      if (index < compact.length - 1 && endsParen) next = next.replace(/\s*\)$/, '');
      return next.trim();
    })
    .filter(Boolean)
    .join('    ');

  return `${indent}${body}`;
};

const isParenthesizedChordRun = (fragments: string[]): boolean => {
  if (fragments.length < 2) return false;
  const first = fragments[0].trimStart();
  const last = fragments[fragments.length - 1].trimEnd();
  return first.startsWith('(') && last.endsWith(')');
};

/**
 * Repairs the second corruption family observed in rich mobile clipboard
 * output from chord sites. This runs only after the caller has already proven
 * the document contains the known recoverable corruption fingerprint.
 *
 * Invariants:
 * - never changes chord spelling or section labels;
 * - never moves content across a section boundary;
 * - only collapses duplicated identical lyrics when the text between them is
 *   exclusively chord material;
 * - only joins consecutive chord fragments when they immediately belong to a
 *   following lyric line, or when a parenthesized progression itself proves
 *   that the fragments belong to one musical row;
 * - a leading unlabeled all-chord block can be recovered as [Intro] when the
 *   first explicit section follows it.
 */
export function repairChordImportFidelity(input: string): string {
  if (!input || typeof input !== 'string') return input || '';

  let lines = input.replace(/\r\n?/g, '\n').split('\n');

  // 1) Repair the mobile clipboard shape:
  // lyric -> chord fragment(s) -> same lyric.
  // Move the intervening chord material before one copy of the lyric so a
  // following pass can merge it with any chord fragment already above it.
  const deduped: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i];
    if (!isMeaningfulLyric(current)) {
      deduped.push(current);
      continue;
    }

    let cursor = i + 1;
    const between: string[] = [];
    let sawChord = false;

    while (cursor < lines.length) {
      const candidate = lines[cursor];
      if (isSection(candidate)) break;
      if (candidate.trim() === '') {
        between.push(candidate);
        cursor += 1;
        continue;
      }
      if (!isChordFragment(candidate)) break;
      sawChord = true;
      between.push(candidate);
      cursor += 1;
    }

    if (
      sawChord &&
      cursor < lines.length &&
      isMeaningfulLyric(lines[cursor]) &&
      normalizeComparableLyric(lines[cursor]) === normalizeComparableLyric(current)
    ) {
      for (const item of between) {
        if (item.trim() !== '') deduped.push(item);
      }
      deduped.push(lines[cursor]);
      i = cursor;
      continue;
    }

    deduped.push(current);
  }
  lines = deduped;

  // 2) Clipboard/mobile layout can physically split one visual chord row into
  // several text lines (for example "G#m7 D#m7 E9" then "B"). When two or
  // more consecutive chord fragments immediately precede a lyric, they are
  // parts of the same chord row. A parenthesized progression is also explicit
  // evidence that its fragments are one row even when the next line is a
  // section marker. Keep exact tokens and join with stable column spacing.
  const merged: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!isChordFragment(lines[i])) {
      merged.push(lines[i]);
      continue;
    }

    const run: string[] = [];
    let cursor = i;
    while (cursor < lines.length && isChordFragment(lines[cursor])) {
      run.push(lines[cursor]);
      cursor += 1;
    }

    const precedesLyric = cursor < lines.length && isMeaningfulLyric(lines[cursor]);
    const parenthesizedRun = isParenthesizedChordRun(run);

    if (run.length >= 2 && (precedesLyric || parenthesizedRun)) {
      merged.push(joinChordFragments(run));
      i = cursor - 1;
      continue;
    }

    merged.push(...run);
    i = cursor - 1;
  }
  lines = merged;

  // 3) If the clipboard dropped only the leading Intro marker but retained an
  // all-chord block immediately before the first explicit section, recover the
  // structural label. Never infer other section names and never cross lyrics.
  const firstSectionIndex = lines.findIndex((line) => isSection(line));
  if (firstSectionIndex > 0) {
    const firstSection = lines[firstSectionIndex].trim().toLocaleLowerCase('pt-BR');
    const isAlreadyIntro = /^\[\s*(?:intro|introdu[cç][aã]o)\b/i.test(firstSection);

    if (!isAlreadyIntro) {
      let blockStart = firstSectionIndex - 1;
      while (blockStart >= 0 && lines[blockStart].trim() === '') blockStart -= 1;
      const blockEnd = blockStart;
      while (blockStart >= 0 && isChordFragment(lines[blockStart])) blockStart -= 1;
      const chordStart = blockStart + 1;
      const chordBlock = chordStart <= blockEnd ? lines.slice(chordStart, blockEnd + 1) : [];

      if (chordBlock.length >= 2 && chordBlock.every(isChordFragment)) {
        lines.splice(chordStart, 0, '[Intro]');
      }
    }
  }

  return lines.join('\n');
}
