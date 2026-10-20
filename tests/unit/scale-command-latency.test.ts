import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  save: vi.fn(), publish: vi.fn(), getBand: vi.fn(), getScale: vi.fn(),
  listBands: vi.fn(), createBand: vi.fn(),
}));
vi.mock('../../services/MusicRepository', () => ({
  MusicRepository: class {
    musicScaleCommands = { save: mocks.save, publish: mocks.publish };
    bandScales = { getById: mocks.getBand, list: mocks.listBands, create: mocks.createBand };
    scales = { getById: mocks.getScale };
  },
}));
import { ReuseAwareMusicRepository } from '../../services/ReuseAwareMusicRepository';

describe('scale command latency and canonical authority', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(['save', 'publish'] as const)('%s does not wait for a browser Firestore preflight', async command => {
    // A stalled Firestore connection must not delay the authenticated HTTP command.
    mocks.getBand.mockImplementation(() => new Promise(() => {}));
    const result = { musicScaleId: 'scale-1', version: 2 };
    mocks[command].mockResolvedValue(result);
    const repository = new ReuseAwareMusicRepository('org-1');
    const payload = { scalePatch: { bandScaleId: 'band-1', observations: 'updated' } };
    await expect(repository.musicScaleCommands[command]('scale-1', payload, 'request-1')).resolves.toEqual(result);
    expect(mocks[command]).toHaveBeenCalledExactlyOnceWith('scale-1', payload, 'request-1');
    expect(mocks.getBand).not.toHaveBeenCalled();
  });

  it.each(['save', 'publish'] as const)('%s preserves reuse recovery after a canonical link conflict', async command => {
    mocks[command].mockRejectedValueOnce({ code: 'BAND_SCALE_ALREADY_LINKED' }).mockResolvedValueOnce({ version: 3 });
    mocks.getBand.mockResolvedValue({ id: 'band-source', musicScaleId: 'other-scale', date: '2026-10-20', assignments: [{ userId: 'member', instrumentId: 'guitar' }] });
    mocks.getScale.mockResolvedValue({ date: '2026-10-21' });
    mocks.listBands.mockResolvedValue([]);
    mocks.createBand.mockResolvedValue('band-instance');
    const repository = new ReuseAwareMusicRepository('org-1');
    const payload = { scalePatch: { bandScaleId: 'band-source' } };
    await expect(repository.musicScaleCommands[command]('scale-1', payload, 'request-1')).resolves.toEqual({ version: 3 });
    expect(mocks[command]).toHaveBeenNthCalledWith(2, 'scale-1', { scalePatch: { bandScaleId: 'band-instance' } }, 'request-1');
    expect(mocks.createBand).toHaveBeenCalledTimes(1);
  });

  it.each(['save', 'publish'] as const)('%s never retries or materializes a band after an access denial', async command => {
    const denied = { code: 'TENANT_SCOPE_MISMATCH', status: 403 };
    mocks[command].mockRejectedValue(denied);
    const repository = new ReuseAwareMusicRepository('org-1');
    await expect(repository.musicScaleCommands[command]('scale-1', { bandScaleId: 'foreign-band' }, 'request-1')).rejects.toBe(denied);
    expect(mocks[command]).toHaveBeenCalledTimes(1);
    expect(mocks.getBand).not.toHaveBeenCalled();
    expect(mocks.createBand).not.toHaveBeenCalled();
  });
});
