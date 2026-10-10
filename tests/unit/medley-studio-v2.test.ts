import { describe, expect, it } from 'vitest';
import type { PopulatedSong, ScaleMedley } from '../../types';
import { buildStudioPerformancePreview, compileStudioMedley, duplicateStudioBlock, moveStudioBlock, splitStudioBlock, newStudioBlock, studioBlocksFromLegacy, mergeStudioScaleSongIds } from '../../utils/medleyStudioV2';
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
