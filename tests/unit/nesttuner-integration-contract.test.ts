import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('NestTuner integration contract', () => {
  it('loads the current immutable NestTuner module with a Firebase Hosting fallback', () => {
    const embed = read('components/nesttuner/NestTunerEmbed.tsx');
    expect(embed).toContain("const NESTTUNER_RELEASE = '0.6.2-beta.0'");
    expect(embed).toContain('https://nesttuner.millionsnest.com/embed/nesttuner-element.v');
    expect(embed).toContain('https://mn-nesttuner-555464791734.web.app');
    expect(embed).toContain('consumer=');
    expect(embed).toContain('attempt=');
    expect(embed).toContain("customElements.get('nest-tuner')");
    expect(embed).toContain('document.createElement(\'nest-tuner\')');
    expect(embed.toLowerCase()).not.toContain('<iframe');
  });

  it('does not CacheFirst the remote NestTuner module inside the MusicScale service worker', () => {
    const vite = read('vite.config.ts');
    expect(vite).not.toContain("cacheName: 'nesttuner-0-4-runtime'");
    expect(vite).not.toContain('Keep the pinned NestTuner runtime available after first use.');
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
