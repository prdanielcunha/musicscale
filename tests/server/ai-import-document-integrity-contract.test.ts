import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AI import musical document integrity contract', () => {
  const serverSource = fs.readFileSync('server.ts', 'utf8');

  it('keeps the deterministic parser authoritative for chords and lyrics', () => {
    expect(serverSource).toContain('chords: preProcessed?.chordsText || "",');
    expect(serverSource).toContain('lyrics: preProcessed?.lyricsText || "",');
    expect(serverSource).not.toContain('chords: parsedAiObj.cleanChords');
    expect(serverSource).not.toContain('lyrics: parsedAiObj.cleanLyrics');
  });

  it('does not ask Gemini to reconstruct the musical document', () => {
    expect(serverSource).toContain('NÃO reescreva, reordene, resuma, corrija, transponha ou reformate a cifra nem a letra.');
    expect(serverSource).toContain('Nunca devolva campos cleanChords, cleanLyrics, chords ou lyrics.');
    expect(serverSource).not.toContain('"cleanChords": "a cifra completa estruturada');
    expect(serverSource).not.toContain('"cleanLyrics": "apenas a letra formatada');
  });

  it('prefers parser section order and rejects unrecoverable replacement characters', () => {
    expect(serverSource).toContain('Array.isArray(preProcessed?.sections)');
    expect(serverSource).toContain('rawText.includes("\\uFFFD")');
  });
});
