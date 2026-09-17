import fs from 'node:fs';

const replaceOnce = (source, before, after, label) => {
  const first = source.indexOf(before);
  if (first === -1) throw new Error(`Patch anchor not found: ${label}`);
  if (source.indexOf(before, first + before.length) !== -1) {
    throw new Error(`Patch anchor is not unique: ${label}`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
};

const serverPath = 'server.ts';
let server = fs.readFileSync(serverPath, 'utf8');

const normalizeBlockBefore = `    if (typeof rawText === "string") {
      const { text: normalized, wasDecoded, transformations } = normalizePastedSongText(rawText);
      if (wasDecoded) {
        logInfo("1_INITIAL_PAYLOAD", "Texto colado foi decodificado", {
          pasteEncodingDetected: true,
          pasteEncodingDecoded: true,
          decodePasses: transformations.filter(t => t.startsWith('percent_decoded')).length,
          rawLength: rawText.length,
          normalizedLength: normalized.length
        });
        rawText = normalized;
      }
    }`;

const normalizeBlockAfter = `    if (typeof rawText === "string") {
      const { text: normalized, wasDecoded, transformations } = normalizePastedSongText(rawText);
      if (transformations.length > 0) {
        logInfo("1_INITIAL_PAYLOAD", "Texto colado foi normalizado antes da importação", {
          pasteEncodingDetected: transformations.some(t => t.startsWith('percent_decoded')),
          pasteEncodingDecoded: wasDecoded,
          decodePasses: transformations.filter(t => t.startsWith('percent_decoded')).length,
          transformations,
          rawLength: rawText.length,
          normalizedLength: normalized.length
        });
      }
      rawText = normalized;

      if (rawText.includes("\\uFFFD")) {
        return res.status(422).json(
          makeErrorResponse(
            "VALIDATION",
            "O texto contém caracteres corrompidos que não podem ser reconstruídos com segurança. Copie a cifra novamente e tente importar.",
            { replacementCharacterDetected: true },
            "1_INITIAL_PAYLOAD"
          )
        );
      }
    }`;
server = replaceOnce(server, normalizeBlockBefore, normalizeBlockAfter, 'raw text normalization');

const promptStart = '        const prompt = `Você é um músico e especialista em cifras musicais.';
const promptEnd = '\n`;\n\n        // Step 8: Gemini API invocation with strict timeout (25s limit)';
const promptStartIndex = server.indexOf(promptStart);
if (promptStartIndex === -1) throw new Error('Prompt start anchor not found');
const promptEndIndex = server.indexOf(promptEnd, promptStartIndex);
if (promptEndIndex === -1) throw new Error('Prompt end anchor not found');

const promptBody = [
  'Você é um músico especialista em análise de cifras. O documento musical abaixo já foi normalizado por um parser determinístico e é a fonte canônica da importação.',
  '',
  'Sua tarefa é SOMENTE enriquecer metadados e resolver ambiguidades semânticas. NÃO reescreva, reordene, resuma, corrija, transponha ou reformate a cifra nem a letra. Nunca devolva campos cleanChords, cleanLyrics, chords ou lyrics.',
  '',
  'REGRAS DE INTEGRIDADE:',
  '1. A ordem das seções, linhas, acordes e letras é imutável. Não proponha uma nova versão do documento.',
  '2. Não mova acordes para outras posições e não tente alinhar acordes sobre sílabas. O alinhamento existente pertence ao documento canônico.',
  '3. Não remova repetições de letra: repetições podem ser intencionais.',
  '4. Não invente título, artista, tom, BPM, ritmo ou seção. Quando a evidência for insuficiente, retorne null/unknown e adicione um warning curto.',
  '5. Para originalKey, use somente um tom musical válido quando houver evidência clara no conteúdo. NÃO transponha acordes.',
  '6. Para sections, descreva apenas as seções que aparecem no documento e mantenha a ordem observada. Esse campo é apenas metadado; não controla o corpo da cifra.',
  '',
  'POSSÍVEIS DADOS DE IDENTIFICAÇÃO DA FONTE:',
  'Título candidato: ${preProcessed?.title || "não identificado"}',
  'Artista candidato: ${preProcessed?.artist || "não identificado"}',
  '',
  'O título e o artista podem ter sido concatenados pela área de transferência. Separe-os semanticamente apenas quando houver evidência clara. Nunca devolva título e artista unidos no mesmo campo. Não invente artista.',
  '',
  'DOCUMENTO MUSICAL CANÔNICO — SOMENTE LEITURA:',
  '----------------------------------------',
  '${textToProcess}',
  '----------------------------------------',
  '',
  'RETORNE APENAS JSON VÁLIDO com esta estrutura exata:',
  '{',
  '  "sections": [{"name": "string", "type": "intro|verse|chorus|bridge|outro|unknown"}],',
  '  "language": "pt | en | es | unknown",',
  '  "suggestedBpm": number | null,',
  '  "suggestedRhythm": "string | null",',
  '  "capitalizedTitle": "string | null",',
  '  "capitalizedArtist": "string | null",',
  '  "originalKey": "string | null",',
  '  "warnings": ["string"]',
  '}'
].join('\n');

const newPrompt = '        const prompt = `' + promptBody + '\n`;';
server = server.slice(0, promptStartIndex) + newPrompt + server.slice(promptEndIndex + 3);

server = replaceOnce(
  server,
  '          chords: parsedAiObj.cleanChords || preProcessed?.chordsText || "",\n          lyrics: parsedAiObj.cleanLyrics || preProcessed?.lyricsText || "",',
  '          // Musical document integrity: Gemini may enrich metadata, but never owns the chart body.\n          chords: preProcessed?.chordsText || "",\n          lyrics: preProcessed?.lyricsText || "",',
  'canonical chart body'
);

const sectionsBefore = `          sections: (Array.isArray(parsedAiObj.sections) && parsedAiObj.sections.length > 0) 
            ? parsedAiObj.sections.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean)
            : (preProcessed?.sections || []),`;
const sectionsAfter = `          sections: (Array.isArray(preProcessed?.sections) && preProcessed.sections.length > 0)
            ? preProcessed.sections
            : ((Array.isArray(parsedAiObj.sections) && parsedAiObj.sections.length > 0)
              ? parsedAiObj.sections.map((s: any) => typeof s === 'string' ? s : s.name).filter(Boolean)
              : []),`;
server = replaceOnce(server, sectionsBefore, sectionsAfter, 'canonical section order');

fs.writeFileSync(serverPath, server);

const normalizerPath = 'utils/textNormalizer.ts';
let normalizer = fs.readFileSync(normalizerPath, 'utf8');
const lineBreakBlock = `  // 2. Normalize line breaks
  if (/\\r\\n|\\r/.test(text)) {
    text = text.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
    transformations.push('normalized_line_breaks');
  }

  // 3. Detect and decode percent-encoding safely`;
const hardenedBlock = `  // 2. Normalize line breaks
  if (/\\r\\n|\\r/.test(text)) {
    text = text.replace(/\\r\\n/g, '\\n').replace(/\\r/g, '\\n');
    transformations.push('normalized_line_breaks');
    wasDecoded = true;
  }

  // 2.1. Normalize copy/paste-only Unicode noise without collapsing horizontal
  // spacing. Each Unicode space becomes exactly one regular space so chord
  // columns remain stable.
  if (/[\\u00a0\\u2007\\u202f]/.test(text)) {
    text = text.replace(/[\\u00a0\\u2007\\u202f]/g, ' ');
    transformations.push('normalized_unicode_spaces');
    wasDecoded = true;
  }

  if (/[\\u200b-\\u200d\\u2060\\ufeff]/.test(text)) {
    text = text.replace(/[\\u200b-\\u200d\\u2060\\ufeff]/g, '');
    transformations.push('removed_invisible_characters');
    wasDecoded = true;
  }

  // Preserve tabs/newlines, but reject invisible C0/DEL control noise that can
  // leak from rich clipboard formats and later confuse chord tokenization.
  if (/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/.test(text)) {
    text = text.replace(/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/g, '');
    transformations.push('removed_control_characters');
    wasDecoded = true;
  }

  const nfcText = text.normalize('NFC');
  if (nfcText !== text) {
    text = nfcText;
    transformations.push('normalized_unicode_nfc');
    wasDecoded = true;
  }

  // 3. Detect and decode percent-encoding safely`;
normalizer = replaceOnce(normalizer, lineBreakBlock, hardenedBlock, 'clipboard unicode sanitization');
fs.writeFileSync(normalizerPath, normalizer);

const unitTestPath = 'tests/unit/chord-document-normalizer.test.ts';
let unitTests = fs.readFileSync(unitTestPath, 'utf8');
const unitInsertion = `

  it('removes invisible clipboard noise without moving horizontal chord alignment', () => {
    const dirty = '\\uFEFF[Verso]\\r\\nE\\u00A0\\u00A0\\u00A0\\u00A0B/D#\\u200B\\r\\nQuem\\u2060 é esse que vem\\u0007';
    const { text, wasDecoded, transformations } = normalizePastedSongText(dirty);

    expect(wasDecoded).toBe(true);
    expect(text).toBe('[Verso]\\nE    B/D#\\nQuem é esse que vem');
    expect(transformations).toContain('normalized_line_breaks');
    expect(transformations).toContain('normalized_unicode_spaces');
    expect(transformations).toContain('removed_invisible_characters');
    expect(transformations).toContain('removed_control_characters');
  });

  it('preserves intentional repeated lyrics while sanitizing paste noise', () => {
    const dirty = '[Refrão]\\nSanto\\u200B\\nSanto';
    const { text } = normalizePastedSongText(dirty);

    expect(text).toBe('[Refrão]\\nSanto\\nSanto');
    expect(text.match(/Santo/g)).toHaveLength(2);
  });`;
const lastDescribeClose = unitTests.lastIndexOf('\n});');
if (lastDescribeClose === -1) throw new Error('Unit test describe close not found');
unitTests = unitTests.slice(0, lastDescribeClose) + unitInsertion + unitTests.slice(lastDescribeClose);
fs.writeFileSync(unitTestPath, unitTests);

const contractTest = `import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('AI import musical document integrity contract', () => {
  const serverSource = fs.readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');

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
    expect(serverSource).toContain('rawText.includes("\\\\uFFFD")');
  });
});
`;
fs.writeFileSync('tests/server/ai-import-document-integrity-contract.test.ts', contractTest);

console.log('AI import integrity V2 patch applied.');
