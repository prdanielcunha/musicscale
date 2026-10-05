import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('NestTuner integration contract', () => {
  it('runs the pinned NestTuner web component inside the MusicScale document', () => {
    const embed = read('components/nesttuner/NestTunerEmbed.tsx');
    expect(embed).toContain("NESTTUNER_EMBED_VERSION = '0.6.5-beta.0'");
    expect(embed).toContain('nesttuner-element.v');
    expect(embed).toContain("document.createElement(NESTTUNER_ELEMENT)");
    expect(embed).toContain("script.type = 'module'");
    expect(embed).toContain("customElements.whenDefined(NESTTUNER_ELEMENT)");
    expect(embed).not.toContain('<iframe');
    expect(embed).not.toContain('allow="microphone');
  });

  it('keeps navigation native and attached to the component event', () => {
    const embed = read('components/nesttuner/NestTunerEmbed.tsx');
    expect(embed).toContain("tuner.addEventListener('nesttuner-back'");
    expect(embed).toContain("navigate('/stage-tools')");
    expect(embed).not.toContain('postMessage');
  });

  it('keeps retry and public fallback available', () => {
    const embed = read('components/nesttuner/NestTunerEmbed.tsx');
    expect(embed).toContain('setAttempt((value) => value + 1)');
    expect(embed).toContain('NESTTUNER_PUBLIC_ORIGIN');
    expect(embed).toContain('target="_blank"');
  });

  it('gives the tuner a native edge-to-edge route instead of a nested viewport', () => {
    const app = read('PrivateApp.tsx');
    const page = read('pages/NestTunerPage.tsx');
    expect(app).toContain("isNestTunerRoute ? 'p-0");
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
