import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const preview=fs.readFileSync('.github/workflows/firebase-main-preview.yml','utf8');
const production=fs.readFileSync('.github/workflows/firebase-production-deploy.yml','utf8');
const flags=[
  'VITE_NEW_TRIAL_UI_PRESENTATION',
  'VITE_NEW_PLANS_UI_PRESENTATION',
  'VITE_NEW_ONBOARDING_UI_PRESENTATION',
  'VITE_NEW_DASHBOARD_UI_PRESENTATION',
];

describe('MusicScale premium visual staging-only flags',()=>{
  it('enables the approved four screens exclusively in temporary main-review deployment',()=>{
    const isolated=preview.split('  deploy-main-preview:')[1];
    expect(isolated).toBeTruthy();
    expect(preview.split('  deploy-main-preview:')[0]).not.toContain(flags[0]);
    for(const flag of flags){
      expect(isolated).toContain(`${flag}: 'true'`);
      expect(production).not.toContain(`${flag}:`);
    }
    expect(isolated).toContain('firebase hosting:channel:deploy');
    expect(isolated).toContain('PREVIEW_CHANNEL');
    expect(isolated).toContain('--expires 7d');
    expect(isolated).toContain("Refusing to validate the live Firebase Hosting URL as a preview");
  });
  it('does not enable product trial/billing gates in staging build',()=>{
    expect(preview).not.toMatch(/^\s*MUSICSCALE_HUB_TRIAL_V2_ENABLED:\s*true/m);
    expect(preview).not.toMatch(/^\s*MUSICSCALE_INTERNAL_TRIAL_ENABLED:\s*true/m);
    expect(preview).not.toContain('firebase deploy --only hosting:musicscale');
    expect(preview).not.toContain('firebase hosting:channel:deploy live');
  });
});
