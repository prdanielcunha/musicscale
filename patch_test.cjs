const fs = require('fs');

let code = fs.readFileSync('tests/unit/chord-engine.test.ts', 'utf8');

const oldImport = `import { 
  transposeChordDocument, 
  getSignedSemitones, 
  analyzeChordDocumentKeyCandidates, 
  validateTransposedPreview,
  areKeysEnharmonicallyEquivalent
} from '../../utils/chordEngine';`;

const newImport = `import { 
  transposeChordDocument, 
  getSignedSemitones, 
  analyzeChordDocumentKeyCandidates, 
  validateTransposedPreview,
  areKeysEnharmonicallyEquivalent,
  validateChordContentKeyConsistency
} from '../../utils/chordEngine';`;

if (code.includes(oldImport)) {
  code = code.replace(oldImport, newImport);
  fs.writeFileSync('tests/unit/chord-engine.test.ts', code);
  console.log('Patched imports in tests/unit/chord-engine.test.ts successfully');
} else {
  console.log('Could not find old import');
}
