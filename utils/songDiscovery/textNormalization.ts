/**
 * Reusable base text normalization.
 */
export function normalizeBaseText(text: string): string {
  if (!text) return '';
  let normalized = text.toLowerCase();
  
  // Normalize Unicode (diacritics)
  normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Remove invisibles
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Strip punctuation between digits (e.g., 10.000 -> 10000)
  normalized = normalized.replace(/(\d)[.,](\d)/g, '$1$2');

  // Keep numbers, letters, spaces. Replace punctuation/symbols with spaces
  normalized = normalized.replace(/[^\w\s\d]/g, ' ');
  normalized = normalized.replace(/_/g, ' ');

  // Collapse spaces and trim
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Base normalization for titles that preserves parentheses and hyphens
 */
export function normalizeTitleTextBase(text: string): string {
    if (!text) return '';
    let normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    normalized = normalized.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // Strip punctuation between digits
    normalized = normalized.replace(/(\d)[.,](\d)/g, '$1$2');

    // Replace pipe, slash, and backslash with spaces
    normalized = normalized.replace(/[|/\\]/g, ' ');
    // Replace em-dash, en-dash, underscore with standard hyphen
    normalized = normalized.replace(/[–—_]/g, '-');
    
    // Remove non-word except parentheses, brackets, hyphens, and spaces
    normalized = normalized.replace(/[^\w\s()[\]-]/g, '');

    normalized = normalized.replace(/\s+/g, ' ').trim();
    return normalized;
}
