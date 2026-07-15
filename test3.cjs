const fs = require('fs');
const lines = fs.readFileSync('services/globalLibraryService.ts', 'utf8').split('\n');
for(let i=130; i<180; i++) console.log(i + ': ' + lines[i]);
