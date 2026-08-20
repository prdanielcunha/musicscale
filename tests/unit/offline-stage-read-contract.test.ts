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

  it('requires canonical organization context before reading or writing the stage cache', () => {
    expect(providerSource).toContain('const { effectiveOrganizationId } = useAuth();');
    expect(providerSource).toContain('if (!organizationId) return;');
    expect(providerSource).toContain('offlineSnapshot?.organizationId === effectiveOrganizationId');
  });

  it('refuses mixed tenant canonical data before persistence', () => {
    expect(providerSource).toContain('song.organizationId === organizationId');
    expect(providerSource).toContain('scaleOrganizationId === organizationId');
    expect(providerSource).toContain('Refusing to persist stage cache with mixed tenant data.');
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
    expect(providerSource).toContain('if (wasOffline && !isOffline && effectiveOrganizationId)');
    expect(providerSource).toContain('void musicData.refreshData();');
  });
});
