import { EDITORIAL_TERMS } from './constants.js';
import { normalizeBaseText, normalizeTitleTextBase } from './textNormalization.js';

export function normalizeTitle(originalTitle: string): {
  normalizedTitle: string;
  compactTitle: string;
  titleTokens: string[];
  removedTerms: string[];
} {
  const removedTerms: string[] = [];
  
  // Base normalization keeping parens and hyphens
  let workingTitle = normalizeTitleTextBase(originalTitle);

  workingTitle = workingTitle.replace(/\(([^)]+)\)|\[([^\]]+)\]/g, (match: string, p1: string, p2: string) => {
    const innerText = p1 || p2;
    const innerNormalized = normalizeBaseText(innerText);
    const hasEditorial = EDITORIAL_TERMS.some(term => innerNormalized.includes(term));
    
    let remaining = innerNormalized;
    EDITORIAL_TERMS.forEach((term: string) => {
      remaining = remaining.replace(new RegExp(`\\b${term}\\b`, 'gi'), '');
    });
    remaining = remaining.replace(/\s+/g, '').trim();
    
    if (hasEditorial && remaining.length <= 3) {
      removedTerms.push(innerText.trim());
      return '';
    } else if (hasEditorial) {
       return match;
    }
    
    return match;
  });

  const parts = workingTitle.split('-');
  if (parts.length > 1) {
     const lastPart = parts[parts.length - 1];
     const lastPartNorm = normalizeBaseText(lastPart);
     
     let isMostlyEditorial = false;
     let remaining = lastPartNorm;
     EDITORIAL_TERMS.forEach((term: string) => {
       if (remaining.includes(term)) {
           remaining = remaining.replace(new RegExp(`\\b${term}\\b`, 'gi'), '');
           isMostlyEditorial = true;
       }
     });
     remaining = remaining.replace(/\s+/g, '').trim();
     
     if (isMostlyEditorial && remaining.length <= 3) {
        removedTerms.push(lastPart.trim());
        parts.pop();
        workingTitle = parts.join('-');
     }
  }

  let titleCleaned = normalizeBaseText(workingTitle);
  
  let changed = true;
  while(changed) {
      changed = false;
      for (const term of EDITORIAL_TERMS) {
          const suffixRegex = new RegExp(`\\b${term}$`, 'i');
          if (suffixRegex.test(titleCleaned)) {
              removedTerms.push(term);
              titleCleaned = titleCleaned.replace(suffixRegex, '').trim();
              changed = true;
          }
      }
  }

  const normalizedTitle = titleCleaned;
  const compactTitle = normalizedTitle.replace(/\s+/g, '');
  const titleTokens = normalizedTitle.split(' ').filter(Boolean);

  return {
    normalizedTitle: normalizedTitle || normalizeBaseText(originalTitle),
    compactTitle: compactTitle || normalizeBaseText(originalTitle).replace(/\s+/g, ''),
    titleTokens: titleTokens.length ? titleTokens : normalizeBaseText(originalTitle).split(' ').filter(Boolean),
    removedTerms
  };
}
