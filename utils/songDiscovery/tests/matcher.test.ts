import assert from 'node:assert';
import { calculateSimilarity, compareSongs } from '../matcher.js';
import { extractSongIdentity } from '../identityGenerator.js';
import { EXACT_MATCH_THRESHOLD } from '../constants.js';

export function runTests() {
    console.log('Running matcher tests...');

    const sim1 = calculateSimilarity('gabriela rocha', 'gabriela rocha');
    assert.strictEqual(sim1, 1.0);

    const sim2 = calculateSimilarity('gabriela rocha', 'gabriele rocha'); // 1 char diff out of 14, distance=1, 1-(1/14) = 0.928
    assert.ok(sim2 > 0.90 && sim2 < 1.0);

    const id1 = extractSongIdentity({
        title: 'Porque Ele Vive',
        artist: 'Harpa Cristã',
        lyrics: 'Porque Ele vive\nPosso crer no amanhã e muito mais texto testavel para nao falhar o limiar de palavras\nPorque Ele vive\nPosso crer no amanhã e muito mais texto testavel para nao falhar o limiar de palavras\n',
        chords: '[G]Porque Ele [D]vive\nPosso crer no amanhã e muito mais texto testavel para nao falhar o limiar de palavras\nPorque Ele vive\nPosso crer no amanhã e muito mais texto testavel para nao falhar o limiar de palavras\n',
        key: 'G',
        chordsUrl: '',
        videoUrl: ''
    });

    const id2 = extractSongIdentity({
        title: 'Porque Ele Vive (Playback)',
        artist: 'Harpa Cristã',
        lyrics: 'Porque Ele vive\nPosso crer no amanhã e muito mais texto testavel para nao falhar o limiar de palavras\nPorque Ele vive\nPosso crer no amanhã e muito mais texto testavel para nao falhar o limiar de palavras\n',
        chords: '',
        key: 'A',
        chordsUrl: '',
        videoUrl: ''
    });

    console.log("ID1 lyrics", id1.normalizedLyrics);
    console.log("ID2 lyrics", id2.normalizedLyrics);

    const comparison = compareSongs(id1, id2);
    
    // Normalized title is 'porque ele vive' for both.
    // Normalized artist is 'harpa crista' for both.
    // Normalized Lyrics is identical.
    // It should be EXACT (fingerprint might match too if it matches content perfectly)
    if (comparison.overallScore < EXACT_MATCH_THRESHOLD) {
       console.log("FAILED COMPARISON", JSON.stringify(comparison, null, 2));
    }
    assert.ok(comparison.overallScore >= EXACT_MATCH_THRESHOLD);
    assert.strictEqual(comparison.classification, 'exact_match');

    const id3 = extractSongIdentity({
        title: 'Outra Música',
        artist: 'João',
        lyrics: 'letra diferente test test test test letra diferente test test test',
        chords: '',
        key: 'A',
        chordsUrl: '',
        videoUrl: ''
    });

    const diffComparison = compareSongs(id1, id3);
    assert.strictEqual(diffComparison.classification, 'likely_unique');
    assert.ok(diffComparison.overallScore < 0.2);

    console.log('matcher tests passed!');
}
