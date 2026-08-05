const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const oldCode = `          logWarn("10.5_KEY_CONSISTENCY", "Chord content key mismatch", {
            expectedKey: consistencyResult.expectedKey,
            detectedKey: consistencyResult.detectedKey,
            confidence: consistencyResult.confidence,
            scoreGap: consistencyResult.scoreGap
          });`;

const newCode = `          logWarn("10.5_KEY_CONSISTENCY", "Chord content key mismatch", {
            requestId,
            expectedKey: consistencyResult.expectedKey,
            detectedKey: consistencyResult.detectedKey,
            confidence: consistencyResult.confidence,
            scoreGap: consistencyResult.scoreGap
          });`;

if (code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('server.ts', code);
  console.log('Patched server.ts successfully');
} else {
  console.log('Could not find old code in server.ts');
}
