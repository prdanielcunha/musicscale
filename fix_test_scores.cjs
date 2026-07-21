const fs = require('fs');
let code = fs.readFileSync('tests/server/curation-approval-service.test.ts', 'utf8');

code = code.replace(/score: 1 as any/g, `scores: {} as any`);
code = code.replace(/score: 1/g, `scores: {} as any`);

fs.writeFileSync('tests/server/curation-approval-service.test.ts', code);
