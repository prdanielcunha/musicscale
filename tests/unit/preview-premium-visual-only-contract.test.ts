import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const preview=fs.readFileSync('.github/workflows/firebase-main-preview.yml','utf8');
const production=fs.readFileSync('.github/workflows/firebase-production-deploy.yml','utf8');
const viteConfig=fs.readFileSync('vite.config.ts','utf8');
const flags=[
  'VITE_NEW_TRIAL_UI_PRESENTATION',
  'VITE_NEW_PLANS_UI_PRESENTATION',
  'VITE_NEW_ONBOARDING_UI_PRESENTATION',
  'VITE_NEW_DASHBOARD_UI_PRESENTATION',
];

describe('MusicScale premium staging-only visual build',()=>{
  it('identifies exactly the temporary Firebase main-review job, regardless of checkout ref',()=>{
    expect(preview).toContain('PREVIEW_CHANNEL: main-review');
    expect(preview).toContain('ref: main');
    expect(preview).toContain("-f ref='production'");
    expect(preview).toContain('firebase hosting:channel:deploy');
    expect(preview).toContain('--expires 7d');
    expect(preview).toContain('Refusing to validate the live Firebase Hosting URL as a preview');
    expect(viteConfig).toContain("process.env.GITHUB_ACTIONS === 'true'");
    expect(viteConfig).toContain("process.env.GITHUB_WORKFLOW === 'MusicScale Main Firebase Preview'");
    expect(viteConfig).toContain("process.env.PREVIEW_CHANNEL === 'main-review'");
    expect(viteConfig).toContain('define: previewOnlyVisualFlags');
  });
  it('previews all four screens but limits the production release to the safe Dashboard presentation',()=>{
    for(const flag of flags){
      expect(viteConfig).toContain(`'import.meta.env.${flag}': JSON.stringify('true')`);
      if(flag === 'VITE_NEW_DASHBOARD_UI_PRESENTATION') {
        expect(production).toContain("${flag}: 'true'");
      } else {
        expect(production).not.toContain(`${flag}:`);
      }
      expect(preview).not.toContain(`${flag}: 'true'`);
    }
    expect(viteConfig).toContain('} : {}');
    expect(viteConfig).not.toContain('MUSICSCALE_HUB_TRIAL_V2_ENABLED');
    expect(viteConfig).not.toContain('MUSICSCALE_INTERNAL_TRIAL_ENABLED');
    expect(preview).not.toContain('firebase deploy --only hosting:musicscale');
    expect(preview).not.toContain('firebase hosting:channel:deploy live');
  });
});
