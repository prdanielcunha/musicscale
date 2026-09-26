import { splitSongSectionPrefix } from '../components/songs/ChordsRenderer';
import { splitMedleySource } from './medleySource';
export { splitMedleySource, selectMedleyLines } from './medleySource';

export interface MedleySegment {
  id: string;
  startLine: number;
  endLine: number;
  label?: string;
  source: 'section' | 'paragraph' | 'whole';
}

export function suggestMedleySegments(source: string): MedleySegment[] {
  const lines = splitMedleySource(source);
  if (!source.trim()) return [];
  const headings = lines.flatMap((line, index) => {
    const section = splitSongSectionPrefix(line);
    return section ? [{ index, label: section.label }] : [];
  });
  if (headings.length) {
    const result: MedleySegment[] = [];
    if (headings[0].index > 0) result.push({ id: 'before-0', startLine: 0, endLine: headings[0].index - 1, source: 'section' });
    headings.forEach((heading, index) => result.push({
      id: `section-${heading.index}`, startLine: heading.index,
      endLine: (headings[index + 1]?.index ?? lines.length) - 1,
      label: heading.label, source: 'section',
    }));
    return result;
  }
  const paragraphs: MedleySegment[] = [];
  let start = 0;
  for (let index = 0; index < lines.length; index++) {
    if (lines[index].trim() || index === lines.length - 1) continue;
    if (lines.slice(start, index).some(line => line.trim())) {
      paragraphs.push({ id: `paragraph-${start}`, startLine: start, endLine: index, source: 'paragraph' });
    }
    start = index + 1;
  }
  if (lines.slice(start).some(line => line.trim())) paragraphs.push({ id: `paragraph-${start}`, startLine: start, endLine: lines.length - 1, source: 'paragraph' });
  return paragraphs.length > 1 ? paragraphs : [{ id: 'whole', startLine: 0, endLine: lines.length - 1, source: 'whole' }];
}
