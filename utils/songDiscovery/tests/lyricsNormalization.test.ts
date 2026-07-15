import assert from 'node:assert';
import { normalizeLyrics, extractOpeningLyrics, extractChorusLyrics } from '../lyricsNormalization.js';

export function runTests() {
    console.log('Running lyricsNormalization tests...');

    const chordPro = `
[Intro]
C  G  Am  F

[Verse 1]
[C]Graça [G]mártir, [Am]graça [F]sem fim
`;
    assert.strictEqual(normalizeLyrics(chordPro), 'graca martir graca sem fim');
    assert.strictEqual(extractOpeningLyrics(chordPro), 'graca martir graca sem fim');
    assert.strictEqual(extractChorusLyrics(chordPro), null);

    const normalChords = `
[Intro]
G D/F# Em C

[Verse 1]
G              D/F#
Deus enviou seu filho amado
Em        C
Para morrer em meu lugar

[Refrão]
G           D/F#
Porque Ele vive
Em        C
Posso crer no amanhã
`;
    // We expect "deus enviou seu filho amado para morrer em meu lugar porque ele vive posso crer no amanha"
    const expected = 'deus enviou seu filho amado para morrer em meu lugar porque ele vive posso crer no amanha';
    assert.strictEqual(normalizeLyrics(normalChords), expected);
    
    assert.strictEqual(extractChorusLyrics(normalChords), 'porque ele vive posso crer no amanha');

    console.log('lyricsNormalization tests passed!');
}
