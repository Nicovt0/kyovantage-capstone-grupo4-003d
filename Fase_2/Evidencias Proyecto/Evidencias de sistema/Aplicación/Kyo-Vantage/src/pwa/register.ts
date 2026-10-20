import { isAppOrigin, purgeLegacyCaches } from './policy.ts';

type PwaOptions = {
  origin: string;
  appUrl: string | undefined;
  production: boolean;
  secure: boolean;
  document: Document;
  serviceWorker?: ServiceWorkerContainer;
  cacheStorage?: Pick<CacheStorage, 'keys' | 'delete'>;
  reload: () => void;
};

function isKyoWorker(scriptUrl: string, origin: string): boolean {
  const url = new URL(scriptUrl);
  return url.origin === origin && url.pathname === '/sw.js';
}

export async function initializePwa(options: PwaOptions): Promise<void> {
  const { origin, appUrl, production, secure, document, serviceWorker, cacheStorage, reload } = options;
  const enabled = production && secure && isAppOrigin(origin, appUrl);

  // Run before private queries mount, even if registration is unavailable.
  if (cacheStorage) await purgeLegacyCaches(cacheStorage, origin, enabled);

  if (!enabled) {
    document.querySelectorAll('link[rel="manifest"]').forEach(link => link.remove());
    if (!serviceWorker) return;
    const registrations = await serviceWorker.getRegistrations();
    const owned = registrations.filter(registration =>
      [registration.active, registration.waiting, registration.installing]
        .some(worker => worker && isKyoWorker(worker.scriptURL, origin)),
    );
    const controlledByKyo = serviceWorker.controller
      && isKyoWorker(serviceWorker.controller.scriptURL, origin);
    await Promise.all(owned.map(registration => registration.unregister()));
    // An old controller stays attached to this document until navigation.
    if (controlledByKyo && owned.length) reload();
    return;
  }

  if (!serviceWorker) return;
  const manifest = document.createElement('link');
  manifest.rel = 'manifest';
  manifest.href = '/app.webmanifest';
  document.head.append(manifest);

  const hadController = Boolean(serviceWorker.controller);
  serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) reload();
  }, { once: true });
  await serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
}
