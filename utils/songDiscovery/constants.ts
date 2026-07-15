export const EXACT_MATCH_THRESHOLD = 0.985;
export const HIGH_CONFIDENCE_THRESHOLD = 0.95;
export const POSSIBLE_DUPLICATE_THRESHOLD = 0.76;

export const MAX_EDIT_DISTANCE_TEXT_LENGTH = 2000;
export const MAX_NORMALIZED_LYRICS_LENGTH = 5000;
export const MIN_LYRICS_WORDS_FOR_STRONG_MATCH = 15;

export const GENERIC_TITLES = new Set([
  'santo',
  'aleluia',
  'hosana',
  'gratidao',
  'adoracao',
  'gloria',
  'fiel',
]);

export const EDITORIAL_TERMS = [
  'ao vivo', 'live', 'acustico', 'acoustic', 'acustica',
  'official', 'oficial', 'lyric video', 'lyrics', 'letra',
  'playback', 'instrumental', 'cover', 'versao', 'version',
  'remix', 'remastered', 'clipe oficial', 'video oficial',
  'clipe', 'video'
];
