import { describe, expect, it } from 'vitest';
import type { PopulatedSong, ScaleMedley } from '../../types';
import { buildStudioPerformancePreview, compileStudioMedley, countStudioSongOccurrences, duplicateStudioBlock, groupStudioSongs, moveStudioBlock, removeStudioSongOccurrence, splitStudioBlock, toggleStudioSongSection, newStudioBlock, newStudioSongBlocks, studioBlocksFromLegacy, mergeStudioScaleSongIds } from '../../utils/medleyStudioV2';
import { suggestMedleySegments } from '../../utils/medleySegments';
import { analyzeMedleyBridge, detectedHarmonyEvents } from '../../utils/medleyStudioHarmony';
import { loadStudioDraft, saveStudioDraft, studioDraftKey } from '../../utils/medleyStudioDraft';

const song = (id: string, chart: string, org = 'org-a'): PopulatedSong => ({
  id, organizationId: org, title: id, artist: '', key: 'Am', status: 'active', tagIds: [],
  chords: chart, lyrics: '', tabs: [], chordsUrl: '', videoUrl: '', createdAt: '', lastPlayed: null,
  createdBy: { uid: 'leader' } as PopulatedSong['createdBy'], tags: [],
});
const a = song('a', '[Intro]\nAm    F\nverso\n[Refrão]\nC     G');
const b = song('b', 'Dm    G\nletra');

describe('isolated Medley Studio 2.0 legacy adapter', () => {
  it('previews every repeated chart exactly in stage order and bounds huge previews', () => {
    const first = { ...newStudioBlock(a, 'first'), repetitions: 2, cue: 'Entrada suave' };
    const second = newStudioBlock(b, 'second');
    const output = buildStudioPerformancePreview([first, second], [a, b]);
    expect(output.truncated).toBe(false);
    expect(output.text).toContain('[1/2]\n[Intro]\nAm    F');
    expect(output.text).toContain('[2/2]\n[Intro]\nAm    F');
    expect(output.text.indexOf('→ Entrada suave')).toBeLessThan(output.text.indexOf('2. b'));
    expect(buildStudioPerformancePreview([first, second], [a, b], 20).truncated).toBe(true);
  });

  it('creates one independently editable block per initially selected section without touching the source', () => {
    const chart = '[Intro]\nC G\n[Primeira Parte]\nAm F\n[Refrão]\nF G\n[Segunda Parte]\nDm G\n[Refrão]\nC G';
    const track = song('Ao Único', chart);
    let n = 0;
    const blocks = newStudioSongBlocks(track, 30, () => 'part-' + ++n);
    expect(blocks).toHaveLength(5);
    expect(blocks.map(block => block.label)).toEqual(['Intro','Primeira Parte','Refrão','Segunda Parte','Refrão']);
    expect(new Set(blocks.map(block => block.id)).size).toBe(5);
    expect(blocks.map(block => block.startLine)).toEqual([0,2,4,6,8]);
    expect(blocks.map(block => block.endLine)).toEqual([1,3,5,7,9]);
    const compiled = compileStudioMedley(blocks, [track]);
    expect(compiled.steps.map(block => block.snapshot).join('\n')).toBe(chart);
    expect(track.chords).toBe(chart);
    expect(blocks.every(block => block.repetitions === 1 && block.cue === '' && block.key === 'Am')).toBe(true);
  });

  it('keeps unmarked charts and the existing 30-part ceiling safe without losing any lines', () => {
    let id = 0;
    const unmarked = newStudioSongBlocks(b, 30, () => 'p-' + ++id);
    expect(unmarked).toHaveLength(1);
    expect(unmarked[0].label).toBe('');
    const limited = newStudioSongBlocks(a, 1, () => 'p-' + ++id);
    expect(limited).toHaveLength(1);
    expect(limited[0]).toMatchObject({ startLine: 0, endLine: 4, label: '' });
    expect(newStudioSongBlocks(a, 0)).toEqual([]);
    expect(a.chords).toBe('[Intro]\nAm    F\nverso\n[Refrão]\nC     G');
  });

  it('groups contiguous excerpts in a single song card without losing source ordering', () => {
    const a1 = newStudioBlock(a, 'a1');
    const a2 = { ...newStudioBlock(a, 'a2'), label: 'Refrão' };
    const b1 = newStudioBlock(b, 'b1');
    expect(groupStudioSongs([a1, a2, b1]).map(group => [group.songId, group.blocks.length, group.startIndex]))
      .toEqual([['a', 2, 0], ['b', 1, 2]]);
    expect(groupStudioSongs([a1, b1, a2]).map(group => group.songId)).toEqual(['a', 'b', 'a']);
    const saved = compileStudioMedley([a1, a2, b1], [a, b]);
    expect(saved.steps.map(step => step.songId)).toEqual(['a', 'a', 'b']);
  });

  it('automatically assembles selected song parts in original chart order without changing the original chart', () => {
    const sections = suggestMedleySegments(a.chords);
    const intro = sections.find(section => section.label === 'Intro')!;
    const refrain = sections.find(section => section.label === 'Refrão')!;
    const whole = newStudioBlock(a, 'whole');
    const baseline = [whole, newStudioBlock(b, 'b')];
    const selectedRefrain = toggleStudioSongSection(baseline, 0, refrain, a, 'unused');
    expect(selectedRefrain[0]).toMatchObject({ id: 'whole', label: 'Refrão', startLine: 3, endLine: 4 });
    const both = toggleStudioSongSection(selectedRefrain, 0, intro, a, 'intro');
    expect(both.map(item => [item.id, item.songId, item.label])).toEqual([
      ['intro', 'a', 'Intro'], ['whole', 'a', 'Refrão'], ['b', 'b', ''],
    ]);
    const withRepeat = both.map(block => block.id === 'whole' ? { ...block, repetitions: 3 } : block);
    const stored = compileStudioMedley(withRepeat, [a,b]);
    expect(stored.steps.map(item => item.repetitions)).toEqual([1,3,1]);
    expect(stored.steps[0].snapshot).toBe('[Intro]\\nAm    F'.replaceAll('\\n', '\n'));
    expect(a.chords).toBe('[Intro]\\nAm    F\\nverso\\n[Refrão]\\nC     G'.replaceAll('\\n', '\n'));
    const removedIntro = toggleStudioSongSection(withRepeat, 0, intro, a);
    expect(removedIntro.map(block => block.id)).toEqual(['whole','b']);
    expect(removedIntro[0].repetitions).toBe(3);
  });

  it('edits one A occurrence only, preserving a duplicated manual extra, bridge and A-B-A', () => {
    const [intro, refrain] = suggestMedleySegments(a.chords);
    const first = { ...newStudioBlock(a, 'first'), cue: 'C → Dm', transition: 'free' as const };
    const second = newStudioBlock(a, 'return');
    const original = [first, newStudioBlock(b, 'between'), second];
    let arranged = toggleStudioSongSection(original, 0, intro, a);
    arranged = duplicateStudioBlock(arranged, 0, 'manual-copy');
    expect(arranged[1].manualExtra).toBe(true);
    arranged = toggleStudioSongSection(arranged, 0, refrain, a, 'refrain');
    expect(arranged.map(item => item.id)).toEqual(['first', 'refrain', 'manual-copy', 'between','return']);
    expect(arranged[2].cue).toBe('C → Dm');
    expect(arranged[2].transition).toBe('free');
    expect(arranged[4]).toEqual(second);
    const unchanged = toggleStudioSongSection(arranged, 3, { ...intro, startLine: 200 }, a);
    expect(unchanged).toEqual(arranged);
  });

  it('restores manually repeated passages from a saved medley without changing its persisted schema', () => {
    const selected = toggleStudioSongSection([newStudioBlock(a, 'original'), newStudioBlock(b, 'second')], 0, suggestMedleySegments(a.chords)[0], a);
    const duplicated = duplicateStudioBlock(selected, 0, 'extra');
    const legacy = compileStudioMedley(duplicated, [a, b]);
    const reopened = studioBlocksFromLegacy(legacy);
    expect(reopened.map(item => item.id)).toEqual(['original','extra','second']);
    expect(reopened[1].manualExtra).toBe(true);
    const updated = toggleStudioSongSection(reopened, 0, suggestMedleySegments(a.chords)[1], a, 'refrain');
    expect(updated.map(item => item.id)).toEqual(['original','refrain','extra','second']);
    expect(updated[2].manualExtra).toBe(true);
  });

  it('counts A-B-A as two chronological appearances of A, not repeated inner sections', () => {
    const blocks = [
      newStudioBlock(a, 'a-intro'),
      { ...newStudioBlock(a, 'a-refrain'), label: 'Refrão' },
      newStudioBlock(b, 'b'),
      newStudioBlock(a, 'a-return'),
    ];
    const groups = groupStudioSongs(blocks);
    expect(groups.map(group => [group.songId, group.startIndex, group.blocks.length]))
      .toEqual([['a', 0, 2], ['b', 2, 1], ['a', 3, 1]]);
    expect([...countStudioSongOccurrences(groups)]).toEqual([['a', 2], ['b', 1]]);
    expect(compileStudioMedley(blocks, [a,b]).steps.map(step => step.songId)).toEqual(['a','a','b','a']);
  });

  it('removes only a selected appearance and all its parts while preserving original order and other A entries', () => {
    const blocks = [
      { ...newStudioBlock(a, 'a1'), label: 'Intro' },
      { ...newStudioBlock(a, 'a2'), label: 'Refrão', cue: 'F → Gm', transition: 'free' as const },
      { ...newStudioBlock(b, 'b1'), cue: 'Dm → Am', transition: 'free' as const },
      { ...newStudioBlock(a, 'a3'), label: 'Final' },
    ];
    const removeFirst = removeStudioSongOccurrence(blocks, 0);
    expect(removeFirst.map(block => block.id)).toEqual(['b1','a3']);
    expect(removeFirst[0].cue).toBe('Dm → Am');
    const removeLast = removeStudioSongOccurrence(blocks, 3);
    expect(removeLast.map(block => block.id)).toEqual(['a1','a2','b1']);
    expect(removeLast[2].cue).toBe('');
    expect(removeLast[2].transition).toBe('direct');
    const removeMiddle = removeStudioSongOccurrence(blocks, 2);
    expect(removeMiddle.map(block => block.id)).toEqual(['a1','a2','a3']);
    expect(removeMiddle[1].cue).toBe('');
    expect(groupStudioSongs(removeMiddle)).toHaveLength(1);
    expect(blocks.map(block => block.id)).toEqual(['a1','a2','b1','a3']);
    expect(blocks[1].cue).toBe('F → Gm');
    expect(removeStudioSongOccurrence(blocks, 99)).toEqual(blocks);
  });

  it('moves a hand-authored outgoing bridge onto the last duplicated part of a song', () => {
    const original = { ...newStudioBlock(a, 'one'), transition: 'free' as const, cue: 'F → C' };
    const next = newStudioBlock(b, 'two');
    const blocks = duplicateStudioBlock([original, next], 0, 'copy');
    expect(blocks.map(block => block.songId)).toEqual(['a', 'a', 'b']);
    expect(blocks[0].cue).toBe('');
    expect(blocks[0].transition).toBe('direct');
    expect(blocks[1].cue).toBe('F → C');
    expect(blocks[1].transition).toBe('free');
    expect(compileStudioMedley(blocks, [a, b]).steps[1].transition?.cue).toBe('F → C');
    expect(original.cue).toBe('F → C');
  });
  it('splits exact line intervals and keeps the approved outgoing bridge on the final part only', () => {
    const original = { ...newStudioBlock(a, 'first'), startLine: 0, endLine: 4, cue: 'C → F', transition: 'free' as const };
    const pieces = splitStudioBlock([original, newStudioBlock(b, 'second')], 0, 2, 'half');
    expect(pieces.map(piece => [piece.id, piece.startLine, piece.endLine])).toEqual([['first', 0, 2], ['half', 3, 4], ['second', 0, 1]]);
    expect(pieces[0].cue).toBe('');
    expect(pieces[0].transition).toBe('direct');
    expect(pieces[1].cue).toBe('C → F');
    expect(original.endLine).toBe(4);
    expect(splitStudioBlock(pieces, 2, 9)).toBe(pieces);
    const result = compileStudioMedley(pieces, [a, b]);
    expect(result.steps[0].snapshot + '\n' + result.steps[1].snapshot).toBe(a.chords);
  });

  it('allows repeated out-of-order blocks without mutating a song, its spaces or the original array', () => {
    const first = { ...newStudioBlock(a, 'one'), startLine: 1, endLine: 2 };
    const second = newStudioBlock(b, 'two');
    const blocks = duplicateStudioBlock([first, second], 0, 'three');
    const moved = moveStudioBlock(blocks, 2, 1);
    const originalChart = a.chords;
    const medley = compileStudioMedley(moved, [a, b]);
    expect(medley.steps.map(step => step.id)).toEqual(['one', 'two', 'three']);
    expect(medley.steps.map(step => step.songId)).toEqual(['a', 'b', 'a']);
    expect(medley.steps[0].snapshot).toBe('Am    F\nverso');
    expect(medley.steps[2].snapshot).toBe(medley.steps[0].snapshot);
    expect(a.chords).toBe(originalChart);
    expect(blocks[1].id).toBe('three');
    expect(moved[1].id).toBe('two');
    expect(studioBlocksFromLegacy(medley)).toHaveLength(3);
  });

  it('preserves stable instance IDs and explicit version increment when editing', () => {
    const old = compileStudioMedley([newStudioBlock(a, 'one'), newStudioBlock(b, 'two')], [a, b]);
    const result = compileStudioMedley(studioBlocksFromLegacy(old), [a, b], old);
    expect(result.id).toBe(old.id);
    expect(result.revision).toBe(old.revision + 1);
    expect(result.steps[0].snapshot).toBe(old.steps[0].snapshot);
  });

  it('rejects cross-tenant references and malformed ranges without backend writes', () => {
    expect(() => compileStudioMedley([newStudioBlock(a), newStudioBlock(song('x', 'C G', 'org-b'))], [a, song('x', 'C G', 'org-b')])).toThrow('medley.missingSong');
    const broken = { ...newStudioBlock(a), startLine: -1 };
    expect(() => compileStudioMedley([broken, newStudioBlock(b)], [a, b])).toThrow('medley.invalidRange');
  });

  it('does not silently update a previously approved chart when the source changes', () => {
    const old: ScaleMedley = compileStudioMedley([newStudioBlock(a, 'one'), newStudioBlock(b, 'two')], [a, b]);
    const edited = { ...a, chords: 'Am    E\nverso' };
    expect(() => compileStudioMedley(studioBlocksFromLegacy(old), [edited, b], old)).toThrow('medley.reviewRequired');
  });

  it('adds repertoire songs from the full catalog without dropping the scale originals', () => {
    const staged = compileStudioMedley([newStudioBlock(a,'one'), newStudioBlock(b,'two')], [a,b]);
    expect(mergeStudioScaleSongIds(['unrelated', 'a'], [staged])).toEqual(['unrelated', 'a', 'b']);
    expect(mergeStudioScaleSongIds(['a', 'b'], [staged])).toEqual(['a','b']);
  });

  it('rejects oversized source snapshots before any live scale write', () => {
    const first = song('long-1', 'G '.repeat(101_000));
    const second = song('long-2', 'C '.repeat(101_000));
    expect(() => compileStudioMedley([newStudioBlock(first, 'first'), newStudioBlock(second, 'second')], [first, second])).toThrow('medleyStudioV2.tooLarge');
  });

  it('accepts 16 repeated passages but rejects 17 before hitting the server', () => {
    const valid = { ...newStudioBlock(a), repetitions: 16 };
    expect(compileStudioMedley([valid, newStudioBlock(b)], [a, b]).steps[0].repetitions).toBe(16);
    const invalid = { ...valid, repetitions: 17 };
    expect(() => compileStudioMedley([invalid, newStudioBlock(b)], [a, b])).toThrow('medley.invalid');
  });
});

describe('session draft isolation', () => {
  it('restores a bounded draft without embedding the original chart', () => {
    const items = new Map<string,string>();
    const store = { getItem: (key: string) => items.get(key) || null, setItem: (key: string, value: string) => { items.set(key, value); }, removeItem: (key: string) => { items.delete(key); } };
    const identity = { userId: 'editor', organizationId: 'org-a', scope: 'scale:new' };
    const block = newStudioBlock(a, 'a1');
    expect(saveStudioDraft(identity, [block], store, 1000)).toBe(true);
    expect(loadStudioDraft(identity, new Set(['a']), store, 2000)).toEqual([block]);
    expect(store.getItem(studioDraftKey(identity))).not.toContain(a.chords);
    expect(loadStudioDraft({ ...identity, organizationId: 'org-b' }, new Set(['a']), store, 2000)).toBeNull();
    expect(loadStudioDraft(identity, new Set(['b']), store, 2000)).toBeNull();
    expect(loadStudioDraft(identity, new Set(['a']), store, 12 * 60 * 60 * 1000 + 2000)).toBeNull();
  });
});

describe('deterministic advisory bridge', () => {
  it('extracts actual chord lines, not arbitrary letters from lyrics', () => {
    expect(detectedHarmonyEvents('[Intro]\nC  G/B   Am7\nCanção A\nDm7 G7')).toEqual(['C', 'G/B', 'Am7', 'Dm7', 'G7']);
  });
  it('uses the actual last/first chords; suggestions do not overwrite the originals', () => {
    const a1 = 'Am F\nC G7'; const b1 = 'Dm Gm\ntexto';
    const result = analyzeMedleyBridge(a1, b1);
    expect(result.exitChord).toBe('G7');
    expect(result.entryChord).toBe('Dm');
    expect(result.candidates[0].chords).toEqual(['G7', 'Dm']);
    expect(result.candidates).toHaveLength(3);
    expect(a1).toBe('Am F\nC G7');
  });
  it('fails gracefully when source has no detectable chords', () => {
    expect(analyzeMedleyBridge('Senhor, tu és bom', 'C G').candidates).toEqual([]);
  });
});
