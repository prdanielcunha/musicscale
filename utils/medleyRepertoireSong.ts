import type { ScaleMedley, Song } from '../types';
import { extractLyricsFromCanonicalChordDocument, getRecognizedSectionKey } from './chordDocumentNormalizer';
import { medleyChart } from './medleyModel';
import { medleyPerformanceText } from './medleyPerformanceText';
import { splitMedleySource } from './medleySource';

export type MedleyRepertoireDraft = Omit<Song, 'id' | 'organizationId' | 'createdAt' | 'createdBy'>;

const fingerprint = (value: string): string => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const hasSungText = (value: string): boolean => value.split(/\r?\n/).some(line => {
  const trimmed = line.trim();
  return !!trimmed && !getRecognizedSectionKey(trimmed) && !/^\[[^\]]+\]$/.test(trimmed);
});

/** Exact selected snapshots become a normal repertoire song, without requesting or inventing lyrics. */
export function buildMedleyRepertoireSong(
  arrangement: ScaleMedley,
  name: string,
  sourceSongs: readonly Song[],
): MedleyRepertoireDraft {
  if (!arrangement.steps.length || !name.trim()) throw new Error('medley.invalid');
  const sources = new Map(sourceSongs.map(song => [song.id, song]));
  const chartParts: string[] = [];
  const lyricParts: string[] = [];
  const tabs: NonNullable<Song['tabs']> = [];

  for (const step of arrangement.steps) {
    const source = sources.get(step.songId);
    if (!source) throw new Error('medley.missingSong');
    const label = [step.title, step.label].filter(Boolean).join(' · ');
    const header = '[' + label + ']';
    const performanceChart = medleyPerformanceText(step);
    let selectedLyrics = extractLyricsFromCanonicalChordDocument(performanceChart);

    if (!hasSungText(selectedLyrics) && source.lyrics?.trim()) {
      const entireSource = step.startLine === 0 &&
        step.endLine === splitMedleySource(medleyChart(source)).length - 1;
      if (entireSource) {
        selectedLyrics = source.lyrics.trim();
      } else if (performanceChart.trim()) {
        // Independent lyrics cannot be mapped safely to arbitrary chart line ranges.
        throw new Error('medleyStudioV2.sectionLyricsUnavailable');
      }
    }

    for (let repetition = 0; repetition < step.repetitions; repetition++) {
      chartParts.push(header + '\n' + performanceChart);
      if (hasSungText(selectedLyrics)) lyricParts.push(header + '\n' + selectedLyrics);
    }
    for (const tab of step.tabs || []) {
      tabs.push({ section: label + ' · ' + tab.section, content: tab.content });
    }
    if (step.transition?.cue) chartParts.push('[Transição]\n' + step.transition.cue);
  }

  if (!lyricParts.length) throw new Error('medleyStudioV2.noLyricsDetected');

  const chords = chartParts.join('\n\n');
  const lyrics = lyricParts.join('\n\n');
  const artists = [...new Set(arrangement.steps.map(step => sources.get(step.songId)?.artist?.trim()).filter((artist): artist is string => !!artist))];
  const key = arrangement.steps[0].key || '';
  const metadata = {
    medley: {
      arrangementId: arrangement.id,
      arrangementRevision: arrangement.revision,
      sourceSongIds: [...new Set(arrangement.steps.map(step => step.songId))],
      stepCount: arrangement.steps.length,
      generatedChordsFingerprint: fingerprint(chords),
      generatedLyricsFingerprint: fingerprint(lyrics),
    },
  };

  return {
    title: name.trim(),
    artist: artists.join(' / ').slice(0, 250),
    key,
    selectedKey: key,
    bpm: arrangement.steps[0].bpm ?? null,
    status: 'active',
    tagIds: [],
    lyrics,
    chords,
    tabs,
    chordsUrl: '',
    videoUrl: '',
    lastPlayed: null,
    sourceType: 'medley',
    metadata,
  };
}

/** Only an explicit arrangement ID match is safe; title matching can overwrite unrelated songs. */
export function isSongForMedley(song: Song, arrangementId: string): boolean {
  return song.sourceType === 'medley' && song.metadata?.medley?.arrangementId === arrangementId;
}

/**
 * Existing user edits always win. Regenerate content only when empty or still
 * equal to the last generated fingerprint. All unrelated song fields survive.
 */
export function medleyRepertoireRepairPatch(
  existing: Song,
  generated: MedleyRepertoireDraft,
): Partial<Song> | null {
  const old = existing.metadata?.medley;
  const next = generated.metadata?.medley;
  if (!old || !next || old.arrangementId !== next.arrangementId) throw new Error('medley.invalid');
  const replaceChords = !existing.chords?.trim() || old.generatedChordsFingerprint === fingerprint(existing.chords);
  const replaceLyrics = !existing.lyrics?.trim() || old.generatedLyricsFingerprint === fingerprint(existing.lyrics);
  if (!replaceChords && !replaceLyrics) return null;

  const patch: Partial<Song> = {};
  if (replaceChords && existing.chords !== generated.chords) {
    patch.chords = generated.chords;
    patch.tabs = generated.tabs;
  }
  if (replaceLyrics && existing.lyrics !== generated.lyrics) patch.lyrics = generated.lyrics;

  if (!Object.keys(patch).length) return null;
  patch.metadata = {
    ...existing.metadata,
    medley: {
      ...old,
      ...next,
      generatedChordsFingerprint: replaceChords ? next.generatedChordsFingerprint : old.generatedChordsFingerprint,
      generatedLyricsFingerprint: replaceLyrics ? next.generatedLyricsFingerprint : old.generatedLyricsFingerprint,
    },
  };
  return patch;
}
