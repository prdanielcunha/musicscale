export function detectLanguageFromText(text: string): { language: 'pt' | 'en' | 'es' | 'other' | 'unknown', confidence: number, method: 'heuristic' } {
  if (!text || text.trim() === '') {
    return { language: 'unknown', confidence: 0, method: 'heuristic' };
  }

  // Very simple heuristics for fast client-side detection
  const ptWords = [' você ', ' não ', ' um ', ' uma ', ' é ', ' com ', ' senhor ', ' deus ', ' coração ', ' graça ', ' amor '];
  const enWords = [' you ', ' the ', ' and ', ' a ', ' is ', ' of ', ' lord ', ' god ', ' heart ', ' grace ', ' love '];
  const esWords = [' tu ', ' el ', ' la ', ' y ', ' un ', ' una ', ' es ', ' señor ', ' dios ', ' corazón ', ' gracia ', ' amor '];

  const lowerText = ' ' + text.toLowerCase() + ' ';

  let ptScore = 0;
  let enScore = 0;
  let esScore = 0;

  ptWords.forEach(word => { if (lowerText.includes(word)) ptScore++; });
  enWords.forEach(word => { if (lowerText.includes(word)) enScore++; });
  esWords.forEach(word => { if (lowerText.includes(word)) esScore++; });

  // Weight for unique characters
  if (lowerText.match(/[ãõç]/g)) ptScore += 3;
  if (lowerText.match(/[ñ¿¡]/g)) esScore += 3;

  const maxScore = Math.max(ptScore, enScore, esScore);
  
  if (maxScore === 0) {
      return { language: 'other', confidence: 0.1, method: 'heuristic' };
  }

  const total = ptScore + enScore + esScore;
  const confidence = Math.min(1, maxScore / total + 0.1); 

  if (ptScore === maxScore && ptScore > enScore && ptScore > esScore) {
    return { language: 'pt', confidence, method: 'heuristic' };
  } else if (enScore === maxScore && enScore > ptScore && enScore > esScore) {
    return { language: 'en', confidence, method: 'heuristic' };
  } else if (esScore === maxScore) {
    return { language: 'es', confidence, method: 'heuristic' };
  }

  return { language: 'unknown', confidence: 0, method: 'heuristic' };
}
