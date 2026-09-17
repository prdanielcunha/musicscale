import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('Stage Tools contract', () => {
  it('adds an authenticated capability-protected lazy route without overloading BottomNav', () => {
    const app = read('PrivateApp.tsx');
    const navigation = read('components/layout/navigationRegistry.tsx');
    const bottomNav = read('components/layout/BottomNav.tsx');

    expect(app).toContain("const StageToolsPage = lazy(() => import('./pages/StageToolsPage'))");
    expect(app).toContain('<Route path="/stage-tools"');
    expect(app).toContain('requiredPermission="musicscale.performance.use"');
    expect(navigation).toContain('id: "stage_tools"');
    expect(navigation).toContain('path: "/stage-tools"');
    expect(navigation).toContain('permissionRequired: "musicscale.performance.use"');
    expect(bottomNav).not.toContain('/stage-tools');
  });

  it('reuses the existing Pad and metronome without creating a live session', () => {
    const page = read('pages/StageToolsPage.tsx');
    expect(page).toContain("import Metronome from '../components/common/Metronome'");
    expect(page).toContain("import StagePadPlayer from '../components/songs/StagePadPlayer'");
    expect(page).toContain('<StagePadPlayer userId={user?.uid} organizationId={effectiveOrganizationId} />');
    expect(page).toContain('<Metronome />');
    expect(page).not.toContain('useLiveWorshipSession');
    expect(page).not.toContain('LiveWorshipSession');
    expect(page).not.toContain('Firestore');
  });

  it('keeps the Stage Tools surface inside the mobile viewport and clear of bottom navigation', () => {
    const page = read('pages/StageToolsPage.tsx');
    const pad = read('components/songs/StagePadPlayer.tsx');
    expect(page).toContain('overflow-x-clip');
    expect(page).toContain('env(safe-area-inset-bottom)');
    expect(page).toContain('min-w-0 overflow-hidden');
    expect(pad).toContain('min-w-0 w-full');
    expect(pad).toContain('max-w-full');
    expect(pad).toContain('sm:hidden');
  });

  it('adds explicit offline resource packs without duplicating library songs into scale downloads', () => {
    const page = read('pages/StageToolsPage.tsx');
    const manager = read('services/offline/resourcePackManager.ts');
    const database = read('services/offline/database.ts');
    expect(page).toContain('<OfflineResourcesPanel />');
    expect(manager).toContain("libraryPack?.songRevisions?.[song.id] !== getOfflineSongRevision(song)");
    expect(manager).toContain('reusedSongs: songs.length - missingFromLibrary.length');
    expect(database).toContain('offlineResourcePacks');
    expect(database).toContain('customPadAssets');
  });

  it('provides every original Stage Tools, Pad, metronome and Help key in PT/EN/ES', () => {
    const required = [
      ['nav', 'stage_tools'],
      ['stage_tools', 'title'],
      ['stage_tools', 'subtitle'],
      ['stage_tools', 'pad_title'],
      ['stage_tools', 'metronome_title'],
      ['stage_tools', 'audio_note'],
      ['pad', 'device_output'],
      ['pad', 'device_playing'],
      ['pad', 'device_disabled'],
      ['pad', 'device_ready'],
      ['pad', 'follow_conduction'],
      ['pad', 'individual_control'],
      ['pad', 'return_to_conduction'],
      ['pad', 'neutral_note'],
      ['metronome', 'status_playing'],
      ['metronome', 'status_ready'],
      ['help_modal', 'version_beta'],
      ['help_modal', 'version_build'],
    ];

    for (const language of ['pt', 'en', 'es']) {
      const locale = JSON.parse(read(`locales/${language}.json`));
      for (const [group, key] of required) {
        expect(locale[group]?.[key], `${language}.${group}.${key}`).toBeTruthy();
      }
    }
  });

  it('ships Pad V2 and Offline Resources copy in PT/EN/ES', () => {
    const copy = read('services/stageToolsV2Copy.ts');
    expect(copy).toContain("const PT: StageToolsV2Copy");
    expect(copy).toContain("const EN: StageToolsV2Copy");
    expect(copy).toContain("const ES: StageToolsV2Copy");
    expect(copy).toContain("worship: 'Worship'");
    expect(copy).toContain("library: 'Biblioteca inteira'");
    expect(copy).toContain("library: 'Entire library'");
    expect(copy).toContain("library: 'Biblioteca completa'");
  });

  it('keeps the contextual viewer on effectivePerformanceKey and shared authority unchanged', () => {
    const viewer = read('components/songs/ChordsViewerModal.tsx');
    expect(viewer).toContain('effectivePerformanceKey');
    expect(viewer).toContain('<StagePadPlayer songKey={effectivePerformanceKey}');
    expect(viewer).toContain('if (song && isLeader)');
    expect(viewer).toContain('changeKeyOverride(song.id');
    expect(viewer).toContain('data-performance-mode="true"');
  });
});
