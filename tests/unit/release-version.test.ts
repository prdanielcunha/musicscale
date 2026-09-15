import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, FEATURE_RELEASE } from '../../lib/appRelease';
import { releaseNewsTranslations } from '../../locales/releaseNews';

describe('release metadata', () => {
  it('keeps installed and lock versions identical', () => {
    const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+(-beta)?$/);
    expect(lock.version).toBe(APP_VERSION);
    expect(lock.packages[''].version).toBe(APP_VERSION);
    expect(Date.parse(FEATURE_RELEASE.publishedAt)).not.toBeNaN();
  });
  it('provides guidance for each feature in all supported languages', () => {
    for (const language of ['pt', 'en', 'es'] as const) {
      const copy = releaseNewsTranslations[language];
      expect(copy.premiumV2.title.length).toBeGreaterThan(0);
      for (const feature of ['navigation', 'workspace', 'updates'] as const) {
        expect(copy.premiumV2[feature].title.length).toBeGreaterThan(0);
        expect(copy.premiumV2[feature].body.length).toBeGreaterThan(0);
        expect(copy.premiumV2[feature].how.length).toBeGreaterThan(0);
      }
    }
  });
});
