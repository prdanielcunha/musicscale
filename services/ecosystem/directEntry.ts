export const MUSICSCALE_OFFICIAL_ORIGIN = 'https://musicscale.millionsnest.com';
export const MILLIONSNEST_MUSICSCALE_LAUNCH_URL = 'https://www.millionsnest.com/musicscale/launch';

export function isOfficialMusicScaleHost(hostname: string): boolean {
  return String(hostname || '').trim().toLowerCase() === 'musicscale.millionsnest.com';
}

/**
 * The Hub remains the authentication/tenant authority. A direct visit to the
 * official MusicScale /start gateway must use the Hub launch bridge when the
 * satellite app has no local Firebase session. Development hosts and the
 * explicit /login route keep their existing standalone behavior.
 */
export function shouldUseMillionsNestDirectEntryBridge(params: {
  hostname: string;
  pathname: string;
  hasAuthenticatedUser: boolean;
}): boolean {
  return (
    isOfficialMusicScaleHost(params.hostname) &&
    params.pathname === '/start' &&
    !params.hasAuthenticatedUser
  );
}

export function redirectToMillionsNestMusicScaleLaunch(): void {
  window.location.replace(MILLIONSNEST_MUSICSCALE_LAUNCH_URL);
}
