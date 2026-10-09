/**
 * Canonical MusicScale invitations belong to the MillionsNest Hub.
 * Cross-origin browser Auth persistence is not a substitute for a Hub session.
 * Let the Hub authenticate, accept and audit the invited membership.
 *
 * Legacy MusicScale tokens without a tenant path stay on the legacy route.
 */
export function getCanonicalInvitationJoinUrl(pathname: string, search: string): string | null {
  const match = /^\/join\/([A-Za-z0-9_-]{1,128})\/?$/.exec(pathname);
  if (!match) return null;

  const token = new URLSearchParams(search).get('token');
  if (!token || !token.trim() || token.length > 4096) return null;

  const destination = new URL(`/join/${match[1]}`, 'https://millionsnest.com');
  destination.searchParams.set('token', token);
  return destination.toString();
}
