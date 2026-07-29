const fs = require('fs');
const file = 'tests/server/music-scale-command-service.test.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace all occurrences of `as unknown as CommandReceipt` where we are accessing `.version` or `.eventAssignmentCount` 
// with `as unknown as { version: number, eventAssignmentCount: number }`
code = code.replace(/as unknown as CommandReceipt/g, 'as unknown as { version: number, eventAssignmentCount: number }');

fs.writeFileSync(file, code);
