import {
  getRecognizedSectionKey,
  hasRecoverableChordDocumentCorruption,
  isChordOnlyCandidate,
  normalizeChordDocumentStructure,
} from './chordDocumentNormalizer';
import { repairChordImportFidelity } from './chordImportFidelityRepair';

export function normalizePastedSongText(input: string): {
  text: string;
  wasDecoded: boolean;
  transformations: string[];
} {
  if (typeof input !== 'string') {
    return { text: '', wasDecoded: false, transformations: [] };
  }

  let text = input;
  let wasDecoded = false;
  const transformations: string[] = [];

  // 1. Remove BOM
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
    transformations.push('removed_bom');
  }

  // 2. Normalize line breaks
  if (/\r\n|\r/.test(text)) {
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    transformations.push('normalized_line_breaks');
    wasDecoded = true;
  }

  // 2.1. Normalize copy/paste-only Unicode noise without collapsing horizontal
  // spacing. Each Unicode space becomes exactly one regular space so chord
  // columns remain stable.
  if (/[\u00a0\u2007\u202f]/.test(text)) {
    text = text.replace(/[\u00a0\u2007\u202f]/g, ' ');
    transformations.push('normalized_unicode_spaces');
    wasDecoded = true;
  }

  if (/[\u200b-\u200d\u2060\ufeff]/.test(text)) {
    text = text.replace(/[\u200b-\u200d\u2060\ufeff]/g, '');
    transformations.push('removed_invisible_characters');
    wasDecoded = true;
  }

  // Preserve tabs/newlines, but reject invisible C0/DEL control noise that can
  // leak from rich clipboard formats and later confuse chord tokenization.
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
    text = text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
    transformations.push('removed_control_characters');
    wasDecoded = true;
  }

  const nfcText = text.normalize('NFC');
  if (nfcText !== text) {
    text = nfcText;
    transformations.push('normalized_unicode_nfc');
    wasDecoded = true;
  }

  // 3. Detect and decode percent-encoding safely
  // Structural markers that indicate URL-encoded text blocks rather than just a single URL
  const structuralPatterns = /%(25)*(0A|0D|20|09|5B|5D|23|2F|3A)/i;
  
  // URLs should be preserved as much as possible
  const urlRegex = /(https?:\/\/[^\s]+)/gi;

  if (structuralPatterns.test(text)) {
    const decodePass = (str: string): { result: string; decoded: boolean } => {
      let changed = false;
      const parts = str.split(urlRegex);
      
      const newParts = parts.map(part => {
        if (/^https?:\/\//i.test(part)) return part; // Keep URL intact
        
        // Decode contiguous % sequences safely
        return part.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match) => {
          try {
            const dec = decodeURIComponent(match);
            if (dec !== match) changed = true;
            return dec;
          } catch (e) {
            return match; // Keep malformed intact
          }
        });
      });
      return { result: newParts.join(''), decoded: changed };
    };

    const pass1 = decodePass(text);
    if (pass1.decoded) {
      text = pass1.result;
      wasDecoded = true;
      transformations.push('percent_decoded_1_pass');
      
      // Try second pass for double-encoded text like %2520
      const pass2 = decodePass(text);
      if (pass2.decoded) {
        text = pass2.result;
        transformations.push('percent_decoded_2_passes');
      }
    }
  }

  // 4. Only invoke musical structural cleanup when we can prove this paste
  // contains the known malformed chord fingerprint. Generic multiline text
  // must keep its original whitespace/semantics.
  if (hasRecoverableChordDocumentCorruption(text)) {
    // Reconstruct while clipboard-only markers and whitespace columns still
    // exist. Marker cleanup must run afterwards because those markers prove
    // which chord fragments and duplicated lyrics came from the rich paste.
    const fidelityRepaired = repairChordImportFidelity(text);
    const structurallyNormalized = normalizeChordDocumentStructure(fidelityRepaired);

    if (fidelityRepaired !== text) {
      transformations.push('repaired_chord_import_fidelity');
    }

    if (structurallyNormalized !== fidelityRepaired) {
      transformations.push('normalized_chord_structure');
    }

    if (structurallyNormalized !== text) {
      text = structurallyNormalized;
      // Existing server callers use this boolean as the signal to consume the
      // returned normalized text, so structural cleanup must mark a change.
      wasDecoded = true;
    }
  }

  return { text, wasDecoded, transformations };
}

export interface ClipboardSongIdentity {
  title: string | null;
  artist: string | null;
  confidence: "high" | "none";
}

export interface NormalizedSongClipboardPaste {
  text: string;
  titleHint: string | null;
  artistHint: string | null;
  wasDecoded: boolean;
  transformations: string[];
}

const CLIPBOARD_BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'FIGCAPTION', 'FIGURE',
  'FOOTER', 'HEADER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'MAIN',
  'NAV', 'P', 'PRE', 'SECTION', 'TR',
]);

const trimBlankClipboardEdges = (value: string): string => {
  const lines = value.replace(/\r\n?/g, '\n').split('\n');
  while (lines.length > 0 && !lines[0].trim()) lines.shift();
  while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join('\n');
};

const serializeClipboardElement = (root: Element): string => {
  const chunks: string[] = [];
  const appendNewline = () => {
    if (chunks.length > 0 && !chunks[chunks.length - 1].endsWith('\n')) chunks.push('\n');
  };
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      chunks.push(node.textContent || '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as Element;
    const tag = element.tagName;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS'].includes(tag)) return;
    const inlineStyle = element.getAttribute('style') || '';
    if (
      element.hasAttribute('hidden') ||
      element.getAttribute('aria-hidden') === 'true' ||
      /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(inlineStyle)
    ) return;
    if (tag === 'BR') {
      appendNewline();
      return;
    }
    const isBlock = CLIPBOARD_BLOCK_TAGS.has(tag);
    if (isBlock) appendNewline();
    for (const child of Array.from(element.childNodes)) visit(child);
    if (isBlock) appendNewline();
  };
  visit(root);
  return trimBlankClipboardEdges(chunks.join('').replace(/\n{3,}/g, '\n\n'));
};

const chordDocumentScore = (value: string): number => {
  const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return 0;
  let chordRows = 0;
  let sections = 0;
  let lyricRows = 0;
  const isStrictChordRow = (line: string): boolean => {
    const tokens = line
      .replace(/^[([]+|[)\]]+$/g, '')
      .split(/[\s|]+/)
      .map((token) => token.replace(/^[([]+|[)\],;]+$/g, ''))
      .filter(Boolean);
    return tokens.length > 0 && tokens.every((token) => isChordOnlyCandidate(token));
  };
  for (const line of lines) {
    if (getRecognizedSectionKey(line)) sections += 1;
    else {
      const inlineSection = line.match(/^\[[^\]]+\]\s+(.+)$/);
      if (inlineSection && isStrictChordRow(inlineSection[1])) {
        sections += 1;
        chordRows += 1;
      } else if (isStrictChordRow(line)) chordRows += 1;
      else if (/[\p{L}]{2}/u.test(line) && !/^(?:tom|tono|key)\s*:/i.test(line)) lyricRows += 1;
    }
  }
  if (chordRows < 2 || lyricRows < 1) return 0;
  return chordRows * 8 + sections * 5 + lyricRows + Math.min(lines.length, 100) / 100;
};

/**
 * Reads the semantic text inside a rich clipboard fragment. Chord sites
 * commonly render their charts in a PRE element: its text nodes still contain
 * the original columns even when Safari's text/plain representation has
 * already flattened, duplicated or displaced visual rows.
 */
export function extractChordDocumentFromClipboardHtml(html: string): string | null {
  if (!html || typeof DOMParser === 'undefined') return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const candidates: Array<{ text: string; score: number }> = [];

  for (const element of Array.from(doc.querySelectorAll('pre'))) {
    const text = trimBlankClipboardEdges(element.textContent || '');
    const score = chordDocumentScore(text);
    if (score > 0) candidates.push({ text, score: score + 1000 });
  }

  // Some chord providers use nested DIV/BR markup instead of PRE. The body
  // serializer preserves text-node spaces and explicit block boundaries.
  if (doc.body) {
    const text = serializeClipboardElement(doc.body);
    const score = chordDocumentScore(text);
    if (score > 0) candidates.push({ text, score });
  }

  candidates.sort((left, right) => right.score - left.score || right.text.length - left.text.length);
  return candidates[0]?.text || null;
}

const prependMissingClipboardMetadata = (plainText: string, richChart: string): string => {
  const prefix: string[] = [];
  for (const line of plainText.replace(/\r\n?/g, '\n').split('\n')) {
    const trimmed = line.trim();
    if (
      /^\s*\[[^\]]+\]/.test(line) ||
      getRecognizedSectionKey(trimmed) ||
      isChordOnlyCandidate(trimmed) ||
      /^['"“”]?>/.test(trimmed)
    ) break;
    prefix.push(line);
  }
  while (prefix.length > 0 && !prefix[prefix.length - 1].trim()) prefix.pop();
  if (prefix.length === 0) return richChart;

  const prefixText = prefix.join('\n');
  const normalizedPrefix = normalizeIdentityForComparison(prefixText);
  const normalizedRichStart = normalizeIdentityForComparison(richChart.slice(0, prefixText.length + 80));
  if (normalizedPrefix && normalizedRichStart.startsWith(normalizedPrefix)) return richChart;
  return `${prefixText}\n\n${richChart}`;
};

export function normalizeIdentityForComparison(value: string): string {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function extractSongIdentityFromClipboardHtml(html: string): ClipboardSongIdentity {
  if (!html || typeof DOMParser === 'undefined') {
    return { title: null, artist: null, confidence: "none" };
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  let title: string | null = null;
  let artist: string | null = null;

  const h1s = doc.querySelectorAll('h1');
  for (const h1 of h1s) {
    if (h1.textContent && h1.textContent.trim().length > 0) {
      title = h1.textContent.trim();
      break;
    }
  }

  if (!title) {
    const itemPropsName = doc.querySelectorAll('[itemprop="name"]');
    for (const item of itemPropsName) {
      const parent = item.closest('[itemtype*="MusicRecording"], [itemtype*="CreativeWork"], [itemtype*="Composition"]');
      if (parent && item.textContent && item.textContent.trim().length > 0) {
        title = item.textContent.trim();
        break;
      }
    }
  }

  const byArtistName = doc.querySelector('[itemprop="byArtist"] [itemprop="name"]');
  if (byArtistName && byArtistName.textContent?.trim()) {
    artist = byArtistName.textContent.trim();
  }

  if (!artist) {
    const byArtist = doc.querySelector('[itemprop="byArtist"]');
    if (byArtist && byArtist.textContent?.trim()) {
      artist = byArtist.textContent.trim();
    }
  }

  if (!artist) {
    const relAuthor = doc.querySelector('[rel="author"]');
    if (relAuthor && relAuthor.textContent?.trim()) {
      artist = relAuthor.textContent.trim();
    }
  }

  if (!artist) {
    const metaAuthor = doc.querySelector('meta[name="author"]');
    if (metaAuthor) {
      const content = metaAuthor.getAttribute('content');
      if (content && content.trim()) {
        artist = content.trim();
      }
    }
  }

  if (!artist && title) {
    const h1 = h1s[0];
    if (h1) {
      const isInterfaceText = (text: string) => {
        const norm = text.trim().toLowerCase();
        const interfaceWords = [
          'principal', 'simplificada', 'letra', 'mais', 'mídia', 'vídeo', 'compartilhar', 
          'favoritar', 'imprimir', 'tom', 'ritmo', 'capotraste', 'rolagem automática', 
          'acordes', 'diagramas',
          'main', 'simplified', 'lyrics', 'more', 'media', 'video', 'share',
          'favorite', 'print', 'key', 'rhythm', 'capo', 'auto scroll',
          'chords', 'diagrams',
          'más', 'medios', 'compartir', 'favorito', 'tono', 'desplazamiento automático'
        ];
        return interfaceWords.includes(norm);
      };

      const treeWalker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT, {
        acceptNode: (node: Element) => {
          if (node === h1) return NodeFilter.FILTER_REJECT;
          if (['A', 'H2', 'H3'].includes(node.tagName)) {
             const position = h1.compareDocumentPosition(node);
             if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
                return NodeFilter.FILTER_ACCEPT;
             }
          }
          return NodeFilter.FILTER_SKIP;
        }
      });

      let nextNode = treeWalker.nextNode() as Element | null;
      while (nextNode) {
        const text = nextNode.textContent?.trim() || '';
        const len = text.length;
        if (len >= 2 && len <= 100) {
           if (text !== title && !text.includes('[') && !text.toLowerCase().startsWith('tom:') && !isInterfaceText(text)) {
              const chordPattern = /^[A-G][#b]?(m|M|maj|min|dim|aug|sus|add|[0-9])*(\/[A-G][#b]?)?$/i;
              if (!chordPattern.test(text)) {
                 artist = text;
                 break;
              }
           }
        }
        nextNode = treeWalker.nextNode() as Element | null;
      }
    }
  }

  let confidence: "high" | "none" = "none";
  if (title && artist && title !== artist) {
    confidence = "high";
  }

  return { title, artist, confidence };
}

export function normalizeSongClipboardPaste(plainText: string, htmlText: string): NormalizedSongClipboardPaste {
  const richChordDocument = extractChordDocumentFromClipboardHtml(htmlText);
  const sourceText = richChordDocument
    ? prependMissingClipboardMetadata(plainText, richChordDocument)
    : plainText;
  const { text: baseText, wasDecoded, transformations } = normalizePastedSongText(sourceText);
  let finalTransformations = [...transformations];
  let finalTitleHint: string | null = null;
  let finalArtistHint: string | null = null;
  let finalText = baseText;

  if (richChordDocument) {
    finalTransformations.push('recovered_chord_layout_from_clipboard_html');
  }

  const identity = extractSongIdentityFromClipboardHtml(htmlText);

  if (identity.confidence === "high" && identity.title && identity.artist) {
    finalTitleHint = identity.title;
    finalArtistHint = identity.artist;

    const lines = baseText.split('\n');
    let firstNonEmptyIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() !== '') {
        firstNonEmptyIndex = i;
        break;
      }
    }

    if (firstNonEmptyIndex !== -1) {
      const firstLineNorm = normalizeIdentityForComparison(lines[firstNonEmptyIndex]);
      const expectedNorm = normalizeIdentityForComparison(identity.title + identity.artist);
      
      if (firstLineNorm === expectedNorm) {
        lines[firstNonEmptyIndex] = `${identity.title}\n${identity.artist}`;
        finalText = lines.join('\n');
        finalTransformations.push("recovered_identity_from_clipboard_html");
      }
    }
  }

  return {
    text: finalText,
    titleHint: finalTitleHint,
    artistHint: finalArtistHint,
    wasDecoded: wasDecoded || finalTransformations.length > transformations.length,
    transformations: finalTransformations
  };
}
