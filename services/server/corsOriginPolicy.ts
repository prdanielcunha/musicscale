const MUSIC_SCALE_CROSS_ORIGIN_ALLOWLIST = new Set([
  'https://musicscale.millionsnest.com',
  'https://millionsnest.com',
  'https://www.millionsnest.com',
]);

function firstHeaderValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || '';
  return typeof value === 'string' ? value.split(',')[0].trim() : '';
}

function normalizeRequestHost(value: string | string[] | undefined): string {
  return firstHeaderValue(value).trim().toLowerCase();
}

export function isMusicScaleRequestOriginAllowed(input: {
  origin?: string | string[];
  host?: string | string[];
  forwardedHost?: string | string[];
}): boolean {
  const rawOrigin = firstHeaderValue(input.origin);
  if (!rawOrigin) return true;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(rawOrigin);
  } catch {
    return false;
  }

  if (!['http:', 'https:'].includes(parsedOrigin.protocol)) return false;
  if (parsedOrigin.username || parsedOrigin.password) return false;

  const normalizedOrigin = parsedOrigin.origin.toLowerCase();
  if (MUSIC_SCALE_CROSS_ORIGIN_ALLOWLIST.has(normalizedOrigin)) return true;

  const requestHost = normalizeRequestHost(input.forwardedHost) || normalizeRequestHost(input.host);
  if (!requestHost) return false;

  return parsedOrigin.host.toLowerCase() === requestHost;
}

export function getMusicScaleCorsAllowlist(): readonly string[] {
  return [...MUSIC_SCALE_CROSS_ORIGIN_ALLOWLIST];
}
