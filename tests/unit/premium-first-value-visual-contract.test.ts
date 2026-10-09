import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
const onboarding=fs.readFileSync('components/onboarding/FirstScaleJourneyCard.tsx','utf8');

describe('Approved premium MusicScale onboarding visual',()=>{
  it('is canary-only and retains the existing first-value feature/state contract',()=>{
    expect(onboarding).toContain("VITE_NEW_ONBOARDING_UI_PRESENTATION === 'true'");
    for(const step of ["case 'repertoire':","case 'firstScale':","case 'team':","case 'publish':"]){
      expect(onboarding).toContain(step);
    }
    expect(onboarding).toContain('isEligible');
    expect(onboarding).toContain('isCompleted');
    expect(onboarding).toContain('currentEssentialStep');
    expect(onboarding).toContain('isOptional');
    expect(onboarding).toContain('openSongForm');
    expect(onboarding).toContain('openScaleForm');
    expect(onboarding).toContain('data-primary-action="true"');
  });
  it('keeps screenshot-inspired musical/graphic treatment without asset-heavy photos',()=>{
    expect(onboarding).toContain('ms-premium-first-value');
    expect(onboarding).toContain('bg-gradient-to-r from-[#3ed5dd] to-[#4f8cff]');
    expect(onboarding).toContain('rounded-[28px]');
    expect(onboarding).toContain('bg-[radial-gradient(');
    expect(onboarding).not.toContain('background-image: url(');
  });
});