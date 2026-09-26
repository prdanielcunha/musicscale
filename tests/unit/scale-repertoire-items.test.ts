import { describe, expect, it } from 'vitest';
import { scaleRepertoireItems } from '../../utils/scaleRepertoireItems';
import type { PopulatedSong, ScaleMedley } from '../../types';

describe('scale repertoire projection', () => {
  it('shows A → B → A as a single scheduled item and retains standalone songs', () => {
    const songs = ['a', 'b', 'c'].map(id => ({ id, title: id })) as PopulatedSong[];
    const medley = { id: 'm', anchorSongId: 'a', revision: 1, steps: [
      { id: '1', songId: 'a', title: 'A' }, { id: '2', songId: 'b', title: 'B' }, { id: '3', songId: 'a', title: 'A' },
    ] } as ScaleMedley;
    expect(scaleRepertoireItems(songs, [medley]).map(item => item.kind === 'medley' ? item.title : item.song.title)).toEqual(['Medley · A → B → A', 'c']);
    expect(scaleRepertoireItems(songs).map(item => item.id)).toEqual(['a', 'b', 'c']);
  });
});
