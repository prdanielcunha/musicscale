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

  // 3. Detect and decode percent-encoding
  // Structural markers that indicate URL-encoded text blocks rather than just a single URL
  const structuralPatterns = /%(25)*(0A|0D|20|09|5B|5D|23|2F|3A)/i;
  const hexMatches = text.match(/%[0-9A-Fa-f]{2}/g);
  
  if (hexMatches && hexMatches.length >= 2 && structuralPatterns.test(text)) {
    let decodePasses = 0;
    const maxPasses = 2;
    let currentText = text;

    while (decodePasses < maxPasses) {
      try {
        const decoded = decodeURIComponent(currentText);
        if (decoded !== currentText) {
          currentText = decoded;
          decodePasses++;
          wasDecoded = true;
          if (!/(%[0-9A-Fa-f]{2})/.test(currentText)) {
            break;
          }
        } else {
          break;
        }
      } catch (e) {
        // URIError on malformed % sequences
        break;
      }
    }

    if (wasDecoded) {
      text = currentText;
      transformations.push(`percent_decoded_${decodePasses}_passes`);
    }
  }

  return { text, wasDecoded, transformations };
}
