import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { compareReleaseVersions, parseReleaseVersion } from './release-version-utils.mjs';

const current = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const previous = JSON.parse(
  execFileSync('git', ['show', 'origin/production:package.json'], { encoding: 'utf8' }),
).version;

parseReleaseVersion(current);
parseReleaseVersion(previous);

if (compareReleaseVersions(current, previous) <= 0) {
  throw new Error(
    'Production requires a newer release version. Run release:patch or release:minor.',
  );
}

console.log(`Release version verified: ${previous} -> ${current}`);
