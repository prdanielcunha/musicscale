import { expect, describe, it } from 'vitest';
import { normalizePastedSongText } from '../../utils/textNormalizer';

describe('normalizePastedSongText', () => {
  it('should return plain text unmodified', () => {
    const input = 'This is plain text with no encoding.';
    const result = normalizePastedSongText(input);
    expect(result.text).toBe(input);
    expect(result.wasDecoded).toBe(false);
  });

  it('should decode text with percent-encoding properly', () => {
    const input = 'tom:%20G%0A%0A%5BIntro%5D%20G%20C9%20Em7%20D%0A%0A%5BVerso%5D%0A';
    const result = normalizePastedSongText(input);
    expect(result.wasDecoded).toBe(true);
    expect(result.text).toBe('tom: G\n\n[Intro] G C9 Em7 D\n\n[Verso]\n');
  });

  it('should handle double encoding in max 2 passes', () => {
    const input = 'tom%253A%2520G%250A%250A%255BIntro%255D';
    const result = normalizePastedSongText(input);
    expect(result.wasDecoded).toBe(true);
    expect(result.text).toBe('tom: G\n\n[Intro]');
  });

  it('should not alter normal percentage signs like "20%"', () => {
    const input = 'Capo 2, play at 20% volume';
    const result = normalizePastedSongText(input);
    expect(result.wasDecoded).toBe(false);
    expect(result.text).toBe(input);
  });

  it('should not alter URL with only 1 or 2 %HH', () => {
    const input = 'Check out https://exemplo.com/musica?q=tom%20G';
    const result = normalizePastedSongText(input);
    expect(result.wasDecoded).toBe(false);
    expect(result.text).toBe(input);
  });

  it('should not throw on malformed % sequences and should decode valid parts', () => {
    const input = 'abc%2xyz%0A%20%20%20%20'; // > 2 valid ones, but 1 malformed
    const result = normalizePastedSongText(input);
    // The valid sequences %0A and %20 should be decoded, while %2x should be kept intact
    expect(result.wasDecoded).toBe(true);
    expect(result.text).toBe('abc%2xyz\n    ');
  });

  it('should preserve C#, Bb, C/G and + chords', () => {
    const input = 'C# Bb C/G C+ Gaug';
    const result = normalizePastedSongText(input);
    expect(result.text).toBe(input);
  });

  it('should preserve + when decoding', () => {
    const input = 'tom:%20G+%0A';
    const result = normalizePastedSongText(input);
    expect(result.text).toBe('tom: G+\n');
    expect(result.wasDecoded).toBe(true);
  });

  it('should preserve UTF-8 accents', () => {
    const input = 'Atenção, música com acentuação';
    const result = normalizePastedSongText(input);
    expect(result.text).toBe(input);
  });

  it('should normalize CRLF to LF', () => {
    const input = 'Line 1\r\nLine 2\rLine 3';
    const result = normalizePastedSongText(input);
    expect(result.text).toBe('Line 1\nLine 2\nLine 3');
    expect(result.transformations).toContain('normalized_line_breaks');
  });

  it('should remove BOM', () => {
    const input = '\uFEFFThis is text';
    const result = normalizePastedSongText(input);
    expect(result.text).toBe('This is text');
    expect(result.transformations).toContain('removed_bom');
  });
});

import { normalizeSongClipboardPaste } from '../../utils/textNormalizer';

describe('normalizeSongClipboardPaste', () => {
  it('should recover identity and split text when HTML contains valid headers', () => {
    const html = `
      <article>
        <header>
          <h1>Toda Terra</h1>
          <a href="/gabriela-rocha/">
            Gabriela Rocha
          </a>
        </header>
        <div>Principal</div>
        <div>Tom: E</div>
      </article>
    `;
    const plainText = `Toda TerraGabriela Rocha\nTom: E\n[Intro] E`;
    const result = normalizeSongClipboardPaste(plainText, html);
    
    expect(result.titleHint).toBe('Toda Terra');
    expect(result.artistHint).toBe('Gabriela Rocha');
    expect(result.text).toBe('Toda Terra\nGabriela Rocha\nTom: E\n[Intro] E');
    expect(result.transformations).toContain('recovered_identity_from_clipboard_html');
  });

  it('should preserve text unmodified when HTML is missing', () => {
    const plainText = `Toda TerraGabriela Rocha\nTom: E\n[Intro] E`;
    const result = normalizeSongClipboardPaste(plainText, '');
    
    expect(result.titleHint).toBeNull();
    expect(result.artistHint).toBeNull();
    expect(result.text).toBe(plainText);
  });

  it('should not return high confidence when HTML has only h1', () => {
    const html = `<h1>Toda Terra</h1><div>Tom: E</div>`;
    const plainText = `Toda Terra\nTom: E\n[Intro] E`;
    const result = normalizeSongClipboardPaste(plainText, html);
    
    expect(result.titleHint).toBeNull();
    expect(result.artistHint).toBeNull();
    expect(result.text).toBe(plainText);
  });

  it('should skip interface text like "Principal" and find the artist', () => {
    const html = `
      <h1>Toda Terra</h1>
      <a href="/letra">Letra</a>
      <h2>Gabriela Rocha</h2>
    `;
    const plainText = `Toda TerraGabriela Rocha\nTom: E\n[Intro] E`;
    const result = normalizeSongClipboardPaste(plainText, html);
    
    expect(result.titleHint).toBe('Toda Terra');
    expect(result.artistHint).toBe('Gabriela Rocha');
    expect(result.text).toBe('Toda Terra\nGabriela Rocha\nTom: E\n[Intro] E');
  });

  it('should not return high confidence when title and artist are the same', () => {
    const html = `
      <h1>Gabriela Rocha</h1>
      <h2>Gabriela Rocha</h2>
    `;
    const plainText = `Gabriela Rocha\nTom: E\n[Intro] E`;
    const result = normalizeSongClipboardPaste(plainText, html);
    
    expect(result.titleHint).toBeNull();
    expect(result.artistHint).toBeNull();
    expect(result.text).toBe(plainText);
  });

  it('should not throw on malformed HTML', () => {
    const html = `<article><header><h1>Toda Terra</h1</header><a Gabriela Rocha</a>`;
    const plainText = `Toda TerraGabriela Rocha\nTom: E\n[Intro] E`;
    const result = normalizeSongClipboardPaste(plainText, html);
    // As long as it doesn't throw, it passes.
    expect(result).toBeDefined();
  });

  it('should not duplicate when text is already split', () => {
    const html = `
      <article>
        <header>
          <h1>Toda Terra</h1>
          <a href="/gabriela-rocha/">Gabriela Rocha</a>
        </header>
      </article>
    `;
    const plainText = `Toda Terra\nGabriela Rocha\nTom: E\n[Intro] E`;
    const result = normalizeSongClipboardPaste(plainText, html);
    
    expect(result.titleHint).toBe('Toda Terra');
    expect(result.artistHint).toBe('Gabriela Rocha');
    expect(result.text).toBe('Toda Terra\nGabriela Rocha\nTom: E\n[Intro] E');
  });
});
