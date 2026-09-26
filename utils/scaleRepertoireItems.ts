import type { PopulatedSong, ScaleMedley } from '../types';

export type ScaleRepertoireItem =
  | { kind: 'song'; id: string; song: PopulatedSong }
  | { kind: 'medley'; id: string; medley: ScaleMedley; title: string };

/** Canonical presentation derived from legacy songIds plus approved medleys. */
export function scaleRepertoireItems(songs: PopulatedSong[], medleys: ScaleMedley[] = []): ScaleRepertoireItem[] {
  const grouped = new Set(medleys.flatMap(medley => medley.steps.map(step => step.songId)));
  const result: ScaleRepertoireItem[] = [];
  for (const song of songs) {
    const medley = medleys.find(item => item.anchorSongId === song.id);
    if (medley) result.push({ kind: 'medley', id: medley.id, medley,
      title: `Medley · ${medley.steps.map(step => step.title).join(' → ')}` });
    else if (!grouped.has(song.id)) result.push({ kind: 'song', id: song.id, song });
  }
  return result;
}
