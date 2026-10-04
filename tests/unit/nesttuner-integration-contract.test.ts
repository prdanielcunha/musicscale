import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('NestTuner integration contract', () => {
  it('keeps NestTuner inside MusicScale without cross-origin module imports', () => {
    const embed = read('components/nesttuner/NestTunerEmbed.tsx');
    expect(embed).toContain('<iframe');
    expect(embed).toContain("NESTTUNER_HOSTING_ORIGIN = 'https://mn-nesttuner-555464791734.web.app'");
    expect(embed).toContain("url.searchParams.set('embed', 'musicscale')");
    expect(embed).toContain('allow="microphone; autoplay; fullscreen"');
    expect(embed).not.toContain('import(/* @vite-ignore */');
    expect(embed).not.toContain("document.createElement('nest-tuner')");
  });

  it('validates navigation messages from the exact NestTuner frame origin', () => {
    const embed = read('components/nesttuner/NestTunerEmbed.tsx');
    expect(embed).toContain("event.origin !== NESTTUNER_HOSTING_ORIGIN");
    expect(embed).toContain("event.source !== frameRef.current?.contentWindow");
    expect(embed).toContain("event.data?.type === 'nesttuner:navigate-back'");
  });

  it('keeps retry and public fallback available', () => {
    const embed = read('components/nesttuner/NestTunerEmbed.tsx');
    expect(embed).toContain('setAttempt((value) => value + 1)');
    expect(embed).toContain('NESTTUNER_PUBLIC_ORIGIN');
    expect(embed).toContain('target="_blank"');
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
