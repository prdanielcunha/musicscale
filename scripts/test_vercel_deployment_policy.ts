import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

assert.equal(config.buildCommand, 'npm run build');
assert.equal(config.git?.deploymentEnabled?.production, true);
assert.equal(config.git?.deploymentEnabled?.['qa-validation'], true);
assert.equal(config.git?.deploymentEnabled?.main, false);
assert.equal(Object.prototype.hasOwnProperty.call(config.git?.deploymentEnabled || {}, '*'), false);
assert.match(config.ignoreCommand, /VERCEL_GIT_COMMIT_REF/);

const runIgnoreCommand = (ref: string) =>
  spawnSync(config.ignoreCommand, {
    shell: true,
    env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref },
    encoding: 'utf8',
  });

assert.equal(runIgnoreCommand('production').status, 1, 'production must build');
assert.equal(runIgnoreCommand('qa-validation').status, 1, 'qa-validation must build');
assert.equal(runIgnoreCommand('main').status, 0, 'main must be ignored by Vercel');
assert.equal(runIgnoreCommand('fix/example').status, 0, 'ordinary branches must be ignored by Vercel');

console.log('PASS Vercel deployment policy: release branches build, development branches are skipped');
