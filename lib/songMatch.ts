export function normalizeSongIdentity(value: string | null | undefined): string {
  if (!value) return "";
  
  // 1. Converter para minúsculas
  let normalized = value.toLowerCase();

  // 2. Remover acentos
  normalized = normalized.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 3, 4, 5, 12, 13. Remover caracteres especiais, pontuações, emojis, aspas, etc.
  // Vamos manter apenas letras (a-z) e números (0-9) e espaços.
  // Isso remove interrogações, exclamações, pontos, vírgulas, hifens, aspas, parênteses, chaves, colchetes, etc.
  normalized = normalized.replace(/[^a-z0-9\s]/g, " ");

  // 8. Trocar múltiplos separadores por espaço
  // 6, 7. Remover espaços duplicados e espaços no começo/fim
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

export function getSongSimilarityScore(candidate: { title?: string, artist?: string }, existing: { title?: string, artist?: string }): number {
  const normTitle1 = normalizeSongIdentity(candidate.title);
  const normTitle2 = normalizeSongIdentity(existing.title);
  
  const normArtist1 = normalizeSongIdentity(candidate.artist);
  const normArtist2 = normalizeSongIdentity(existing.artist);

  // Exata: título e artista iguais
  if (normTitle1 === normTitle2 && normArtist1 === normArtist2) {
    if (normTitle1 && normArtist1) return 1.0;
    // Se ambos o título é igual mas o artista não existe em nenhum
    if (normTitle1 && !normArtist1 && !normArtist2) return 0.9;
  }

  // Título e artista vazios = sem similaridade
  if (!normTitle1 && !normTitle2) return 0;

  // Calculando overlap simples de palavras para título
  const titleScore = wordOverlapScore(normTitle1, normTitle2);
  const artistScore = wordOverlapScore(normArtist1, normArtist2);

  // Se o título é muito diferente, não é a mesma música
  if (titleScore < 0.5 && normTitle1 !== normTitle2) {
    // Um caso especial é quando o título contém o artista:
    const combined1 = normTitle1 + " " + normArtist1;
    const combined2 = normTitle2 + " " + normArtist2;
    if (wordOverlapScore(combined1, combined2) >= 0.8) {
      return 0.85; // Provável duplicata
    }
    return 0;
  }

  // Se o título exato bater, mas o artista for diferente, pode ser a mesma música arranjada por outro, 
  // ou a mesma música mas um esqueceu do artista.
  if (normTitle1 === normTitle2) {
    if (!normArtist1 || !normArtist2) return 0.85; // Um tem artista e o outro não
    if (artistScore > 0.5) return 0.85; // Artista parecido
    return 0.75; // "Possível duplicata"
  }

  // Se titulo parecido (>= 0.7) e artista igual
  if (titleScore >= 0.7 && normArtist1 && normArtist1 === normArtist2) {
    return 0.85;
  }

  // Ponderações
  return titleScore * 0.7 + artistScore * 0.3;
}

function wordOverlapScore(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  const words1 = str1.split(" ").filter(w => w.length > 0);
  const words2 = str2.split(" ").filter(w => w.length > 0);

  if (words1.length === 0 || words2.length === 0) return 0;

  const set1 = new Set(words1);
  const set2 = new Set(words2);
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}
