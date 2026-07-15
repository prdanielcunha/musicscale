import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf-8');
const imports = `import { SongDiscoveryInboxService } from "./services/server/songDiscoveryInboxService.js";
import { analyzeInboxBatch } from "./services/server/songInboxAnalyzer.js";\n`;

if (!content.includes('SongDiscoveryInboxService')) {
    content = content.replace(`import { runSongDiscoveryProcessor } from "./services/server/songDiscoveryProcessor.js";`, `import { runSongDiscoveryProcessor } from "./services/server/songDiscoveryProcessor.js";\n${imports}`);
    fs.writeFileSync('server.ts', content, 'utf-8');
}
console.log("Imports added!");
