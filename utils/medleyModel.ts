import type { ScaleMedley, Song } from '../types';
import { selectMedleyLines, splitMedleySource } from './medleySource';

/** A source identifier used to detect edits, not an authentication primitive. */
export function medleySourceRevision(song: Pick<Song, 'chords' | 'lyrics' | 'tabs'> & { chordsUrl?: string }): string {
  const source = JSON.stringify([song.chords || '', song.lyrics || '', song.tabs || [], song.chordsUrl || '']);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function medleyChart(song: Pick<Song, 'chords' | 'lyrics'>): string {
  return song.chords?.trim() ? song.chords : song.lyrics || '';
}

export function medleyTabsForSelection(song: Pick<Song, 'chords' | 'lyrics' | 'tabs'>, startLine: number, endLine: number, label?: string) {
  const tabs = song.tabs || [];
  if (startLine === 0 && endLine === splitMedleySource(medleyChart(song)).length - 1) return tabs;
  const folded = (label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  return folded ? tabs.filter(tab => (tab.section || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() === folded) : [];
}

/** Unique legacy projection: one occurrence of each source song, in stage order. */
export function orderMedleySongIds(songIds: string[], medleys: ScaleMedley[]): string[] {
  const memberIds = new Set(medleys.flatMap(medley => medley.steps.map(step => step.songId)));
  const result: string[] = [];
  for (const id of songIds) {
    const anchored = medleys.find(medley => medley.anchorSongId === id);
    if (anchored) {
      for (const step of anchored.steps) if (!result.includes(step.songId)) result.push(step.songId);
    } else if (!memberIds.has(id)) result.push(id);
  }
  return result;
}

export function validateMedleys(medleys: ScaleMedley[], songIds: string[], songs: Map<string, Pick<Song, 'organizationId' | 'chords' | 'lyrics' | 'tabs'> & { chordsUrl?: string }>, organizationId: string, previous: ScaleMedley[] = []): void {
  if (!Array.isArray(medleys) || medleys.length > 20) throw new Error('Invalid medley count');
  const anchors = new Set<string>();
  const ids = new Set<string>();
  const groupedSongs = new Set<string>();
  let totalBytes = 0;
  for (const medley of medleys) {
    if (!medley || typeof medley.id !== 'string' || !medley.id || ids.has(medley.id) ||
        !songIds.includes(medley.anchorSongId) || anchors.has(medley.anchorSongId) ||
        !Number.isInteger(medley.revision) || medley.revision < 1 ||
        !Array.isArray(medley.steps) || medley.steps.length < 2 || medley.steps.length > 30) {
      throw new Error('Invalid medley structure');
    }
    ids.add(medley.id);
    anchors.add(medley.anchorSongId);
    if (medley.steps[0].songId !== medley.anchorSongId) throw new Error('Medley anchor differs from first excerpt');
    for (const songId of new Set(medley.steps.map(step => step.songId))) {
      if (groupedSongs.has(songId)) throw new Error('A song belongs to multiple medleys');
      groupedSongs.add(songId);
    }
    const stepIds = new Set<string>();
    for (const step of medley.steps) {
      const song = songs.get(step.songId);
      if (!song || song.organizationId !== organizationId || !songIds.includes(step.songId) ||
          typeof step.id !== 'string' || !step.id || stepIds.has(step.id) ||
          typeof step.title !== 'string' || step.title.length > 160 ||
          !Number.isInteger(step.repetitions) || step.repetitions < 1 || step.repetitions > 8 ||
          !Number.isInteger(step.startLine) || !Number.isInteger(step.endLine) ||
          typeof step.snapshot !== 'string' || typeof step.sourceRevision !== 'string' ||
          (step.sourceUrl !== undefined && (typeof step.sourceUrl !== 'string' || step.sourceUrl.length > 2000)) ||
          (step.sourceUrl !== undefined && !/^https?:\/\//i.test(step.sourceUrl)) ||
          (step.key !== undefined && (typeof step.key !== 'string' || step.key.length > 24)) ||
          (step.bpm !== undefined && (!Number.isInteger(step.bpm) || step.bpm < 20 || step.bpm > 320)) ||
          (step.label !== undefined && (typeof step.label !== 'string' || step.label.length > 100)) ||
          (step.transition !== undefined && (!['direct', 'hold', 'pause', 'free'].includes(step.transition.mode) ||
            (step.transition.cue !== undefined && (typeof step.transition.cue !== 'string' || step.transition.cue.length > 300))))) {
        throw new Error('Invalid medley excerpt');
      }
      stepIds.add(step.id);
      const currentSource = medleyChart(song);
      if (!currentSource.trim() && !song.chordsUrl && !song.tabs?.length) throw new Error('Medley source has no playable content');
      const currentMatches = medleySourceRevision(song) === step.sourceRevision &&
        step.endLine < splitMedleySource(currentSource).length &&
        selectMedleyLines(currentSource, step.startLine, step.endLine) === step.snapshot &&
        (step.sourceUrl || '') === (song.chordsUrl || '') &&
        JSON.stringify(step.tabs || []) === JSON.stringify(medleyTabsForSelection(song, step.startLine, step.endLine, step.label));
      const prior = previous.find(item => item.id === medley.id)?.steps.find(item => item.id === step.id);
      const previouslyApproved = prior && JSON.stringify(prior) === JSON.stringify(step);
      if (!currentMatches && !previouslyApproved) throw new Error('Medley source changed; review the excerpt again');
      totalBytes += new TextEncoder().encode(step.snapshot).length + new TextEncoder().encode(JSON.stringify(step.tabs || [])).length;
      if (totalBytes > 400_000) throw new Error('Medley exceeds the scale document limit');
    }
  }
}
