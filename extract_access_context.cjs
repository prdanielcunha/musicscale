const fs = require('fs');
const file = fs.readFileSync('server.ts', 'utf8');

const regex = /(app\.get\("\/api\/v1\/ecosystem\/access-context", async \(req, res\) => \{[\s\S]*?\n  \}\);\n)/;
const match = file.match(regex);
if (match) {
    fs.writeFileSync('access_context_old.txt', match[1]);
}
