import type { MedleyExcerpt, PopulatedSong, ScaleMedley } from '../types';
import { medleyChart, medleySourceRevision, medleyTabsForSelection, orderMedleySongIds } from './medleyModel';
import { selectMedleyLines, splitMedleySource } from './medleySource';
import { isValidKey, normalizeKey, resolveChordContentSourceKey } from './chordEngine';
import { medleyPerformanceText } from './medleyPerformanceText';
import type { MedleySegment } from './medleySegments';
import { suggestMedleySegments } from './medleySegments';

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
  /** Draft-only: an intentionally inserted extra passage stays outside automatic selection. */
  manualExtra?: boolean;
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

/** One musical card per contiguous song occurrence; keep every excerpt unchanged. */
export interface StudioSongGroup {
  songId: string;
  startIndex: number;
  blocks: StudioBlock[];
}
export function groupStudioSongs(blocks: readonly StudioBlock[]): StudioSongGroup[] {
  const groups: StudioSongGroup[] = [];
  blocks.forEach((block, index) => {
    const last = groups[groups.length - 1];
    if (last?.songId === block.songId) last.blocks.push(block);
    else groups.push({ songId: block.songId, startIndex: index, blocks: [block] });
  });
  return groups;
}

/**
 * Delete exactly one chronological appearance of a song (including all of its parts).
 * Other appearances of that same song, even earlier/later in the medley, are untouched.
 * A cue pointing to the removed appearance must not become a stale bridge to the next song.
 */
export function removeStudioSongOccurrence(blocks: readonly StudioBlock[], startIndex: number): StudioBlock[] {
  const group = groupStudioSongs(blocks).find(item => item.startIndex === startIndex);
  if (!group) return [...blocks];
  const next = [
    ...blocks.slice(0, startIndex),
    ...blocks.slice(startIndex + group.blocks.length),
  ];
  if (startIndex > 0 && next[startIndex - 1]) {
    next[startIndex - 1] = { ...next[startIndex - 1], transition: 'direct', cue: '' };
  }
  return next;
}

/** Count song appearances rather than individual sections or repeated chords. */
export function countStudioSongOccurrences(groups: readonly StudioSongGroup[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const group of groups) counts.set(group.songId, (counts.get(group.songId) || 0) + 1);
  return counts;
}

/**
 * Toggle one detected chart section inside exactly one chronological song occurrence.
 * Existing hand-added duplicates stay in position; other songs, keys and charts never change.
 * The first selection replaces a default full-chart block. Selected sections are inserted
 * in source order, while arbitrary manual duplicates remain untouched.
 */
export function toggleStudioSongSection(
  blocks: readonly StudioBlock[],
  groupStartIndex: number,
  segment: MedleySegment,
  song: PopulatedSong,
  newId: string = crypto.randomUUID(),
): StudioBlock[] {
  const group = groupStudioSongs(blocks).find(item => item.startIndex === groupStartIndex && item.songId === song.id);
  if (!group || !suggestMedleySegments(medleyChart(song)).some(part =>
    part.startLine === segment.startLine && part.endLine === segment.endLine)) return [...blocks];
  const rangeEnd = Math.max(0, splitMedleySource(medleyChart(song)).length - 1);
  const current = group.blocks;
  const selectedIndex = current.findIndex(block => !block.manualExtra &&
    block.startLine === segment.startLine && block.endLine === segment.endLine);
  const defaultWhole = current.length === 1 && !current[0].manualExtra &&
    current[0].startLine === 0 && current[0].endLine === rangeEnd && !current[0].label;
  const newRange = { startLine: segment.startLine, endLine: segment.endLine, label: segment.label || '' };
  let updated: StudioBlock[];
  if (selectedIndex >= 0) {
    // Never silently turn the final selected part into an empty medley entry.
    if (current.length === 1) {
      if (defaultWhole) return [...blocks];
      updated = [{ ...current[0], startLine: 0, endLine: rangeEnd, label: '' }];
    } else {
      updated = current.filter((_, index) => index !== selectedIndex);
    }
  } else if (defaultWhole) {
    updated = [{ ...current[0], ...newRange }];
  } else {
    if (blocks.length >= 30 || blocks.some(block => block.id === newId)) return [...blocks];
    const created = { ...newStudioBlock(song, newId), ...newRange };
    updated = [...current];
    const sortedIndex = updated.findIndex(block => !block.manualExtra && block.startLine > segment.startLine);
    const manualIndex = updated.findIndex(block => block.manualExtra);
    const insertion = sortedIndex >= 0 ? sortedIndex : manualIndex >= 0 ? manualIndex : updated.length;
    updated.splice(insertion, 0, created);
  }
  // A manually authored bridge belongs to the final passage of the song occurrence.
  const outgoing = current[current.length - 1];
  if (outgoing.cue || outgoing.transition !== 'direct') {
    updated = updated.map((block, index) => index === updated.length - 1
      ? { ...block, cue: outgoing.cue, transition: outgoing.transition }
      : { ...block, cue: '', transition: 'direct' });
  }
  return [...blocks.slice(0, groupStartIndex), ...updated, ...blocks.slice(groupStartIndex + current.length)];
}

export function moveStudioBlock(blocks: StudioBlock[], from: number, to: number): StudioBlock[] {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || from >= blocks.length || to < 0 || to >= blocks.length) return blocks;
  const next = [...blocks];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

export function duplicateStudioBlock(blocks: StudioBlock[], index: number, id: string = crypto.randomUUID()): StudioBlock[] {
  if (!blocks[index]) return blocks;
  // The outgoing bridge belongs after the LAST part of this song, not between
  // two occurrences of the same song.
  const next = [...blocks];
  next.splice(index, 1,
    { ...blocks[index], transition: 'direct', cue: '' },
    { ...blocks[index], id, manualExtra: true });
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
    { ...block, endLine: splitAfter, transition: 'direct', cue: '', manualExtra: true },
    { ...block, id, startLine: splitAfter + 1, manualExtra: true },
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
    if (!Number.isInteger(block.repetitions) || block.repetitions < 1 || block.repetitions > 16) throw new Error('medley.invalid');
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
  // Mirror the canonical server's 400 KB scale-document bound before attempting
  // an update. Fail locally instead of risking a rejected live scale save.
  const totalBytes = excerpts.reduce((sum, step) => sum +
    new TextEncoder().encode(step.snapshot).length +
    new TextEncoder().encode(JSON.stringify(step.tabs || [])).length, 0);
  if (totalBytes > 400_000) throw new Error('medleyStudioV2.tooLarge');
  return {
    id: existing?.id || crypto.randomUUID(),
    anchorSongId: excerpts[0].songId,
    revision: (existing?.revision || 0) + 1,
    steps: excerpts,
  };
}

export function buildStudioPerformancePreview(blocks: readonly StudioBlock[], songs: readonly PopulatedSong[], maxChars = 48_000): { text: string; truncated: boolean } {
  const source = new Map(songs.map(song => [song.id, song]));
  let text = '';
  const append = (chunk: string): boolean => {
    if (text.length + chunk.length > maxChars) return false;
    text += chunk;
    return true;
  };
  for (const [index, block] of blocks.entries()) {
    const song = source.get(block.songId);
    if (!song) throw new Error('medley.missingSong');
    if (!Number.isInteger(block.repetitions) || block.repetitions < 1 || block.repetitions > 16) throw new Error('medley.invalid');
    const snapshot = previewStudioBlock(block, song);
    const title = `\n${index + 1}. ${song.title}${block.label ? ' · ' + block.label : ''} · ${block.key || song.key || '—'}\n`;
    if (!append(title)) return { text, truncated: true };
    for (let round = 1; round <= block.repetitions; round++) {
      if (!append(`[${round}/${block.repetitions}]\n${snapshot}\n`)) return { text, truncated: true };
    }
    if (block.cue.trim() && !append(`→ ${block.cue.trim()}\n`)) return { text, truncated: true };
  }
  return { text: text.trim(), truncated: false };
}

/** A studio addition must never discard pre-existing repertoire or band assignments. */
export function mergeStudioScaleSongIds(songIds: readonly string[], medleys: readonly ScaleMedley[]): string[] {
  const ids = [...songIds];
  for (const medley of medleys) for (const step of medley.steps) if (!ids.includes(step.songId)) ids.push(step.songId);
  return orderMedleySongIds(ids, [...medleys]);
}
