import fs from 'node:fs';
import { bumpReleaseVersion } from './release-version-utils.mjs';

const kind = process.argv[2];
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = bumpReleaseVersion(pkg.version, kind);

const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
lock.version = pkg.version;
lock.packages[''].version = pkg.version;

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync('package-lock.json', JSON.stringify(lock, null, 2) + '\n');
console.log(pkg.version);
