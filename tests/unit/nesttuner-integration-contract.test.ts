import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');

describe('NestTuner integration contract', () => {
  it('loads the pinned canonical NestTuner module without iframe duplication', () => {
    const embed = read('components/nesttuner/NestTunerEmbed.tsx');
    expect(embed).toContain('https://nesttuner.millionsnest.com/embed/nesttuner-element.v0.4.0-beta.0.js');
    expect(embed).toContain('document.createElement(\'nest-tuner\')');
    expect(embed.toLowerCase()).not.toContain('<iframe');
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
