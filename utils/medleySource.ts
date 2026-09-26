/** Line numbers include blank rows; a selection always slices the original bytes. */
export function splitMedleySource(source: string): string[] {
  return source.split(/\r\n|\n|\r/);
}

export function selectMedleyLines(source: string, startLine: number, endLine: number): string {
  const lines = splitMedleySource(source);
  if (!Number.isInteger(startLine) || !Number.isInteger(endLine) ||
      startLine < 0 || endLine < startLine || endLine >= lines.length) {
    throw new RangeError('Invalid medley line range');
  }
  const offsets = [...source.matchAll(/\r\n|\n|\r/g)].map(match => match.index!);
  const start = startLine === 0 ? 0 : offsets[startLine - 1] + (source.slice(offsets[startLine - 1]).startsWith('\r\n') ? 2 : 1);
  const end = endLine === lines.length - 1 ? source.length : offsets[endLine];
  return source.slice(start, end);
}
