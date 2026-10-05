/* MusicScale one-time PWA migration.
 * Imported by the generated service worker to migrate legacy clients whose
 * previous worker precached index.html and kept serving a stale app shell.
 */
const MUSICSCALE_SW_MIGRATION_ID = 'network-shell-v2';
const MUSICSCALE_SW_MIGRATION_CACHE = 'musicscale-sw-migrations';

async function purgeLegacyNavigationShells() {
  const cacheNames = await caches.keys();
  const shellUrls = [
    new URL('/', self.location.origin).href,
    new URL('/index.html', self.location.origin).href,
  ];

  await Promise.all(cacheNames.map(async (cacheName) => {
    if (cacheName === MUSICSCALE_SW_MIGRATION_CACHE) return;
    const cache = await caches.open(cacheName);
    await Promise.allSettled(
      shellUrls.map((url) => cache.delete(new Request(url), { ignoreSearch: true })),
    );
  }));
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim();

    const markerCache = await caches.open(MUSICSCALE_SW_MIGRATION_CACHE);
    const markerUrl = new URL(
      '/__musicscale_sw_migration__/' + MUSICSCALE_SW_MIGRATION_ID,
      self.location.origin
    ).href;
    const markerRequest = new Request(markerUrl);

    if (await markerCache.match(markerRequest)) {
      return;
    }

    await purgeLegacyNavigationShells();

    await markerCache.put(
      markerRequest,
      new Response(MUSICSCALE_SW_MIGRATION_ID, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    );

    const windowClients = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    await Promise.all(
      windowClients.map(async (client) => {
        try {
          const url = new URL(client.url);
          if (url.origin !== self.location.origin) return;
          url.searchParams.set('_ms_sw_migration', MUSICSCALE_SW_MIGRATION_ID);
          await client.navigate(url.href);
        } catch (error) {
          console.warn('[MusicScale SW] Client migration navigation failed', error);
        }
      })
    );
  })());
});
