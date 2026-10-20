export const PRECACHE_VERSION = 'precache-v3';

export function isAppOrigin(origin: string, configuredAppUrl: string | undefined): boolean {
  if (!configuredAppUrl) return false;
  try {
    const app = new URL(configuredAppUrl);
    return ['http:', 'https:'].includes(app.protocol) && app.origin === origin;
  } catch {
    return false;
  }
}

export function precacheName(origin: string): string {
  return `kyo-pwa-${PRECACHE_VERSION}-${origin}/`;
}

export function isStaticPrecacheUrl(value: string, origin: string): boolean {
  const url = new URL(value, `${origin}/`);
  if (url.origin !== origin || url.search) return false;
  return url.pathname === '/offline.html'
    || url.pathname === '/app.webmanifest'
    || /^\/icons\/(?:pwa-192|pwa-512|pwa-maskable-512|apple-touch-icon)\.png$/.test(url.pathname)
    || /^\/(?:V|VANTAGE|Logo_transparent)\.png$/.test(url.pathname)
    || /^\/assets\/.+\.(?:js|css|png|svg|webp|ico|woff2?)$/.test(url.pathname);
}

/** Remove only caches owned by Kyo, including the previous Workbox root scope. */
export async function purgeLegacyCaches(
  storage: Pick<CacheStorage, 'keys' | 'delete'>,
  origin: string,
  keepCurrent = true,
): Promise<void> {
  const legacyRuntimeNames = ['supabase-api-cache', 'static-assets-cache', 'google-fonts-cache'];
  const current = keepCurrent ? precacheName(origin) : null;
  const names = await storage.keys();
  await Promise.all(names.filter(name => name !== current && (
    legacyRuntimeNames.includes(name)
    || name.startsWith('kyo-pwa-')
    || (name.startsWith('workbox-precache-') && name.endsWith(`${origin}/`))
  )).map(name => storage.delete(name)));
}
