const fs = require('fs');
let code = fs.readFileSync('tests/unit/chord-engine.test.ts', 'utf8');

const target = `  it('identifies NO_CHORDS', () => {
    const res = validateChordContentKeyConsistency("Grande é o Senhor e digno de louvor", "G");
    expect(res.status).toBe('NO_CHORDS');
    expect(res.totalChordTokens).toBe(0);
  });
});`;

const replacement = `  it('identifies NO_CHORDS', () => {
    const res = validateChordContentKeyConsistency("Grande é o Senhor e digno de louvor", "G");
    expect(res.status).toBe('NO_CHORDS');
    expect(res.totalChordTokens).toBe(0);
  });

  it('handles INVALID expectedKey as INDETERMINATE (does not throw)', () => {
    const res = validateChordContentKeyConsistency("C G Am F", "INVALID_KEY");
    expect(res.status).toBe('INDETERMINATE');
    expect(res.expectedKey).toBe('INVALID_KEY');
  });
});`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('tests/unit/chord-engine.test.ts', code);
  console.log('Patched INVALID test case successfully');
} else {
  console.log('Could not find target block');
}
