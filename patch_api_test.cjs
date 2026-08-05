const fs = require('fs');
let code = fs.readFileSync('tests/unit/apiAiImport.test.ts', 'utf8');

const newTest = `  it('should return INDETERMINATE when automatic confirmation is inconclusive', async () => {
    geminiMockState.text = JSON.stringify({
      capitalizedTitle: "Test Song",
      capitalizedArtist: "Test Artist",
      originalKey: "Am",
      cleanChords: "[Intro] C  G  Am  F",
      cleanLyrics: "Hello world\\nAnother line",
      sections: ["Intro"]
    });

    const inputText = \`Tom: Am\\nCapotraste: 5\\nForma dos acordes no tom de Em\\n\\n[Intro] Em  Bm  C  G\`;
    
    const res = await request(app)
      .post('/api/ai-import')
      .set('Authorization', 'Bearer fake-token')
      .send({
        rawText: inputText,
        orgId: 'test-org',
        userId: 'test-uid'
      });
      
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    // Validate metadata in song
    expect(res.body.song.metadata.declaredKey).toBe("Am");
    expect(res.body.song.metadata.shapeKey).toBe("Em");
    expect(res.body.song.metadata.capo).toBe(5);
    expect(res.body.song.metadata.transpositionSemitones).toBe(5);
    expect(res.body.song.metadata.normalizedToConcertKey).toBe(true);
    expect(res.body.song.metadata.chordContentKeyValidationStatus).toBe("INDETERMINATE");
    expect(res.body.song.metadata.chordContentKey).toBeUndefined();

    // Validate metadata in result
    expect(res.body.result.metadata.declaredKey).toBe("Am");
    expect(res.body.result.metadata.shapeKey).toBe("Em");
    expect(res.body.result.metadata.capo).toBe(5);
    expect(res.body.result.metadata.transpositionSemitones).toBe(5);
    expect(res.body.result.metadata.normalizedToConcertKey).toBe(true);
    expect(res.body.result.metadata.chordContentKeyValidationStatus).toBe("INDETERMINATE");
    expect(res.body.result.metadata.chordContentKey).toBeUndefined();

    // Check warnings
    expect(Array.isArray(res.body.result.warnings)).toBe(true);
    expect(res.body.result.warnings.includes("Não foi possível confirmar automaticamente o tom físico dos acordes.")).toBe(true);
  });
});`;

code = code.replace("  });\n});", "  });\n\n" + newTest);

fs.writeFileSync('tests/unit/apiAiImport.test.ts', code);
console.log('Patched tests/unit/apiAiImport.test.ts successfully');
