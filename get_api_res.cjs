const fs = require('fs');
const file = fs.readFileSync('contexts/EcosystemContext.tsx', 'utf8');

const regex = /(if \(apiRes && apiRes\.ok\) \{[\s\S]*?else \{[\s\S]*?\}[\s\S]*?\})/;
const match = file.match(regex);
if (match) {
    fs.writeFileSync('api_res.txt', match[1]);
}
