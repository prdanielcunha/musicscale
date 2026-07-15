import assert from 'node:assert';
import { normalizeArtist } from '../artistNormalization.js';

export function runTests() {
    console.log('Running artistNormalization tests...');

    const res1 = normalizeArtist('Gabriela Rocha feat. Fernandinho');
    assert.deepStrictEqual(res1, ['fernandinho', 'gabriela rocha']);

    const res2 = normalizeArtist('Morada & Gabriela Rocha');
    assert.deepStrictEqual(res2, ['gabriela rocha', 'morada']);

    // "Preto no Branco" should not be split because no splitters match "no"
    const res3 = normalizeArtist('Preto no Branco');
    assert.deepStrictEqual(res3, ['preto no branco']);

    // Comma separated
    const res4 = normalizeArtist('Fernandinho, Gabriela Rocha');
    assert.deepStrictEqual(res4, ['fernandinho', 'gabriela rocha']);

    const res5 = normalizeArtist('Voz da Verdade');
    assert.deepStrictEqual(res5, ['voz da verdade']);

    console.log('artistNormalization tests passed!');
}
