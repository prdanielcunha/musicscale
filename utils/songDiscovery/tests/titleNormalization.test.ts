import assert from 'node:assert';
import { normalizeTitle } from '../titleNormalization.js';

export function runTests() {
    console.log('Running titleNormalization tests...');

    const res1 = normalizeTitle('Bondade de Deus (Ao Vivo)');
    assert.strictEqual(res1.normalizedTitle, 'bondade de deus');

    const res2 = normalizeTitle('Santo (Tu És Santo)');
    assert.strictEqual(res2.normalizedTitle, 'santo tu es santo');

    const res3 = normalizeTitle('Bondade de Deus - Clipe Oficial');
    assert.strictEqual(res3.normalizedTitle, 'bondade de deus');

    const res4 = normalizeTitle('10.000 Razões');
    assert.strictEqual(res4.normalizedTitle, '10000 razoes');
    
    const res5 = normalizeTitle('Salmo 23');
    assert.strictEqual(res5.normalizedTitle, 'salmo 23');
    
    const res6 = normalizeTitle('Salmo XXIII');
    assert.strictEqual(res6.normalizedTitle, 'salmo xxiii'); // basic, no conversion

    const res7 = normalizeTitle('Eu Navegarei - Playback (Live)');
    assert.strictEqual(res7.normalizedTitle, 'eu navegarei');
    
    console.log('titleNormalization tests passed!');
}
