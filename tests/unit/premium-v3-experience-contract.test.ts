import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');

describe('MusicScale premium experience contract', () => {
  const bottomNav = read('components/layout/BottomNav.tsx');
  const drawer = read('components/layout/MobileSidebarDrawer.tsx');
  const sidebar = read('components/layout/Sidebar.tsx');
  const dashboard = read('pages/DashboardPage.tsx');
  const focusCard = read('components/dashboard/HomeFocusCard.tsx');
  const scales = read('pages/ScalesPage.tsx');
  const library = read('pages/LibraryPage.tsx');
  const chords = read('pages/ChordsPage.tsx');
  const lyrics = read('pages/LyricsPage.tsx');
  const index = read('index.tsx');
  const experience = read('experience-v3.css');
  const surfaces = read('experience-v3-surfaces.css');
  const command = read('experience-v3-command.css');
  const operational = read('experience-v3-operational.css');

  it('keeps the adaptive mobile dock with create integrated into navigation', () => {
    expect(bottomNav).toContain('ms-v3-dock');
    expect(bottomNav).toContain('ms-v3-dock-create-slot');
    expect(bottomNav).toContain('ms-v3-dock-active-glow');
    expect(bottomNav).toContain('<GlobalCreateAction variant="mobile" />');
    expect(bottomNav).not.toContain('to: "/profile"');
  });

  it('keeps the mobile navigation as a command surface instead of the legacy drawer presentation', () => {
    expect(drawer).toContain('ms-v3-drawer-backdrop');
    expect(drawer).toContain('ms-v3-command-drawer');
    expect(drawer).toContain('ms-v3-command-frame');
    expect(drawer).toContain('ms-v3-command-close');
    expect(command).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  });

  it('keeps dashboard live context, musical setlist and change intelligence', () => {
    expect(dashboard).toContain('ms-v3-dashboard');
    expect(focusCard).toContain('ms-v3-focus-card');
    expect(focusCard).toContain('ms-v3-live-context');
    expect(focusCard).toContain('ms-v3-context-chip');
    expect(focusCard).toContain('ms-v3-setlist');
    expect(focusCard).toContain('ms-v3-setlist-row');
    expect(focusCard).toContain('ms-v3-change-intel');
  });

  it('keeps the premium language continuous across core musical workspaces', () => {
    expect(scales).toContain('ms-v3-scales-page');
    expect(scales).toContain('ms-v3-scale-card');
    expect(library).toContain('ms-v3-library-page');
    expect(chords).toContain('ms-v3-music-workspace ms-v3-chords-page');
    expect(lyrics).toContain('ms-v3-music-workspace ms-v3-lyrics-page');
    expect(surfaces).toContain('.dark .ms-v3-scale-card');
    expect(surfaces).toContain('.ms-v3-library-page > div:first-child');
  });

  it('keeps operational screens and desktop navigation in the same premium system', () => {
    expect(sidebar).toContain('ms-v3-sidebar');
    expect(operational).toContain('.ms-notifications-page');
    expect(operational).toContain('.ms-profile-page');
    expect(operational).toContain('.ms-users-page');
    expect(operational).toContain('.ms-band-page');
    expect(operational).toContain('.ms-band-scales-page');
  });

  it('loads all experience layers and preserves reduced-motion support', () => {
    expect(index).toContain("import './experience-v3.css';");
    expect(index).toContain("import './experience-v3-surfaces.css';");
    expect(index).toContain("import './experience-v3-command.css';");
    expect(index).toContain("import './experience-v3-operational.css';");
    expect(experience).toContain('@media (prefers-reduced-motion: no-preference)');
    expect(experience).toContain('.ms-v3-dock-link:active');
  });
});
