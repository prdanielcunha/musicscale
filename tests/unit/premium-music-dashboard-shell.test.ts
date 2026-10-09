import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const dashboard=fs.readFileSync('pages/DashboardPage.tsx','utf8');
const styles=fs.readFileSync('components/dashboard/premium-music-dashboard.css','utf8');

describe('MusicScale premium home shell',()=>{
  it('is off by default and leaves verified music features and next scale primary',()=>{
    expect(dashboard).toContain("VITE_NEW_DASHBOARD_UI_PRESENTATION === 'true'");
    expect(dashboard).toContain('ms-premium-dashboard');
    expect(dashboard).toContain('<HomeFocusCard');
    expect(dashboard).toContain('<HomeUpcomingEvents');
    expect(dashboard).toContain('<HomeSecondaryContent');
    expect(dashboard).toContain('<FirstScaleJourneyCard');
    expect(dashboard).toContain('<TrialProgressInline');
    expect(dashboard.indexOf('<HomeFocusCard')).toBeLessThan(dashboard.indexOf('<TrialProgressInline'));
  });
  it('does not recolor old pages or add heavy photographs and supports accessible motion',()=>{
    expect(styles).toContain('.ms-premium-dashboard');
    expect(styles).toContain('prefers-reduced-motion');
    expect(styles).toContain('safe-area-inset-bottom');
    expect(styles).not.toContain('url(');
    expect(styles).not.toContain('@font-face');
  });
  it('keeps locale parity on primary visual header',()=>{
    for(const lang of ['pt','en','es']){
      const locale=JSON.parse(fs.readFileSync(`locales/${lang}.json`,'utf8'));
      expect(locale.dashboard?.premium?.eyebrow).toBeTruthy();
    }
  });
});