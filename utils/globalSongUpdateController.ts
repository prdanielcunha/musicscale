import { GlobalSongUpdateResult } from '../types';

export interface GlobalSongUpdateDependencies {
  songId: string;
  key: string | null;
  bpm: number | null;
  updateSong: (songId: string, data: { selectedKey: string; bpm: number | null }) => Promise<void>;
  refreshData: () => Promise<void>;
  executeSafeAction: <T>(
    action: () => Promise<T>,
    options: { key: string; preventDoubleExecution: boolean }
  ) => Promise<T | undefined>;
  setFormData: (updater: (prev: any) => any) => void;
  showSuccessToast: (message: string) => void;
  successMessage: string;
}

export const executeGlobalSongUpdate = async (
  deps: GlobalSongUpdateDependencies
): Promise<GlobalSongUpdateResult> => {
  const {
    songId,
    key,
    bpm,
    updateSong,
    refreshData,
    executeSafeAction,
    setFormData,
    showSuccessToast,
    successMessage,
  } = deps;

  const actionKey = `scale-song-global-update:${songId}`;

  const result = await executeSafeAction(
    async () => {
      // Requisito 2: Deduplicação cobrindo toda a transação global
      const sanitizedBpm =
        bpm !== null &&
        bpm >= 20 &&
        bpm <= 300
          ? bpm
          : null;

      await updateSong(songId, {
        selectedKey: key || "",
        bpm: sanitizedBpm,
      });

      await refreshData();

      setFormData((prev) => {
        const newSettings = {
          ...(prev.songSettings || {}),
        };
        delete newSettings[songId];
        return {
          ...prev,
          songSettings: newSettings,
        };
      });

      showSuccessToast(successMessage);

      return {
        status: "success" as const,
      };
    },
    {
      key: actionKey,
      preventDoubleExecution: true,
    }
  );

  if (result === undefined) {
    return {
      status: "deduplicated" as const,
    };
  }

  return result;
};
