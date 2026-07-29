const fs = require('fs');
const file = 'tests/server/music-scale-command-service.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'expect(responses.length).toBe(1);',
  'console.log("DB KEYS:", Array.from(dbState.keys()));\n    expect(responses.length).toBe(1);'
);

fs.writeFileSync(file, code);
