import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const provider=fs.readFileSync('contexts/MusicDataContext.tsx','utf8');
const hook=fs.readFileSync('hooks/useMusicData.ts','utf8');
const cache=fs.readFileSync('services/offline/stageReadCache.ts','utf8');

describe('Internal Hub trial cannot retain reusable offline music rights',()=>{
  it('never reads or writes the normal canonical local cache for a Hub trial',()=>{
    expect(hook).toContain('isHubInternalTrial');
    expect(hook).toContain('removeMusicDataCache(localStorage, uid, orgId)');
    expect(hook).toContain("status: 'miss' as const");
    expect(hook).toContain('if (!isHubInternalTrial) writeMusicDataCache');
  });

  it('disables stage hydration, persistence and fallback only for a trial',()=>{
    expect(provider).toContain('if (isHubInternalTrial) {');
    expect(provider).toContain('purgeHubTrialStageCaches(userId, organizationId)');
    expect(provider).toContain('isHubInternalTrial || isOffline');
    expect(provider).toContain('if (isHubInternalTrial || !hasScopedSnapshot)');
    expect(provider).toContain('if (isHubInternalTrial || !offlineFallbackActive || !scopedOfflineData)');
  });

  it('does not delete user-provided custom pads, song records or remote data',()=>{
    expect(cache).toContain('export async function purgeHubTrialStageCaches');
    expect(cache).toContain('offlineDB.cachedSongs');
    expect(cache).toContain('offlineDB.cachedScales');
    expect(cache).toContain('offlineDB.offlineResourcePacks');
    expect(cache).not.toContain('offlineDB.customPadAssets.bulkDelete');
    expect(cache).not.toContain('deleteDoc(');
  });
});