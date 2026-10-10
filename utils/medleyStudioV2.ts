import type { MedleyExcerpt, PopulatedSong, ScaleMedley } from '../types';
import { medleyChart, medleySourceRevision, medleyTabsForSelection, orderMedleySongIds } from './medleyModel';
import { selectMedleyLines, splitMedleySource } from './medleySource';
import { isValidKey, normalizeKey, resolveChordContentSourceKey } from './chordEngine';
import { medleyPerformanceText } from './medleyPerformanceText';

/**
 * UI-only draft contract. Publishing still uses the EXISTING ScaleMedley/MedleyExcerpt
 * server validator. No collection, roles, subscription or scale schema is changed.
 */
export interface StudioBlock {
  id: string;
  songId: string;
  startLine: number;
  endLine: number;
  label: string;
  repetitions: number;
  key: string;
  bpm: string;
  transition: 'direct' | 'hold' | 'pause' | 'free';
  cue: string;
}

export function newStudioBlock(song: PopulatedSong, id: string = crypto.randomUUID()): StudioBlock {
  const source = medleyChart(song);
  return {
    id, songId: song.id, startLine: 0,
    endLine: source.trim() ? splitMedleySource(source).length - 1 : 0,
    label: '', repetitions: 1, key: song.key || '',
    bpm: song.bpm ? String(song.bpm) : '', transition: 'direct', cue: '',
  };
}

export function studioBlocksFromLegacy(medley: ScaleMedley): StudioBlock[] {
  return medley.steps.map(step => ({
    id: step.id, songId: step.songId, startLine: step.startLine,
    endLine: step.endLine, label: step.label || '',
    repetitions: step.repetitions, key: step.key || '',
    bpm: step.bpm ? String(step.bpm) : '',
    transition: step.transition?.mode || 'direct',
    cue: step.transition?.cue || '',
  }));
}

export function moveStudioBlock(blocks: StudioBlock[], from: number, to: number): StudioBlock[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= blocks.length || to < 0 || to >= blocks.length) return blocks;
  const next = [...blocks];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

export function duplicateStudioBlock(blocks: StudioBlock[], index: number, id: string = crypto.randomUUID()): StudioBlock[] {
  if (!blocks[index]) return blocks;
  const next = [...blocks];
  next.splice(index + 1, 0, { ...blocks[index], id });
  return next;
}

/**
 * Split an already-selected source interval without changing original text.
 * Only the LAST child inherits the outgoing transition/cue.
 */
export function splitStudioBlock(blocks: StudioBlock[], index: number, splitAfter: number, id: string = crypto.randomUUID()): StudioBlock[] {
  const block = blocks[index];
  if (!block || !Number.isInteger(splitAfter) || splitAfter < block.startLine || splitAfter >= block.endLine ||
      blocks.length >= 30 || blocks.some(current => current.id === id)) return blocks;
  return [
    ...blocks.slice(0, index),
    { ...block, endLine: splitAfter, transition: 'direct', cue: '' },
    { ...block, id, startLine: splitAfter + 1 },
    ...blocks.slice(index + 1),
  ];
}

/** Always render from a source snippet; never modify the original song or stored chart. */
export function previewStudioBlock(block: StudioBlock, song: PopulatedSong): string {
  const chart = medleyChart(song);
  const snapshot = selectMedleyLines(chart, block.startLine, block.endLine);
  const verified = resolveChordContentSourceKey(song.metadata);
  return medleyPerformanceText({
    snapshot, key: block.key || undefined,
    sourceKey: verified?.canAutoConfirm ? verified.key : undefined,
    tabs: medleyTabsForSelection(song, block.startLine, block.endLine, block.label),
  } as MedleyExcerpt);
}

export function compileStudioMedley(
  blocks: StudioBlock[],
  songs: readonly PopulatedSong[],
  existing?: ScaleMedley,
  acknowledgeChangedSources = false,
): ScaleMedley {
  if (blocks.length < 2 || blocks.length > 30) throw new Error('medley.minimum');
  const songMap = new Map(songs.map(song => [song.id, song]));
  const previous = new Map(existing?.steps.map(step => [step.id, step]) || []);
  const stepIds = new Set<string>();
  const firstOrg = songs[0]?.organizationId;
  const excerpts: MedleyExcerpt[] = blocks.map(block => {
    const song = songMap.get(block.songId);
    if (!song || !firstOrg || song.organizationId !== firstOrg) throw new Error('medley.missingSong');
    if (!block.id || stepIds.has(block.id)) throw new Error('medley.invalid');
    stepIds.add(block.id);
    if (!Number.isInteger(block.repetitions) || block.repetitions < 1 || block.repetitions > 8) throw new Error('medley.invalid');
    const source = medleyChart(song);
    // A previously approved excerpt must be reviewed BEFORE validating ranges
    // against a changed chart (which may have fewer lines than the snapshot).
    const prior = previous.get(block.id);
    if (prior && medleySourceRevision(song) !== prior.sourceRevision && !acknowledgeChangedSources) throw new Error('medley.reviewRequired');
    if (!source.trim() && !song.chordsUrl && !song.tabs?.length) throw new Error('medley.requiresText');
    const lines = splitMedleySource(source);
    if (!Number.isInteger(block.startLine) || !Number.isInteger(block.endLine) ||
        block.startLine < 0 || block.endLine < block.startLine ||
        (source.trim() && block.endLine >= lines.length) ||
        (!source.trim() && (block.startLine !== 0 || block.endLine !== 0))) throw new Error('medley.invalidRange');
    if (block.label.length > 100 || block.cue.length > 300) throw new Error('medley.invalid');
    if (block.key.trim() && !isValidKey(block.key.trim())) throw new Error('medley.invalidKey');
    if (block.bpm.trim() && (!Number.isInteger(Number(block.bpm)) || Number(block.bpm) < 20 || Number(block.bpm) > 320)) throw new Error('medley.invalidBpm');
    const sourceKeyResolution = resolveChordContentSourceKey(song.metadata);
    const sourceKey = sourceKeyResolution?.canAutoConfirm ? sourceKeyResolution.key : undefined;
    if (block.key.trim() && sourceKey && normalizeKey(block.key.trim()) !== normalizeKey(sourceKey) &&
        (sourceKey.endsWith('m') !== block.key.trim().endsWith('m') ||
         medleyTabsForSelection(song, block.startLine, block.endLine, block.label).length)) throw new Error('medley.unsafeKeyChange');
    if (block.key.trim() && song.chords?.trim() && !sourceKey &&
        normalizeKey(block.key.trim()) !== normalizeKey(song.key || '')) throw new Error('medley.unverifiedSourceKey');
    if (block.key.trim() && sourceKey && normalizeKey(block.key.trim()) !== normalizeKey(sourceKey) && !song.chords?.trim()) throw new Error('medley.unverifiedSourceKey');
    const tabs = medleyTabsForSelection(song, block.startLine, block.endLine, block.label);
    const excerpt: MedleyExcerpt = {
      id: block.id, songId: song.id, sourceRevision: medleySourceRevision(song),
      startLine: block.startLine, endLine: block.endLine,
      title: song.title, repetitions: block.repetitions,
      snapshot: selectMedleyLines(source, block.startLine, block.endLine),
      ...(block.label.trim() ? { label: block.label.trim() } : {}),
      ...(block.key.trim() ? { key: block.key.trim() } : {}),
      ...(sourceKey && song.chords?.trim() ? { sourceKey } : {}),
      ...(song.chordsUrl ? { sourceUrl: song.chordsUrl } : {}),
      ...(block.bpm.trim() ? { bpm: Number(block.bpm) } : {}),
      ...(tabs.length ? { tabs } : {}),
      transition: { mode: block.transition, ...(block.cue.trim() ? { cue: block.cue.trim() } : {}) },
    };
    // The existing performer must be able to render exactly what will be approved.
    medleyPerformanceText(excerpt);
    return excerpt;
  });
  return {
    id: existing?.id || crypto.randomUUID(),
    anchorSongId: excerpts[0].songId,
    revision: (existing?.revision || 0) + 1,
    steps: excerpts,
  };
}

/** A studio addition must never discard pre-existing repertoire or band assignments. */
export function mergeStudioScaleSongIds(songIds: readonly string[], medleys: readonly ScaleMedley[]): string[] {
  const ids = [...songIds];
  for (const medley of medleys) for (const step of medley.steps) if (!ids.includes(step.songId)) ids.push(step.songId);
  return orderMedleySongIds(ids, [...medleys]);
}
