const fs = require('fs');
let code = fs.readFileSync('tests/server/curation-approval-service.test.ts', 'utf8');

code = code.replace(/compareSongs'\)\.mockReturnValue\(\{ classification: 'exact_match', reasons: \[\], warnings: \[\], scores: \{\} as any \}\);/g, `compareSongs').mockReturnValue({ classification: 'exact_match', reasons: [], warnings: [], scores: {} } as any);`);

fs.writeFileSync('tests/server/curation-approval-service.test.ts', code);
