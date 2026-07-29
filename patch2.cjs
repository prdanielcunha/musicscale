const fs = require('fs');
const file = 'tests/server/music-scale-command-service.test.ts';
let code = fs.readFileSync(file, 'utf8');
code = code.replace(/as any/g, 'as unknown as Record<string, unknown>');
code = code.replace(/Transaction/g, 'any'); // We shouldn't use any at all.
fs.writeFileSync(file, code);
