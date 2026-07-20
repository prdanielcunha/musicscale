import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGlobalSongUpdate, GlobalSongUpdateDependencies } from '../../utils/globalSongUpdateController';

describe('global-song-update-controller unit tests', () => {
  let mockUpdateSong: any;
  let mockRefreshData: any;
  let mockExecuteSafeAction: any;
  let mockSetFormData: any;
  let mockShowSuccessToast: any;

  beforeEach(() => {
    mockUpdateSong = vi.fn().mockResolvedValue(undefined);
    mockRefreshData = vi.fn().mockResolvedValue(undefined);
    mockExecuteSafeAction = vi.fn().mockImplementation(async (action) => {
      return await action();
    });
    mockSetFormData = vi.fn();
    mockShowSuccessToast = vi.fn();
  });

  const getDeps = (overrides = {}): GlobalSongUpdateDependencies => ({
    songId: 'song-123',
    key: 'A',
    bpm: 120,
    updateSong: mockUpdateSong,
    refreshData: mockRefreshData,
    executeSafeAction: mockExecuteSafeAction,
    setFormData: mockSetFormData,
    showSuccessToast: mockShowSuccessToast,
    successMessage: 'Global update saved!',
    ...overrides,
  });

  it('runs complete transaction on success exactly once', async () => {
    const deps = getDeps();
    const result = await executeGlobalSongUpdate(deps);

    expect(result).toEqual({ status: 'success' });
    expect(mockUpdateSong).toHaveBeenCalledTimes(1);
    expect(mockUpdateSong).toHaveBeenCalledWith('song-123', { selectedKey: 'A', bpm: 120 });
    expect(mockRefreshData).toHaveBeenCalledTimes(1);
    expect(mockSetFormData).toHaveBeenCalledTimes(1);
    expect(mockShowSuccessToast).toHaveBeenCalledTimes(1);
    expect(mockShowSuccessToast).toHaveBeenCalledWith('Global update saved!');
  });

  it('returns deduplicated when executeSafeAction returns undefined', async () => {
    mockExecuteSafeAction.mockResolvedValue(undefined);
    const deps = getDeps();
    const result = await executeGlobalSongUpdate(deps);

    expect(result).toEqual({ status: 'deduplicated' });
    expect(mockUpdateSong).not.toHaveBeenCalled();
    expect(mockRefreshData).not.toHaveBeenCalled();
    expect(mockSetFormData).not.not.toHaveBeenCalled();
    expect(mockShowSuccessToast).not.toHaveBeenCalled();
  });

  it('preserves override state and does not call success flow if updateSong fails', async () => {
    const testError = new Error('Database failure');
    mockUpdateSong.mockRejectedValue(testError);

    const deps = getDeps();
    await expect(executeGlobalSongUpdate(deps)).rejects.toThrow('Database failure');

    expect(mockRefreshData).not.toHaveBeenCalled();
    expect(mockSetFormData).not.toHaveBeenCalled();
    expect(mockShowSuccessToast).not.toHaveBeenCalled();
  });

  it('preserves override state and does not clean up local state if refreshData fails', async () => {
    const testError = new Error('Refresh failed');
    mockRefreshData.mockRejectedValue(testError);

    const deps = getDeps();
    await expect(executeGlobalSongUpdate(deps)).rejects.toThrow('Refresh failed');

    expect(mockUpdateSong).toHaveBeenCalledTimes(1);
    expect(mockSetFormData).not.toHaveBeenCalled();
    expect(mockShowSuccessToast).not.toHaveBeenCalled();
  });
});
