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
  const { text: baseText, wasDecoded, transformations } = normalizePastedSongText(plainText);
  let finalTransformations = [...transformations];
  let finalTitleHint: string | null = null;
  let finalArtistHint: string | null = null;
  let finalText = baseText;

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
