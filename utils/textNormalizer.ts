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
