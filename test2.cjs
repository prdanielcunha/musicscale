const fs = require('fs');
const code = fs.readFileSync('utils/chordEngine.ts', 'utf8');
const lines = code.split('\n');
lines.forEach((l, i) => {
  if (l.includes('export function') || l.includes('export const')) console.log((i+1) + ': ' + l);
});
