import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { APP_VERSION, FEATURE_RELEASE } from '../../lib/appRelease';
import { releaseNewsTranslations } from '../../locales/releaseNews';
// @ts-ignore Node ESM release utility intentionally has no TypeScript declaration.
import { parseReleaseVersion, compareReleaseVersions } from '../../scripts/release-version-utils.mjs';

const runBump = (version: string, kind: string) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'musicscale-release-'));
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({ name: 'release-test', version }, null, 2) + '\n',
  );
  fs.writeFileSync(
    path.join(directory, 'package-lock.json'),
    JSON.stringify({ name: 'release-test', version, packages: { '': { version } } }, null, 2) + '\n',
  );

  execFileSync(
    process.execPath,
    [path.join(process.cwd(), 'scripts/bump-release.mjs'), kind],
    { cwd: directory, stdio: 'pipe' },
  );

  const pkg = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(directory, 'package-lock.json'), 'utf8'));
  fs.rmSync(directory, { recursive: true, force: true });
  return { pkg, lock };
};

describe('release metadata', () => {
  it('uses the current 0.2 feature beta and keeps package/lock versions identical', () => {
    const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
    expect(APP_VERSION).toBe('0.2.0-beta.1');
    expect(lock.version).toBe(APP_VERSION);
    expect(lock.packages[''].version).toBe(APP_VERSION);
    expect(FEATURE_RELEASE.version).toBe(APP_VERSION);
    expect(FEATURE_RELEASE.id).toBe('stage-tools-beta-0.2');
    expect(FEATURE_RELEASE.kind).toBe('feature');
    expect(Date.parse(FEATURE_RELEASE.publishedAt)).not.toBeNaN();
  });

  it('accepts explicit beta iterations, stable semver and legacy beta history', () => {
    expect(parseReleaseVersion('0.2.0-beta.0').iteration).toBe(0);
    expect(parseReleaseVersion('0.2.1-beta.7').iteration).toBe(7);
    expect(parseReleaseVersion('1.0.0').stable).toBe(true);
    expect(parseReleaseVersion('0.1.5-beta').iteration).toBe(0);
    expect(() => parseReleaseVersion('0.2')).toThrow();
    expect(compareReleaseVersions('0.2.0-beta.1', '0.2.0-beta.0')).toBe(1);
    expect(compareReleaseVersions('1.0.0', '1.0.0-beta.9')).toBe(1);
  });

  it('bumps minor and patch back to beta.0 and visual/revision within beta.N', () => {
    expect(runBump('0.2.0-beta.4', 'minor').pkg.version).toBe('0.3.0-beta.0');
    expect(runBump('0.2.0-beta.4', 'patch').pkg.version).toBe('0.2.1-beta.0');
    expect(runBump('0.2.1-beta.0', 'visual').pkg.version).toBe('0.2.1-beta.1');
    const revision = runBump('0.2.1-beta.1', 'revision');
    expect(revision.pkg.version).toBe('0.2.1-beta.2');
    expect(revision.lock.version).toBe(revision.pkg.version);
    expect(revision.lock.packages[''].version).toBe(revision.pkg.version);
  });

  it('provides the three feature highlights and refinements in every language', () => {
    for (const language of ['pt', 'en', 'es'] as const) {
      const copy = releaseNewsTranslations[language].stageToolsBeta02;
      expect(copy.title.length).toBeGreaterThan(0);
      for (const feature of ['stageTools', 'deviceAudio', 'updates'] as const) {
        expect(copy[feature].title.length).toBeGreaterThan(0);
        expect(copy[feature].body.length).toBeGreaterThan(0);
        expect(copy[feature].how.length).toBeGreaterThan(0);
      }
      expect(copy.refinements.summary.length).toBeGreaterThan(0);
      expect(copy.refinements.items).toHaveLength(3);
    }
  });
});
