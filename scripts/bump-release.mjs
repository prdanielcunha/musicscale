import fs from 'node:fs';

const kind = process.argv[2];
if (!['patch', 'minor'].includes(kind)) throw new Error('Use release:patch or release:minor');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const match = /^(\d+)\.(\d+)\.(\d+)(-beta)?$/.exec(pkg.version);
if (!match) throw new Error('Unsupported release version');
const [, major, minor, patch, channel = ''] = match;
pkg.version = kind === 'minor'
  ? `${major}.${Number(minor) + 1}.0${channel}`
  : `${major}.${minor}.${Number(patch) + 1}${channel}`;
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
lock.version = pkg.version;
lock.packages[''].version = pkg.version;
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
console.log(pkg.version);
