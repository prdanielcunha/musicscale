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
    expect(page).toContain('<StagePadPlayer />');
    expect(page).toContain('<Metronome />');
    expect(page).not.toContain('useLiveWorshipSession');
    expect(page).not.toContain('LiveWorshipSession');
    expect(page).not.toContain('Firestore');
  });

  it('provides every new Stage Tools, Pad, metronome and Help key in PT/EN/ES', () => {
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

  it('keeps the contextual viewer on effectivePerformanceKey and shared authority unchanged', () => {
    const viewer = read('components/songs/ChordsViewerModal.tsx');
    expect(viewer).toContain('effectivePerformanceKey');
    expect(viewer).toContain('<StagePadPlayer songKey={effectivePerformanceKey}');
    expect(viewer).toContain('if (song && isLeader)');
    expect(viewer).toContain('changeKeyOverride(song.id');
    expect(viewer).toContain('data-performance-mode="true"');
  });
});
