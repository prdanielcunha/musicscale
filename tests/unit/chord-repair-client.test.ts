import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('../../services/nestAiBrowser', () => ({ nestAiProtectedHeaders: async () => ({ authorization: 'Bearer test-user', 'x-firebase-appcheck': 'test-appcheck', 'content-type': 'application/json' }) }));
import { requestChordRepair } from '../../services/chordRepairClient';
const input = { organizationId: 'org1', chords: 'C G Am F', instructions: 'Review key and capo' };
afterEach(() => vi.unstubAllGlobals());
describe('chord repair App Check regression', () => {
  it('sends both identity and App Check and returns only a valid draft', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ fixedChords: 'C G Am F' }) });
    vi.stubGlobal('fetch', fetcher);
    expect(await requestChordRepair(input)).toBe('C G Am F');
    expect(fetcher).toHaveBeenCalledWith('/api/fix-chords', expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer test-user', 'x-firebase-appcheck': 'test-appcheck' }), body: JSON.stringify(input) }));
  });
  it.each([[429, 'aiLimitError'], [401, 'aiAccessError'], [403, 'aiAccessError'], [503, 'aiFixError']])('handles HTTP %i', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
    await expect(requestChordRepair(input)).rejects.toThrow(code as string);
  });
  it.each([null, '', {}, { fixedChords: '' }])('rejects invalid responses without saving', async data => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    await expect(requestChordRepair(input)).rejects.toThrow();
  });
});
