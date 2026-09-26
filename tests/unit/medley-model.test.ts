import { describe, expect, it } from 'vitest';
import type { ScaleMedley, Song } from '../../types';
import { medleyChart, medleySourceRevision, orderMedleySongIds, validateMedleys } from '../../utils/medleyModel';

const song = (id: string, organizationId = 'org-a') => ({ id, organizationId, chords: '[Intro]\nAm     F\nLetra', lyrics: '', tabs: [{ section: 'Solo', content: 'E|--0--|' }] }) as Song;
const a = song('a');
const b = song('b');
const step = (source: Song, id: string) => ({
  id, songId: source.id, sourceRevision: medleySourceRevision(source), startLine: 0, endLine: 2,
  title: source.id, repetitions: 1, snapshot: medleyChart(source), tabs: source.tabs,
});
const medley: ScaleMedley = { id: 'm1', anchorSongId: 'a', revision: 1, steps: [step(a, '1'), step(b, '2'), step(a, '3')] };

describe('medley approval', () => {
  it('allows A → B → A with distinct instance IDs and intact tablature', () => {
    expect(() => validateMedleys([medley], ['a', 'b'], new Map([['a', a], ['b', b]]), 'org-a')).not.toThrow();
    expect(orderMedleySongIds(['a', 'unrelated', 'b'], [medley])).toEqual(['a', 'b', 'unrelated']);
  });

  it('rejects songs from another organization even when referenced by the setlist', () => {
    expect(() => validateMedleys([medley], ['a', 'b'], new Map([['a', a], ['b', song('b', 'org-b')]]), 'org-a')).toThrow();
  });

  it('holds the approved snapshot when the library song changes, but rejects a silent replacement', () => {
    const edited = { ...a, chords: '[Intro]\nG     F\nLetra' };
    const map = new Map([['a', edited], ['b', b]]);
    expect(() => validateMedleys([medley], ['a', 'b'], map, 'org-a', [medley])).not.toThrow();
    const replaced = structuredClone(medley);
    replaced.steps[0].snapshot = edited.chords;
    expect(() => validateMedleys([replaced], ['a', 'b'], map, 'org-a', [medley])).toThrow();
  });

  it('rejects a forged source key and an unsafe major/minor or tablature transposition', () => {
    const verified = { ...a, metadata: { chordContentKey: 'Am' }, key: 'Am' };
    const map = new Map([['a', verified], ['b', b]]);
    const draft = structuredClone(medley);
    draft.steps[0] = { ...draft.steps[0], sourceKey: 'Gm', key: 'Bm' };
    expect(() => validateMedleys([draft], ['a', 'b'], map, 'org-a')).toThrow('verified source');
    draft.steps[0] = { ...draft.steps[0], sourceKey: 'Am', key: 'A' };
    expect(() => validateMedleys([draft], ['a', 'b'], map, 'org-a')).toThrow('Unsafe medley transposition');
    draft.steps[0] = { ...draft.steps[0], sourceKey: 'Am', key: 'Bm' };
    expect(() => validateMedleys([draft], ['a', 'b'], map, 'org-a')).toThrow('Unsafe medley transposition');
  });
});
