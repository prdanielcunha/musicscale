import fs from 'fs';

const pathHome = 'utils/homeExperience.ts';
let codeHome = fs.readFileSync(pathHome, 'utf8');

codeHome = codeHome.replace(
  "const activeMusicScales = musicScales.filter((s) => s.status !== 'cancelled' && s.status !== 'draft');",
  "const activeMusicScales = musicScales.filter((s) => s.status !== 'cancelled' && s.status !== 'completed' && s.status !== 'draft');"
);

codeHome = codeHome.replace(
  "const activeBandScales = bandScales.filter((s) => s.status !== 'cancelled' && s.status !== 'draft');",
  "const activeBandScales = bandScales.filter((s) => s.status !== 'cancelled' && s.status !== 'completed' && s.status !== 'draft');"
);

fs.writeFileSync(pathHome, codeHome);

const pathTests = 'tests/unit/home-experience.test.ts';
let codeTests = fs.readFileSync(pathTests, 'utf8');
codeTests = codeTests.replace(
  "const now = new Date('2026-08-02T09:00:00').getTime();\n      const scale = createMusicScale('02:00'); // Early morning",
  "const now = new Date('2026-08-02T01:00:00').getTime();\n      const scale = createMusicScale('02:00'); // Early morning"
);
fs.writeFileSync(pathTests, codeTests);
console.log('patched completed and tests');
