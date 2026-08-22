import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const hookSource = fs.readFileSync(
  path.join(root, 'hooks/useLiveWorshipSession.ts'),
  'utf8',
);
const directorSource = fs.readFileSync(
  path.join(root, 'components/songs/LiveWorshipDirector.tsx'),
  'utf8',
);

describe('Live Worship leadership contract', () => {
  it('clears previous realtime record and rejects callbacks after subscription cleanup', () => {
    expect(hookSource).toContain('setSessionRecord(null);');
    expect(hookSource).toContain('let active = true;');
    expect(hookSource).toContain('if (!active) return;');
    expect(hookSource).toContain('active = false;');
  });

  it('derives write authority from canonical scales.manage capability', () => {
    expect(hookSource).toContain("hasCapability('musicscale.scales.manage')");
    expect(hookSource).toContain('authority.canStartLiveSession');
    expect(hookSource).toContain('authority.canControlLiveSession');
  });

  it('does not expose persisted inactive session payload to consumers', () => {
    expect(hookSource).toContain('getActiveLiveWorshipSession(sessionRecord, sessionStatus)');
    expect(hookSource).toContain('activeCue: null');
    expect(hookSource).toContain('activeSongId: null');
  });

  it('shows start controls to an authorized manager when realtime state is ready and no leader is active', () => {
    expect(directorSource).toContain('const showLeaderPanel =');
    expect(directorSource).toContain('canManageLiveSession &&');
    expect(directorSource).toContain('sessionStatus === "ready"');
    expect(directorSource).toContain('(isLeader || canStartLiveSession)');
    expect(directorSource).not.toContain('{isLeader && (');
  });

  it('follows song/cue state only while a leader is actually live', () => {
    expect(directorSource).toContain('isLive &&');
    expect(directorSource).toContain('if (!isLive) {');
    expect(directorSource).toContain('setCueStack([]);');
  });
});
