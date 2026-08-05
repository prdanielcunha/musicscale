const fs = require('fs');

let code = fs.readFileSync('utils/chordEngine.ts', 'utf8');

const oldCode = `  let expectedCandidate = null;
  for (const candidate of analysis.candidates) {
    if (areKeysEnharmonicallyEquivalent(normalizeKey(candidate.key), normExpectedKey)) {
      expectedCandidate = candidate;
      break;
    }
  }

  const topCandidate = analysis.candidates[0];
  const scoreGap = topCandidate.score - (expectedCandidate ? expectedCandidate.score : 0);

  if (expectedCandidate) {
    const expectedDiatonicRatio = expectedCandidate.evidence.totalChordTokens > 0 
      ? expectedCandidate.evidence.diatonicHits / expectedCandidate.evidence.totalChordTokens 
      : 0;
    
    if (analysis.candidates[0].evidence.totalChordTokens >= 3 &&
        expectedCandidate.evidence.tonicHits >= 1 &&
        expectedDiatonicRatio >= 0.75 &&
        scoreGap <= 1.5) {
      return {
        status: 'MATCH',
        expectedKey,
        detectedKey: expectedCandidate.key,
        confidence: analysis.candidates[0].confidence,
        topScore: topCandidate.score,
        expectedScore: expectedCandidate.score,
        scoreGap,
        totalChordTokens: analysis.candidates[0].evidence.totalChordTokens
      };
    }
  }

  const expectedDiatonicRatio2 = expectedCandidate && expectedCandidate.evidence.totalChordTokens > 0 
    ? expectedCandidate.evidence.diatonicHits / expectedCandidate.evidence.totalChordTokens 
    : 0;

  if (analysis.candidates[0].evidence.totalChordTokens >= 4 &&
      (analysis.candidates[0].confidence === 'high' || analysis.candidates[0].confidence === 'medium') &&
      scoreGap >= 3 &&
      (!expectedCandidate || expectedCandidate.evidence.tonicHits === 0) &&
      expectedDiatonicRatio2 <= 0.25) {
    return {
      status: 'MISMATCH',
      expectedKey,
      detectedKey: topCandidate.key,
      confidence: analysis.candidates[0].confidence,
      topScore: topCandidate.score,
      expectedScore: expectedCandidate ? expectedCandidate.score : 0,
      scoreGap,
      totalChordTokens: analysis.candidates[0].evidence.totalChordTokens
    };
  }

  return {
    status: 'INDETERMINATE',
    expectedKey,
    detectedKey: topCandidate.key,
    confidence: analysis.candidates[0].confidence,
    topScore: topCandidate.score,
    expectedScore: expectedCandidate ? expectedCandidate.score : 0,
    scoreGap,
    totalChordTokens: analysis.candidates[0].evidence.totalChordTokens
  };`;

const newCode = `  const expectedCandidate: ChordKeyCandidate | undefined = analysis.candidates.find((candidate) =>
    areKeysEnharmonicallyEquivalent(
      normalizeKey(candidate.key),
      normExpectedKey
    )
  );

  const topCandidate = analysis.candidates[0];
  const scoreGap = topCandidate.score - (expectedCandidate ? expectedCandidate.score : 0);

  if (expectedCandidate) {
    const expectedDiatonicRatio = expectedCandidate.evidence.totalChordTokens > 0 
      ? expectedCandidate.evidence.diatonicHits / expectedCandidate.evidence.totalChordTokens 
      : 0;
    
    if (topCandidate.evidence.totalChordTokens >= 3 &&
        expectedCandidate.evidence.tonicHits >= 1 &&
        expectedDiatonicRatio >= 0.75 &&
        scoreGap <= 1.5) {
      return {
        status: 'MATCH',
        expectedKey,
        detectedKey: expectedCandidate.key,
        confidence: topCandidate.confidence,
        topScore: topCandidate.score,
        expectedScore: expectedCandidate.score,
        scoreGap,
        totalChordTokens: topCandidate.evidence.totalChordTokens
      };
    }
  }

  const expectedDiatonicRatio2 = expectedCandidate && expectedCandidate.evidence.totalChordTokens > 0 
    ? expectedCandidate.evidence.diatonicHits / expectedCandidate.evidence.totalChordTokens 
    : 0;

  if (topCandidate.evidence.totalChordTokens >= 4 &&
      (topCandidate.confidence === 'high' || topCandidate.confidence === 'medium') &&
      scoreGap >= 3 &&
      (!expectedCandidate || expectedCandidate.evidence.tonicHits === 0) &&
      expectedDiatonicRatio2 <= 0.25) {
    return {
      status: 'MISMATCH',
      expectedKey,
      detectedKey: topCandidate.key,
      confidence: topCandidate.confidence,
      topScore: topCandidate.score,
      expectedScore: expectedCandidate ? expectedCandidate.score : 0,
      scoreGap,
      totalChordTokens: topCandidate.evidence.totalChordTokens
    };
  }

  return {
    status: 'INDETERMINATE',
    expectedKey,
    detectedKey: topCandidate.key,
    confidence: topCandidate.confidence,
    topScore: topCandidate.score,
    expectedScore: expectedCandidate ? expectedCandidate.score : 0,
    scoreGap,
    totalChordTokens: topCandidate.evidence.totalChordTokens
  };`;

if (code.includes(oldCode)) {
  code = code.replace(oldCode, newCode);
  fs.writeFileSync('utils/chordEngine.ts', code);
  console.log('Patched chordEngine.ts successfully');
} else {
  console.log('Could not find old code in chordEngine.ts');
}
