export interface SongIdentity {
  id: string;
  title: string;
  artist?: string;
}

export interface SongMatchCandidate extends SongIdentity {
  score: number;
  titleExact: boolean;
  artistExact: boolean;
}

export type SongMatchDecision =
  | { status: 'matched'; candidate: SongMatchCandidate }
  | { status: 'ambiguous'; candidates: SongMatchCandidate[] }
  | { status: 'missing'; candidates: SongMatchCandidate[] };

export function normalizeSongIdentity(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(feat|ft|part|participacao|participação)\.?\b.*$/i, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function matchExternalSong(
  source: Omit<SongIdentity, 'id'>,
  externalSongs: SongIdentity[]
): SongMatchDecision {
  const sourceTitle = normalizeSongIdentity(source.title);
  const sourceArtist = normalizeSongIdentity(source.artist || '');

  const candidates = externalSongs
    .map(song => {
      const candidateTitle = normalizeSongIdentity(song.title);
      const candidateArtist = normalizeSongIdentity(song.artist || '');
      const titleExact = Boolean(sourceTitle) && candidateTitle === sourceTitle;
      const artistExact = Boolean(sourceArtist) && candidateArtist === sourceArtist;

      let score = 0;
      if (titleExact) score += 80;
      if (artistExact) score += 20;
      if (!sourceArtist && titleExact) score += 10;

      return {
        ...song,
        score,
        titleExact,
        artistExact
      } satisfies SongMatchCandidate;
    })
    .filter(candidate => candidate.score >= 80)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const strict = candidates.filter(candidate =>
    candidate.titleExact && (sourceArtist ? candidate.artistExact : true)
  );

  if (strict.length === 1) {
    return { status: 'matched', candidate: strict[0]! };
  }

  if (strict.length > 1 || candidates.length > 0) {
    return { status: 'ambiguous', candidates: strict.length ? strict : candidates };
  }

  return { status: 'missing', candidates: [] };
}
