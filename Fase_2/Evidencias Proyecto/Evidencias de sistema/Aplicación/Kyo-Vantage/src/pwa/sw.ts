/// <reference lib="webworker" />
import { setCacheNameDetails } from 'workbox-core';
import { precacheAndRoute, matchPrecache } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { isAppOrigin, isStaticPrecacheUrl, PRECACHE_VERSION, purgeLegacyCaches } from './policy';
import { registerPushHandlers } from './push';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const origin = self.location.origin;
const allowed = isAppOrigin(origin, import.meta.env.VITE_APP_URL);
registerPushHandlers(self, allowed);
setCacheNameDetails({ prefix: 'kyo-pwa', precache: PRECACHE_VERSION, suffix: `${origin}/` });

// No index.html, authenticated page, API response or third-party resource is precached.
const staticFiles = self.__WB_MANIFEST.filter(entry =>
  isStaticPrecacheUrl(typeof entry === 'string' ? entry : entry.url, origin),
);
if (allowed) precacheAndRoute(staticFiles);

// All other GET requests (including Supabase/Auth/Storage/functions) are network-only.
// Never fall back to a saved financial response or cache arbitrary image URLs.
const network = new NetworkOnly({ fetchOptions: { cache: 'no-store' } });
registerRoute(() => true, network);
for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'] as const) {
  registerRoute(() => true, network, method);
}
setCatchHandler(async ({ request }) => {
  if (allowed && request.mode === 'navigate') {
    return (await matchPrecache('/offline.html')) ?? Response.error();
  }
  return Response.error();
});

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await purgeLegacyCaches(self.caches, origin, allowed);
    await self.clients.claim();
    // Also retire legacy landing installations when the browser updates them in background.
    if (!allowed) await self.registration.unregister();
  })());
});
