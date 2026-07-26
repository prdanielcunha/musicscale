const fs = require('fs');
let out = fs.readFileSync('tests/ui/users-existing-member-setup-integration.test.tsx', 'utf8');
let fails = [];
out.split('\n').forEach((l, i) => { if (l.includes('it(')) fails.push(i+1 + ": " + l) });
console.log(fails.join('\n'));
