import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const css = read('operational-v2.css');
const songs = read('pages/SongsPage.tsx');
const notifications = read('pages/NotificationsPage.tsx');
const profile = read('pages/ProfilePage.tsx');
const users = read('pages/UsersPage.tsx');
const band = read('pages/BandPage.tsx');
const bandScales = read('pages/BandScalesPage.tsx');
const toast = read('contexts/ToastContext.tsx');

describe('Premium V2 operational surfaces contract', () => {
  it('keeps every remaining operational page explicitly scoped', () => {
    for (const marker of [
      'ms-songs-page',
      'ms-notifications-page',
      'ms-profile-page',
      'ms-users-page',
      'ms-band-page',
      'ms-band-scales-page',
    ]) {
      expect(css).toContain(`.${marker}`);
    }

    expect(songs).toContain('ms-songs-page');
    expect(notifications).toContain('ms-notifications-page');
    expect(profile).toContain('ms-profile-page');
    expect(users).toContain('ms-users-page');
    expect(band).toContain('ms-band-page');
    expect(bandScales).toContain('ms-band-scales-page');
  });

  it('uses content-shaped loading for repertoire and operational workspaces', () => {
    expect(songs).toContain('<MusicWorkspaceSkeleton cardCount={8} />');
    expect(profile).toContain('<OperationalWorkspaceSkeleton variant="profile" />');
    expect(users).toContain('<OperationalWorkspaceSkeleton variant="team" />');
    expect(band).toContain('<OperationalWorkspaceSkeleton variant="directory" />');
    expect(bandScales).toContain('<OperationalWorkspaceSkeleton variant="scales" />');
  });

  it('keeps toast chrome light and consistent with the instrument-like V2 language', () => {
    expect(toast).toContain('bg-[#121217]/98');
    expect(toast).not.toContain('backdrop-blur-2xl');
    expect(toast).not.toContain('👋');
    expect(toast).toContain('toastItem.type === "feedback" && <Info className="w-5 h-5" />');
  });
});
