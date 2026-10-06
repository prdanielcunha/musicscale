import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('NestTuner integration contract', () => {
  it('uses the certified standalone host as a seamless embedded surface', () => {
    const embed = read('components/nesttuner/NestTunerEmbed.tsx');
    expect(embed).toContain("NESTTUNER_EMBED_VERSION = '0.6.7-beta.1'");
    expect(embed).toContain("NESTTUNER_HOSTING_ORIGIN = 'https://mn-nesttuner-555464791734.web.app'");
    expect(embed).toContain("url.searchParams.set('embed', 'musicscale')");
    expect(embed).toContain('<iframe');
    expect(embed).toContain('allow="microphone; autoplay; fullscreen"');
    expect(embed).toContain('scrolling="no"');
    expect(embed).not.toContain('document.createElement(NESTTUNER_ELEMENT)');
  });

  it('waits for the real NestTuner handshake instead of iframe load alone', () => {
    const embed = read('components/nesttuner/NestTunerEmbed.tsx');
    expect(embed).toContain("event.data?.type === 'nesttuner:ready'");
    expect(embed).toContain("event.data?.type === 'nesttuner:resize'");
    expect(embed).toContain("event.data?.type === 'nesttuner:navigate-back'");
    expect(embed).toContain('setFrameHeight');
    expect(embed).toContain('NESTTUNER_READY_TIMEOUT_MS');
  });

  it('keeps retry and public fallback available', () => {
    const embed = read('components/nesttuner/NestTunerEmbed.tsx');
    expect(embed).toContain('setAttempt((value) => value + 1)');
    expect(embed).toContain('NESTTUNER_PUBLIC_ORIGIN');
    expect(embed).toContain('target="_blank"');
  });

  it('gives the tuner a native edge-to-edge route instead of a framed card', () => {
    const app = read('PrivateApp.tsx');
    const page = read('pages/NestTunerPage.tsx');
    expect(app).toContain('isNestTunerRoute');
    expect(app).toContain("'p-0 pb-[calc(104px+env(safe-area-inset-bottom))]");
    expect(app).toContain("'ms-route-workspace w-full min-w-0'");
    expect(page).toContain('className="w-full min-w-0"');
    expect(page).not.toContain('overflow-hidden');
  });

  it('exposes a protected MusicScale route and Stage Tools entry', () => {
    const app = read('PrivateApp.tsx');
    const tools = read('pages/StageToolsPage.tsx');
    expect(app).toContain('path="/stage-tools/tuner"');
    expect(app).toContain('<NestTunerPage />');
    expect(tools).toContain("navigate('/stage-tools/tuner')");
  });

  it('keeps PT EN ES user-facing copy', () => {
    for (const locale of ['pt', 'en', 'es']) {
      const copy = JSON.parse(read(`locales/${locale}.json`));
      expect(copy.stage_tools.tuner_title).toBe('NestTuner');
      expect(copy.stage_tools.tuner_action).toBeTruthy();
      expect(copy.stage_tools.tuner_error_title).toBeTruthy();
    }
  });
});
