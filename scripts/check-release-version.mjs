import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const current = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const previous = JSON.parse(execFileSync('git', ['show', 'origin/production:package.json'], { encoding: 'utf8' })).version;
function parts(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(-beta)?$/.exec(value);
  if (!match) throw new Error('Invalid release version: ' + value);
  return [...match.slice(1, 4).map(Number), match[4] ? 0 : 1];
}
const next = parts(current);
const old = parts(previous);
const difference = next.findIndex((value, index) => value !== old[index]);
if (difference < 0 || next[difference] < old[difference]) {
  throw new Error('Production requires a newer release version. Run release:patch or release:minor.');
}
console.log('Release version verified: ' + previous + ' -> ' + current);
