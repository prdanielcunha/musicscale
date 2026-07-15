import assert from 'node:assert';
import { extractSongIdentity, extractYoutubeId } from '../identityGenerator.js';
import { SongSnapshot } from '../types.js';

export function runTests() {
    console.log('Running identityGenerator tests...');

    assert.strictEqual(extractYoutubeId('https://www.youtube.com/watch?v=ABCDEFGHIJK'), 'ABCDEFGHIJK');
    assert.strictEqual(extractYoutubeId('https://youtu.be/ABCDEFGHIJK'), 'ABCDEFGHIJK');
    assert.strictEqual(extractYoutubeId('https://www.youtube.com/shorts/ABCDEFGHIJK'), 'ABCDEFGHIJK');
    assert.strictEqual(extractYoutubeId('https://www.youtube.com/watch?v=ABCDEFGHIJK&list=PL123'), 'ABCDEFGHIJK');
    assert.strictEqual(extractYoutubeId('https://youtube-fake.example/watch?v=ABCDEFGHIJK'), null);

    const snapshot: SongSnapshot = {
        title: 'Porque Ele Vive (Ao Vivo)',
        artist: 'Harpa Cristã, Fernandinho',
        lyrics: '',
        chords: `[Intro] G D/F# Em C\n\n[Refrão]\n[G]Porque Ele [D/F#]vive\n[Em]Posso crer no a[C]manhã`,
        key: 'G',
        chordsUrl: '',
        videoUrl: 'https://youtube.com/watch?v=12345678901'
    };

    const identity = extractSongIdentity(snapshot);

    assert.strictEqual(identity.normalizedTitle, 'porque ele vive');
    assert.deepStrictEqual(identity.normalizedArtists, ['fernandinho', 'harpa crista']);
    assert.strictEqual(identity.externalReferences.youtubeVideoId, '12345678901');
    assert.strictEqual(identity.chorusLyrics, 'porque ele vive posso crer no amanha');
    
    assert.ok(identity.titleFingerprint);
    assert.ok(identity.contentFingerprint);
    
    const duplicate = extractSongIdentity({
        title: 'Porque ele vive - Oficial',
        artist: 'Fernandinho & Harpa Cristã',
        lyrics: '',
        chords: `[Refrão]\nPorque Ele vive\nPosso crer no amanhã`,  // missing intro and chords, but same lyrics text
        key: 'A',
        chordsUrl: '',
        videoUrl: 'https://youtu.be/12345678901'
    });
    
    assert.strictEqual(identity.normalizedTitle, duplicate.normalizedTitle);
    assert.deepStrictEqual(identity.normalizedArtists, duplicate.normalizedArtists);
    assert.strictEqual(identity.externalReferences.youtubeVideoId, duplicate.externalReferences.youtubeVideoId);
    
    // Lyrics should match! Because `generateLyricsOnly` skips the inline chords, and Intro line is pure chords so it's skipped.
    assert.strictEqual(identity.normalizedLyrics, duplicate.normalizedLyrics);
    assert.strictEqual(identity.lyricsFingerprint, duplicate.lyricsFingerprint);
    
    // Since title, artist, and lyrics perfectly matched, contentFingerprint perfectly matches
    assert.strictEqual(identity.contentFingerprint, duplicate.contentFingerprint);

    console.log('identityGenerator tests passed!');
}
