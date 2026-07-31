import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGlobalSongUpdate, GlobalSongUpdateDependencies } from '../../utils/globalSongUpdateController';

describe('executeGlobalSongUpdate', () => {
  let mockUpdateSong: any;
  let mockRefreshData: any;
  let mockExecuteSafeAction: any;
  let mockSetFormData: any;
  let mockShowSuccessToast: any;

  beforeEach(() => {
    mockUpdateSong = vi.fn().mockResolvedValue(undefined);
    mockRefreshData = vi.fn().mockResolvedValue(undefined);
    mockExecuteSafeAction = vi.fn().mockImplementation(async (action) => await action());
    mockSetFormData = vi.fn();
    mockShowSuccessToast = vi.fn();
  });

  const getDefaultDeps = (): GlobalSongUpdateDependencies => ({
    songId: 'song1',
    key: 'A',
    bpm: 120,
    updateSong: mockUpdateSong,
    refreshData: mockRefreshData,
    executeSafeAction: mockExecuteSafeAction,
    setFormData: mockSetFormData,
    showSuccessToast: mockShowSuccessToast,
    successMessage: 'Success',
  });

  it('executes global update correctly', async () => {
    const result = await executeGlobalSongUpdate(getDefaultDeps());

    expect(result).toEqual({ status: 'success' });
    
    // updateSong should be called with sanitized bpm
    expect(mockUpdateSong).toHaveBeenCalledWith('song1', {
      selectedKey: 'A',
      bpm: 120,
    });

    expect(mockRefreshData).toHaveBeenCalled();
    expect(mockShowSuccessToast).toHaveBeenCalledWith('Success');

    // Test the setFormData logic for clearing local state
    expect(mockSetFormData).toHaveBeenCalledTimes(1);
    const updater = mockSetFormData.mock.calls[0][0];
    
    const prevState = {
      songSettings: {
        song1: { key: 'G', bpm: 90 },
        song2: { key: 'C', bpm: 70 },
      }
    };
    
    const nextState = updater(prevState);
    expect(nextState.songSettings).toBeDefined();
    expect(nextState.songSettings.song1).toBeUndefined(); // Local state cleared
    expect(nextState.songSettings.song2).toBeDefined();   // Others kept intact
  });

  it('sanitizes bpm on global update', async () => {
    const deps = getDefaultDeps();
    deps.bpm = 10; // below 20
    await executeGlobalSongUpdate(deps);

    expect(mockUpdateSong).toHaveBeenCalledWith('song1', {
      selectedKey: 'A',
      bpm: null, // sanitized
    });
  });

  it('handles deduplication gracefully (preventDoubleExecution)', async () => {
    // Mock executeSafeAction returning undefined (deduplicated)
    mockExecuteSafeAction.mockResolvedValueOnce(undefined);
    
    const result = await executeGlobalSongUpdate(getDefaultDeps());

    expect(result).toEqual({ status: 'deduplicated' });
    
    // The action body is NOT executed, meaning updateSong is not called
    expect(mockUpdateSong).not.toHaveBeenCalled();
  });
});
