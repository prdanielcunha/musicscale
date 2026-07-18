export interface StarterPackAllowance {
  limit: number;
  used: number;
  remaining: number;
  completed: boolean;
  started: boolean;
  version: string;
}

export function resolveStarterPackAllowance({
  onboardingState,
  organizationSongs,
  limit = 10
}: {
  onboardingState?: { starterPackImportedGlobalIds?: string[] };
  organizationSongs?: { originGlobalSongId?: string; onboardingStarter?: boolean; onboardingStarterPack?: boolean }[];
  limit?: number;
}): StarterPackAllowance {
  const importedIds = new Set<string>();

  if (onboardingState?.starterPackImportedGlobalIds) {
    for (const id of onboardingState.starterPackImportedGlobalIds) {
      if (id) importedIds.add(id);
    }
  }

  if (organizationSongs) {
    for (const song of organizationSongs) {
      if ((song.onboardingStarter || song.onboardingStarterPack) && song.originGlobalSongId) {
        importedIds.add(song.originGlobalSongId);
      }
    }
  }

  const used = Math.min(limit, importedIds.size);
  const remaining = Math.max(0, limit - used);
  
  return {
    limit,
    used,
    remaining,
    completed: remaining === 0,
    started: used > 0,
    version: "1.0"
  };
}
