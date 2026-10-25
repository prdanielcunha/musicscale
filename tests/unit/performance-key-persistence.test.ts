import { describe, it, expect, vi, beforeEach } from 'vitest';
const state = vi.hoisted(() => ({ docs: new Map<string, any>(), writes: [] as any[], denied: false }));
vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: any, collection: string, id: string) => `${collection}/${id}`,
  serverTimestamp: () => 'server-time',
  FieldPath: class { constructor(...parts: string[]) { Object.assign(this, { parts }); } },
  runTransaction: async (_db: any, cb: any) => cb({
    get: async (ref: string) => ({ data: () => state.docs.get(ref) }),
    update: (...args: any[]) => { if (state.denied) throw new Error('permission-denied'); state.writes.push(args); },
  }),
}));
import { MusicRepository } from '../../services/MusicRepository';
const input = { songId: 's1', scaleId: 'scale1', targetKey: 'A', expectedKey: 'G', expectedChords: 'G D Em C', scope: 'scale' as const };
let repo: MusicRepository;
beforeEach(() => {
  state.docs.clear(); state.writes.length = 0; state.denied = false;
  state.docs.set('songs/s1', { organizationId: 'org1', key: 'G', selectedKey: 'G', chords: input.expectedChords });
  state.docs.set('scales/scale1', { organizationId: 'org1', songIds: ['s1'], songSettings: { s1: { bpm: 90 }, s2: { key: 'D' } } });
  repo = new MusicRepository('org1', { uid: 'u1' } as any);
});
describe('performance key transactions', () => {
  it('updates only the nested key, preserving BPM and other songs', async () => {
    await repo.savePerformanceSongKey(input);
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0]).toEqual(['scales/scale1', { parts: ['songSettings', 's1', 'key'] }, 'A', 'lastModifiedAt', 'server-time']);
    expect(state.docs.get('songs/s1').key).toBe('G');
  });
  it('updates repertoire chords/key together without overwriting scale settings', async () => {
    await repo.savePerformanceSongKey({ ...input, scope: 'repertoire' });
    expect(state.writes[0][0]).toBe('songs/s1');
    expect(state.writes[0][1]).toMatchObject({ selectedKey: 'A', key: 'A', chords: 'A E F#m D', metadata: { chordContentKey: 'A' } });
    expect(state.writes.some(w => w[0].startsWith('scales/'))).toBe(false);
  });
  it.each(['songs/s1', 'scales/scale1'])('rejects cross-tenant data in %s without writes', async path => {
    state.docs.get(path).organizationId = 'alien';
    await expect(repo.savePerformanceSongKey(input)).rejects.toThrow('CHORD_SCOPE_DENIED');
    expect(state.writes).toHaveLength(0);
  });
  it('rejects stale charts, stale scale keys and removed songs', async () => {
    state.docs.get('songs/s1').chords = 'C G Am F';
    await expect(repo.savePerformanceSongKey(input)).rejects.toThrow('CHORD_CONTENT_CHANGED');
    state.docs.get('songs/s1').chords = input.expectedChords;
    state.docs.get('scales/scale1').songSettings.s1.key = 'D';
    await expect(repo.savePerformanceSongKey(input)).rejects.toThrow('CHORD_CONTENT_CHANGED');
    state.docs.get('scales/scale1').songIds = [];
    await expect(repo.savePerformanceSongKey(input)).rejects.toThrow('CHORD_SCOPE_DENIED');
    expect(state.writes).toHaveLength(0);
  });
  it('propagates denied writes, never reports success', async () => {
    state.denied = true;
    await expect(repo.savePerformanceSongKey(input)).rejects.toThrow('permission-denied');
    expect(state.writes).toHaveLength(0);
  });
});
