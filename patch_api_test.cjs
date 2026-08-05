const fs = require('fs');
let code = fs.readFileSync('tests/unit/apiAiImport.test.ts', 'utf8');

const targetImport = `import app from '../../server';`;
const newImport = `import app from '../../server';
import { areKeysEnharmonicallyEquivalent } from '../../utils/chordEngine';`;

code = code.replace(targetImport, newImport);

const targetMismatch = `    // Ensure detected key is enharmonically equivalent to G
    const validGEquivalents = ['G', 'F##', 'Abb'];
    expect(validGEquivalents.includes(res.body.details.detectedKey)).toBe(true);`;

const newMismatch = `    // Ensure detected key is enharmonically equivalent to G
    expect(areKeysEnharmonicallyEquivalent(res.body.details.detectedKey, 'G')).toBe(true);`;

code = code.replace(targetMismatch, newMismatch);

fs.writeFileSync('tests/unit/apiAiImport.test.ts', code);
console.log('Patched apiAiImport.test.ts successfully');
