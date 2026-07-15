const fs = require('fs');
const lines = fs.readFileSync('server.ts', 'utf8').split('\n');
for(let i=120; i<150; i++) console.log(i + ': ' + lines[i]);
