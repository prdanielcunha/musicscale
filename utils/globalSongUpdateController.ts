import { ScaleSongSettings } from '../types';

export type GlobalSongUpdateResult =
  | { status: 'success' }
  | { status: 'deduplicated' };

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
      // Requisito 8: Contrato de persistência da música global
      // Tom preenchido e BPM preenchido: { selectedKey: key || "", bpm: bpm || null }
      // Testar também: tom vazio, BPM vazio, ambos vazios, valor zero ou inválido não pode aparecer como BPM persistido válido.
      // Filter bpm: if bpm is falsy (like 0) or negative, or outside [20, 300], it should be null.
      const sanitizedBpm = (bpm && bpm >= 20 && bpm <= 300) ? bpm : null;
      
      await updateSong(songId, {
        selectedKey: key || "",
        bpm: sanitizedBpm,
      });
      return true;
    },
    {
      key: actionKey,
      preventDoubleExecution: true,
    }
  );

  if (result === undefined) {
    // Was deduplicated
    return { status: 'deduplicated' };
  }

  // Only run refreshData and post-success if not deduplicated!
  await refreshData();

  // After refreshData completes successfully, remove the local override
  setFormData((prev: any) => {
    const newSettings = { ...(prev.songSettings || {}) };
    delete newSettings[songId];
    return { ...prev, songSettings: newSettings };
  });

  showSuccessToast(successMessage);

  return { status: 'success' };
};
