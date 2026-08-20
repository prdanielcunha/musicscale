import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const providerSource = fs.readFileSync(
  path.join(root, 'contexts/MusicDataContext.tsx'),
  'utf8',
);
const cacheSource = fs.readFileSync(
  path.join(root, 'services/offline/stageReadCache.ts'),
  'utf8',
);
const databaseSource = fs.readFileSync(
  path.join(root, 'services/offline/database.ts'),
  'utf8',
);

describe('P3.5 offline stage read contract', () => {
  it('keeps the legacy custom replay queue completely outside the offline read path', () => {
    expect(cacheSource).not.toContain('syncQueue');
    expect(cacheSource).not.toContain('addToSyncQueue');
    expect(providerSource).not.toContain('syncQueue');
    expect(providerSource).not.toContain('addToSyncQueue');
  });

  it('does not require an IndexedDB schema migration', () => {
    expect(databaseSource).toContain('this.version(1).stores({');
    expect(databaseSource).not.toContain('this.version(2)');
  });

  it('requires canonical user and organization context before reading or writing stage cache', () => {
    expect(providerSource).toContain('const { user, effectiveOrganizationId } = useAuth();');
    expect(providerSource).toContain('const userId = user?.uid;');
    expect(providerSource).toContain('if (!userId || !organizationId) return;');
    expect(providerSource).toContain('offlineSnapshot?.userId === userId');
    expect(providerSource).toContain('offlineSnapshot?.organizationId === effectiveOrganizationId');
    expect(cacheSource).toContain('row.userId === userId');
    expect(cacheSource).toContain('row.organizationId === organizationId');
  });

  it('refuses mixed tenant canonical data before persistence', () => {
    expect(providerSource).toContain('song.organizationId === organizationId');
    expect(providerSource).toContain('scaleOrganizationId === organizationId');
    expect(providerSource).toContain('Refusing to persist stage cache with mixed tenant data.');
    expect(cacheSource).toContain('isScaleProvenForOrganization');
  });

  it('inherits canonical cache age instead of rejuvenating stale stage data', () => {
    expect(providerSource).toContain('readMusicDataCache<any>');
    expect(providerSource).toContain('const sourceIssuedAt = sourceReadAt - sourceCache.ageMs;');
    expect(providerSource).toContain('sourceIssuedAt,');
    expect(cacheSource).toContain('STAGE_CACHE_MAX_AGE_MS');
    expect(cacheSource).toContain('isValidTimestamp(updatedAt, Date.now())');
  });

  it('never turns an online canonical failure into cache-backed authorization', () => {
    expect(providerSource).toContain('blockedByOnlineCanonicalErrorRef');
    expect(providerSource).toContain('if (isOffline || musicData.loading) return;');
    expect(providerSource).toContain('setOfflineFallbackActive(!blockedByOnlineCanonicalErrorRef.current);');
  });

  it('holds an already-authorized offline fallback through reconnect revalidation only', () => {
    expect(providerSource).toContain('reconnectGenerationRef');
    expect(providerSource).toContain('reconnectPendingRef');
    expect(providerSource).toContain('const preserveFallback = offlineFallbackActive;');
    expect(providerSource).toContain('void musicData.refreshData().finally(() => {');
    expect(providerSource).toContain('if (reconnectGenerationRef.current !== generation) return;');
    expect(providerSource).toContain('if (reconnectPendingRef.current || reconnectPending)');
  });

  it('keeps member, role, instrument and band assignment data out of fallback context', () => {
    expect(providerSource).toContain('bandScales: []');
    expect(providerSource).toContain('populatedBandScales: []');
    expect(providerSource).toContain('roles: []');
    expect(providerSource).toContain('instruments: []');
    expect(providerSource).toContain('allUsers: []');
    expect(providerSource).toContain("usersStatus: 'error'");
    expect(cacheSource).toContain('bandScale: undefined');
    expect(cacheSource).toContain('eventAssignments: _eventAssignments');
  });

  it('refreshes canonical data after reconnect instead of treating IndexedDB as source of truth', () => {
    expect(providerSource).toContain('if (wasOffline && userId && effectiveOrganizationId)');
    expect(providerSource).toContain('void musicData.refreshData().finally(() => {');
  });
});
