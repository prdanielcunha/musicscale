import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('MusicScale premium Home beta.28 release candidate is visual-only',()=>{
  const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
  const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
  const workflow=fs.readFileSync('.github/workflows/firebase-production-deploy.yml','utf8');
  const notes=fs.readFileSync('ops/hosting-release.txt','utf8');
  const css=fs.readFileSync('components/dashboard/premium-music-dashboard.css','utf8');
  const tools=fs.readFileSync('components/dashboard/MusicianQuickTools.tsx','utf8');

  it('advances release version without changing dependency graph or losing beta.27 notes',()=>{
    expect(pkg.version).toBe('0.10.9-beta.28');
    expect(lock.version).toBe(pkg.version);
    expect(lock.packages[''].version).toBe(pkg.version);
    expect(notes).toContain('Preserva beta.27 integralmente:');
    expect(notes).toContain('Hotfix P0 Google');
    expect(notes).toContain('App Check');
  });

  it('enables dashboard presentation in live build but no new paid/trial entitlements',()=>{
    const build=workflow.split('      - name: Build production bundle')[1]?.split('      - name: Authenticate')[0]||'';
    expect(build).toContain("VITE_NEW_DASHBOARD_UI_PRESENTATION: 'true'");
    for (const forbidden of ['VITE_NEW_PLANS_UI_PRESENTATION:', 'VITE_NEW_TRIAL_UI_PRESENTATION:',
      'VITE_NEW_ONBOARDING_UI_PRESENTATION:', 'MUSICSCALE_INTERNAL_TRIAL_ENABLED:', 'MUSICSCALE_HUB_TRIAL_V2_ENABLED:']) {
      expect(build).not.toContain(forbidden);
    }
    expect(workflow).toContain('if: github.ref == \'refs/heads/production\'');
    expect(workflow).toContain("paths:\n      - 'ops/hosting-release.txt'");
  });

  it('never introduces a rectangular gradient or dead tool routes',()=>{
    expect(css).toContain('.ms-app-shell:has(.ms-premium-dashboard) .ms-main-shell');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('.ms-premium-quick-tools__rail');
    for(const path of ['/stage-tools/tuner','/stage-tools?tool=metronome','/stage-tools?tool=pads','/chords']){
      expect(tools).toContain(path);
    }
    expect(tools).toContain('canUsePerformance');
  });
});