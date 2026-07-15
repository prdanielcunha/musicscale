import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');
const imports = `import { fixCandidatesWithoutTitle } from "./services/server/fixCandidatesWithoutTitle.js";\n`;

content = content.replace(`import { analyzeInboxBatch } from "./services/server/songInboxAnalyzer.js";`, `import { analyzeInboxBatch } from "./services/server/songInboxAnalyzer.js";\n${imports}`);

fs.writeFileSync('server.ts', content, 'utf-8');
console.log("Imports added!");
