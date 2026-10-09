import React from 'react';
import fs from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MusicianQuickTools } from '../../components/dashboard/MusicianQuickTools';

vi.mock('react-i18next', () => ({ useTranslation: () => ({
  t: (key: string, args?: Record<string,string>) => key === 'dashboard.quickTools.open'
    ? `Abrir ${args?.tool}` : key,
}) }));

afterEach(cleanup);

describe('MusicScale Home musician quick tool rail', () => {
  it('routes to the existing real tuner, metronome, pad and chord-sheet pages', () => {
    const onPerformance = vi.fn();
    render(<MemoryRouter><MusicianQuickTools canUsePerformance onOpenPerformance={onPerformance} /></MemoryRouter>);
    const links = Array.from(screen.getByTestId('ms-quick-tools-rail').querySelectorAll('a'));
    expect(links.map(a=>a.getAttribute('href'))).toEqual([
      '/stage-tools/tuner',
      '/stage-tools?tool=metronome',
      '/stage-tools?tool=pads',
      '/songs',
    ]);
    expect(screen.getByRole('link',{name:'dashboard.quickTools.all'}).getAttribute('href')).toBe('/stage-tools');
    fireEvent.click(screen.getByRole('button', {name:'Abrir dashboard.quickTools.performance'}));
    expect(onPerformance).toHaveBeenCalledOnce();
  });

  it('does not advertise gated stage performance to a member without capability', () => {
    render(<MemoryRouter><MusicianQuickTools canUsePerformance={false} onOpenPerformance={vi.fn()} /></MemoryRouter>);
    expect(screen.queryByRole('button', {name:'Abrir dashboard.quickTools.performance'})).toBeNull();
    expect(screen.getByTestId('ms-quick-tools-rail').querySelectorAll('a').length).toBe(4);
  });

  it('keeps localization parity, seamless app-wide light and anchored stage targets', () => {
    const css = fs.readFileSync('components/dashboard/premium-music-dashboard.css','utf8');
    const home = fs.readFileSync('pages/DashboardPage.tsx','utf8');
    const stage = fs.readFileSync('pages/StageToolsPage.tsx','utf8');
    const shell = fs.readFileSync('PrivateApp.tsx','utf8');
    expect(css).toContain('.ms-app-shell:has(.ms-premium-dashboard) .ms-main-shell');
    expect(shell).toContain('https://millionsnest.com/dashboard/billing');
    expect(shell).not.toContain('/dashboard/musicscale/plans');
    expect(css).toContain('.ms-premium-dashboard {');
    expect(css).toContain('background: transparent;');
    expect(css).toContain('.ms-premium-quick-tools__rail');
    expect(home).toContain("experience.mode === 'no-upcoming-event'");
    expect(home).toContain("experience.mode === 'create-next-event'");
    expect(home).toContain('{showToolsEarly && quickTools}');
    expect(home).toContain('{!showToolsEarly && quickTools}');
    expect(home.indexOf('{!showToolsEarly && quickTools}')).toBeLessThan(home.indexOf('<TrialProgressInline'));
    expect(home).toContain("VITE_NEW_DASHBOARD_UI_PRESENTATION === 'true'");
    expect(stage).toContain('ms-stage-tool-metronome');
    expect(stage).toContain('ms-stage-tool-pads');
    expect(stage).toContain("requestedTool !== 'pads' && requestedTool !== 'metronome'");
    for (const lang of ['pt','en','es']) {
      const strings = JSON.parse(fs.readFileSync(`locales/${lang}.json`,'utf8')).dashboard.quickTools;
      expect(Object.keys(strings).sort()).toEqual([
        'all','chords','eyebrow','metronome','open','pads','performance','title','tuner',
      ]);
    }
  });
});
