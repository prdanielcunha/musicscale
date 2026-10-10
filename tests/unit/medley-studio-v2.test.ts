import { describe, expect, it } from 'vitest';
import type { PopulatedSong, ScaleMedley } from '../../types';
import { compileStudioMedley, duplicateStudioBlock, moveStudioBlock, newStudioBlock, studioBlocksFromLegacy } from '../../utils/medleyStudioV2';
import { analyzeMedleyBridge, detectedHarmonyEvents } from '../../utils/medleyStudioHarmony';

const song = (id: string, chart: string, org = 'org-a'): PopulatedSong => ({
  id, organizationId: org, title: id, artist: '', key: 'Am', status: 'active', tagIds: [],
  chords: chart, lyrics: '', tabs: [], chordsUrl: '', videoUrl: '', createdAt: '', lastPlayed: null,
  createdBy: { uid: 'leader' } as PopulatedSong['createdBy'], tags: [],
});
const a = song('a', '[Intro]\nAm    F\nverso\n[Refrão]\nC     G');
const b = song('b', 'Dm    G\nletra');

describe('isolated Medley Studio 2.0 legacy adapter', () => {
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

  it('does not allow repeat counts beyond the existing production contract', () => {
    const invalid = { ...newStudioBlock(a), repetitions: 16 };
    expect(() => compileStudioMedley([invalid, newStudioBlock(b)], [a, b])).toThrow('medley.invalid');
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
