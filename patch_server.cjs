const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

const typeDef = `
type AiChordContentKeyValidationStatus =
  | "MATCH"
  | "MISMATCH"
  | "INDETERMINATE"
  | "NO_CHORDS";
`;

if (!code.includes('AiChordContentKeyValidationStatus')) {
  code = code.replace('import { buildSanitizedSnapshot } from "./utils/songDiscovery/snapshotSanitizer.js";', 
    'import { buildSanitizedSnapshot } from "./utils/songDiscovery/snapshotSanitizer.js";' + typeDef);
}

const targetValidationBlock = `      if (result.metadata && result.metadata.normalizedToConcertKey === true && result.metadata.declaredKey && isValidKey(result.metadata.declaredKey)) {
        const expectedContentKey = normalizeKey(result.metadata.declaredKey);
        const consistencyResult = validateChordContentKeyConsistency(result.chords, expectedContentKey);
        
        if (consistencyResult.status === 'MATCH') {
          result.metadata.chordContentKey = expectedContentKey;
        } else if (consistencyResult.status === 'MISMATCH') {
          delete result.metadata.chordContentKey;
          await finalizeAiImportFinOpsShadowWriteOnce({
            outcome: "GEMINI_ERROR",
            errorCode: "CHORD_CONTENT_KEY_MISMATCH"
          });
          
          logWarn("10.5_KEY_CONSISTENCY", "Chord content key mismatch", {
            requestId,
            expectedKey: consistencyResult.expectedKey,
            detectedKey: consistencyResult.detectedKey,
            confidence: consistencyResult.confidence,
            scoreGap: consistencyResult.scoreGap
          });
          
          return res.status(200).json(
            makeErrorResponse(
              "PARSING",
              "A tonalidade física dos acordes não corresponde ao tom informado pela fonte. Revise a cifra antes de importar.",
              { 
                error: "CHORD_CONTENT_KEY_MISMATCH",
                expectedKey: consistencyResult.expectedKey,
                detectedKey: consistencyResult.detectedKey,
                confidence: consistencyResult.confidence,
                scoreGap: consistencyResult.scoreGap
              },
              "10.5_KEY_CONSISTENCY"
            )
          );
        } else if (consistencyResult.status === 'INDETERMINATE') {
          delete result.metadata.chordContentKey;
          warnings.push("Não foi possível confirmar automaticamente o tom físico dos acordes.");
          if (overallConfidence === 'high') {
            overallConfidence = 'medium';
          }
        } else if (consistencyResult.status === 'NO_CHORDS') {
          delete result.metadata.chordContentKey;
        }
      }`;

const replacementValidationBlock = `      if (result.metadata) {
        delete result.metadata.chordContentKey;
        delete result.metadata.chordContentKeyValidationStatus;
      }

      if (result.metadata && result.metadata.normalizedToConcertKey === true && result.metadata.declaredKey && isValidKey(result.metadata.declaredKey)) {
        const expectedContentKey = normalizeKey(result.metadata.declaredKey);
        const consistencyResult = validateChordContentKeyConsistency(result.chords, expectedContentKey);
        
        if (consistencyResult.status === 'MATCH') {
          result.metadata.chordContentKey = expectedContentKey;
          result.metadata.chordContentKeyValidationStatus = 'MATCH' as AiChordContentKeyValidationStatus;
        } else if (consistencyResult.status === 'MISMATCH') {
          await finalizeAiImportFinOpsShadowWriteOnce({
            outcome: "GEMINI_ERROR",
            errorCode: "CHORD_CONTENT_KEY_MISMATCH"
          });
          
          logWarn("10.5_KEY_CONSISTENCY", "Chord content key mismatch", {
            requestId,
            expectedKey: consistencyResult.expectedKey,
            detectedKey: consistencyResult.detectedKey,
            confidence: consistencyResult.confidence,
            scoreGap: consistencyResult.scoreGap
          });
          
          return res.status(200).json(
            makeErrorResponse(
              "PARSING",
              "A tonalidade física dos acordes não corresponde ao tom informado pela fonte. Revise a cifra antes de importar.",
              { 
                error: "CHORD_CONTENT_KEY_MISMATCH",
                validationStatus: "MISMATCH" as AiChordContentKeyValidationStatus,
                expectedKey: consistencyResult.expectedKey,
                detectedKey: consistencyResult.detectedKey,
                confidence: consistencyResult.confidence,
                scoreGap: consistencyResult.scoreGap
              },
              "10.5_KEY_CONSISTENCY"
            )
          );
        } else if (consistencyResult.status === 'INDETERMINATE') {
          result.metadata.chordContentKeyValidationStatus = 'INDETERMINATE' as AiChordContentKeyValidationStatus;
          warnings.push("Não foi possível confirmar automaticamente o tom físico dos acordes.");
          if (overallConfidence === 'high') {
            overallConfidence = 'medium';
          }
        } else if (consistencyResult.status === 'NO_CHORDS') {
          result.metadata.chordContentKeyValidationStatus = 'NO_CHORDS' as AiChordContentKeyValidationStatus;
        }
      }`;

if (code.includes('if (result.metadata && result.metadata.normalizedToConcertKey === true && result.metadata.declaredKey && isValidKey(result.metadata.declaredKey)) {')) {
  code = code.replace(targetValidationBlock, replacementValidationBlock);
  fs.writeFileSync('server.ts', code);
  console.log('server.ts patched successfully');
} else {
  console.log('Target block not found in server.ts');
}
