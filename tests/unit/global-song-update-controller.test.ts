import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeGlobalSongUpdate, GlobalSongUpdateDependencies } from '../../utils/globalSongUpdateController';

describe('global-song-update-controller unit tests', () => {
  let mockUpdateSong: any;
  let mockRefreshData: any;
  let mockExecuteSafeAction: any;
  let mockSetFormData: any;
  let mockShowSuccessToast: any;
  let executionOrder: string[];
  let activeLocks: Set<string>;

  beforeEach(() => {
    executionOrder = [];
    activeLocks = new Set<string>();

    mockUpdateSong = vi.fn().mockImplementation(async () => {
      executionOrder.push('update');
    });
    mockRefreshData = vi.fn().mockImplementation(async () => {
      executionOrder.push('refresh');
    });

    // Deterministic fake executeSafeAction that maintains lock state
    mockExecuteSafeAction = vi.fn().mockImplementation(async (action, options) => {
      if (options.preventDoubleExecution && activeLocks.has(options.key)) {
        return undefined;
      }
      activeLocks.add(options.key);
      try {
        return await action();
      } finally {
        activeLocks.delete(options.key);
      }
    });

    mockSetFormData = vi.fn().mockImplementation(() => {
      executionOrder.push('setFormData');
    });
    mockShowSuccessToast = vi.fn().mockImplementation(() => {
      executionOrder.push('toast');
    });
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

  // 1. Payload correto & 2. BPM válido
  it('runs complete transaction on success exactly once with correct payload and valid BPM', async () => {
    const deps = getDeps();
    const result = await executeGlobalSongUpdate(deps);

    expect(result).toEqual({ status: 'success' });
    expect(mockUpdateSong).toHaveBeenCalledTimes(1);
    expect(mockUpdateSong).toHaveBeenCalledWith('song-123', { selectedKey: 'A', bpm: 120 });
    expect(mockRefreshData).toHaveBeenCalledTimes(1);
    expect(mockSetFormData).toHaveBeenCalledTimes(1);
    expect(mockShowSuccessToast).toHaveBeenCalledWith('Global update saved!');
  });

  // 3. BPM zero para null
  it('normalizes BPM zero to null in update payload', async () => {
    const deps = getDeps({ bpm: 0 });
    await executeGlobalSongUpdate(deps);
    expect(mockUpdateSong).toHaveBeenCalledWith('song-123', { selectedKey: 'A', bpm: null });
  });

  // 4. BPM abaixo de 20 para null
  it('normalizes BPM below 20 to null in update payload', async () => {
    const deps = getDeps({ bpm: 19 });
    await executeGlobalSongUpdate(deps);
    expect(mockUpdateSong).toHaveBeenCalledWith('song-123', { selectedKey: 'A', bpm: null });
  });

  // 5. BPM acima de 300 para null
  it('normalizes BPM above 300 to null in update payload', async () => {
    const deps = getDeps({ bpm: 301 });
    await executeGlobalSongUpdate(deps);
    expect(mockUpdateSong).toHaveBeenCalledWith('song-123', { selectedKey: 'A', bpm: null });
  });

  // 6. Key vazia
  it('submits empty key correctly if provided', async () => {
    const deps = getDeps({ key: '' });
    await executeGlobalSongUpdate(deps);
    expect(mockUpdateSong).toHaveBeenCalledWith('song-123', { selectedKey: '', bpm: 120 });
  });

  // 7. Update antes de refresh, 8. Refresh antes de setFormData, 9. SetFormData antes do toast
  it('executes transaction steps in the strict mandatory sequence', async () => {
    const deps = getDeps();
    await executeGlobalSongUpdate(deps);
    expect(executionOrder).toEqual(['update', 'refresh', 'setFormData', 'toast']);
  });

  // 10. Updater remove somente o songId alvo & 11. Updater preserva outras músicas
  it('preserves other songs in local state and removes only the target songId', async () => {
    let capturedUpdater: any = null;
    mockSetFormData.mockImplementation((updater: any) => {
      capturedUpdater = updater;
      executionOrder.push('setFormData');
    });

    const deps = getDeps({ songId: 'song-target' });
    await executeGlobalSongUpdate(deps);

    expect(capturedUpdater).toBeTypeOf('function');
    const prevMockState = {
      songSettings: {
        'song-target': { key: 'G', bpm: 80 },
        'song-other': { key: 'C', bpm: 100 },
      }
    };
    const nextMockState = capturedUpdater(prevMockState);
    expect(nextMockState).toEqual({
      songSettings: {
        'song-other': { key: 'C', bpm: 100 },
      }
    });
  });

  // 12. Falha de update preserva estado
  it('preserves override state and does not call success flow if updateSong fails', async () => {
    const testError = new Error('Database failure');
    mockUpdateSong.mockRejectedValue(testError);

    const deps = getDeps();
    await expect(executeGlobalSongUpdate(deps)).rejects.toThrow('Database failure');

    expect(mockRefreshData).not.toHaveBeenCalled();
    expect(mockSetFormData).not.toHaveBeenCalled();
    expect(mockShowSuccessToast).not.toHaveBeenCalled();
  });

  // 13. Falha de refresh preserva estado
  it('preserves override state and does not clean up local state if refreshData fails', async () => {
    const testError = new Error('Refresh failed');
    mockRefreshData.mockRejectedValue(testError);

    const deps = getDeps();
    await expect(executeGlobalSongUpdate(deps)).rejects.toThrow('Refresh failed');

    expect(mockUpdateSong).toHaveBeenCalledTimes(1);
    expect(mockSetFormData).not.toHaveBeenCalled();
    expect(mockShowSuccessToast).not.toHaveBeenCalled();
  });

  // 14. Deduplicated não executa pós-sucesso
  it('returns deduplicated and skips subsequent success flows when executeSafeAction returns undefined', async () => {
    // Force a mock response of undefined directly
    mockExecuteSafeAction.mockResolvedValue(undefined);
    const deps = getDeps();
    const result = await executeGlobalSongUpdate(deps);

    expect(result).toEqual({ status: 'deduplicated' });
    expect(mockUpdateSong).not.toHaveBeenCalled();
    expect(mockRefreshData).not.toHaveBeenCalled();
    expect(mockSetFormData).not.toHaveBeenCalled();
    expect(mockShowSuccessToast).not.toHaveBeenCalled();
  });

  // 15. Action key contém songId
  it('includes the unique target songId in the action key', async () => {
    const deps = getDeps({ songId: 'song-unique-999' });
    await executeGlobalSongUpdate(deps);

    expect(mockExecuteSafeAction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        key: 'scale-song-global-update:song-unique-999',
        preventDoubleExecution: true,
      })
    );
  });

  // 16. Músicas diferentes usam keys diferentes
  it('uses distinct lock keys for different songs', async () => {
    const depsA = getDeps({ songId: 'song-A' });
    const depsB = getDeps({ songId: 'song-B' });

    await executeGlobalSongUpdate(depsA);
    await executeGlobalSongUpdate(depsB);

    const calls = mockExecuteSafeAction.mock.calls;
    expect(calls[0][1].key).not.toBe(calls[1][1].key);
  });

  // 17. Duas chamadas simultâneas para a mesma música & 18. Segunda chamada durante refresh retorna deduplicated & 19. Apenas uma escrita ocorre
  it('handles two simultaneous calls for the same song safely by deduplicating and performing only one write', async () => {
    // Delay first execution to allow overlapping calls
    mockUpdateSong.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      executionOrder.push('update');
    });

    const deps = getDeps();
    const [res1, res2] = await Promise.all([
      executeGlobalSongUpdate(deps),
      executeGlobalSongUpdate(deps),
    ]);

    // One succeeds, one gets deduplicated
    const statuses = [res1.status, res2.status];
    expect(statuses).toContain('success');
    expect(statuses).toContain('deduplicated');

    // Only one write should have completed
    expect(mockUpdateSong).toHaveBeenCalledTimes(1);
    expect(mockRefreshData).toHaveBeenCalledTimes(1);
  });

  // 20. Retry após falha funciona
  it('allows retrying after a previous failure clears the lock', async () => {
    // First try fails
    mockUpdateSong.mockRejectedValueOnce(new Error('Transient connection error'));
    const deps = getDeps();

    await expect(executeGlobalSongUpdate(deps)).rejects.toThrow('Transient connection error');

    // Second try succeeds perfectly
    const result = await executeGlobalSongUpdate(deps);
    expect(result).toEqual({ status: 'success' });
    expect(mockUpdateSong).toHaveBeenCalledTimes(2); // One failed, one succeeded
  });
});
