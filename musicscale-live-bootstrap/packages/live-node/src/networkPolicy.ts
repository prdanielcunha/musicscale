export function isTrustedLiveWebOrigin(
  origin: string,
  configuredOrigins: ReadonlySet<string>
): boolean {
  if (configuredOrigins.has(origin)) return true;

  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();

    if (
      url.protocol === 'https:' &&
      (host === 'millionsnest.com' || host.endsWith('.millionsnest.com'))
    ) {
      return true;
    }

    if (
      url.protocol === 'http:' &&
      (host === 'localhost' || host === '127.0.0.1' || host === '::1')
    ) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
