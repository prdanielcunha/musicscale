import assert from 'node:assert/strict';
import fs from 'node:fs';

const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));

assert.equal(config.buildCommand, 'npm run build');
assert.equal(
  config.git?.deploymentEnabled,
  false,
  'all automatic Git deployments must remain disabled'
);
assert.equal(
  Object.prototype.hasOwnProperty.call(config, 'ignoreCommand'),
  false,
  'manual-only release mode must not depend on ignored-build shell commands'
);

console.log('PASS Vercel deployment policy: automatic Git deploys disabled; releases are manual-only');
