import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializePwa } from '../src/pwa/register.ts';
import { isAppOrigin, isStaticPrecacheUrl, precacheName, purgeLegacyCaches } from '../src/pwa/policy.ts';
import { APP_ORIGIN, memoryCaches, workerHarness } from './pwaHarness.mjs';

function browser(origin = APP_ORIGIN, appUrl = APP_ORIGIN) {
  const { storage, stores } = memoryCaches(origin);
  const links = [];
  const registered = [];
  const removed = [];
  const events = new Map();
  const registrations = [];
  let reloaded = false;
  const options = {
    origin, appUrl, production: true, secure: true, cacheStorage: storage,
    document: {
      querySelectorAll: () => links,
      createElement: () => ({ remove() { removed.push(this); } }),
      head: { append: element => links.push(element) },
    },
    serviceWorker: {
      controller: null,
      getRegistrations: async () => registrations,
      addEventListener: (type, callback) => events.set(type, callback),
      register: async (...args) => { registered.push(args); return {}; },
    },
    reload: () => { reloaded = true; },
  };
  return { options, links, registered, removed, events, registrations, stores, get reloaded() { return reloaded; } };
}

describe('PWA privacy and installation', () => {
  it('matches the configured origin including protocol and port; fails closed without configuration', () => {
    assert.ok(isAppOrigin(APP_ORIGIN, APP_ORIGIN));
    for (const value of [undefined, '', 'invalid', 'http://app.example.invalid', `${APP_ORIGIN}:444`, 'https://other.invalid']) {
      assert.equal(isAppOrigin(APP_ORIGIN, value), false);
    }
  });

  it('excludes documents, APIs, private images and external assets from precache', () => {
    for (const url of ['/index.html', '/dashboard', '/rest/v1/accounts', '/auth/v1/token', '/storage/v1/private/image.png', '/assets/app.js?token=secret', 'https://backend.invalid/assets/image.png']) {
      assert.equal(isStaticPrecacheUrl(url, APP_ORIGIN), false, url);
    }
    for (const url of ['/offline.html', '/app.webmanifest', '/assets/app-123.js', '/icons/pwa-192.png']) {
      assert.ok(isStaticPrecacheUrl(url, APP_ORIGIN), url);
    }
  });

  it('purges previous financial/runtime/document caches while retaining the current static cache and unrelated caches', async () => {
    const { storage, stores } = memoryCaches();
    for (const name of ['supabase-api-cache', 'static-assets-cache', 'google-fonts-cache', `workbox-precache-v2-${APP_ORIGIN}/`, 'kyo-pwa-old', precacheName(APP_ORIGIN), 'another-app']) stores.set(name, new Map());
    await purgeLegacyCaches(storage, APP_ORIGIN);
    assert.deepEqual(await storage.keys(), [precacheName(APP_ORIGIN), 'another-app']);
  });

  it('adds manifest and registers only for the app origin in a secure production build', async () => {
    const page = browser();
    await initializePwa(page.options);
    assert.equal(page.links.length, 1);
    assert.equal(page.links[0].href, '/app.webmanifest');
    assert.deepEqual(page.registered, [['/sw.js', { scope: '/', updateViaCache: 'none' }]]);
    assert.equal(page.reloaded, false);
  });

  it('does not install on landing, preview, development, insecure or unconfigured origins', async () => {
    for (const overrides of [{ origin: 'https://landing.example.invalid' }, { origin: 'https://preview.example.invalid' }, { production: false }, { secure: false }, { appUrl: undefined }]) {
      const page = browser();
      await initializePwa({ ...page.options, ...overrides });
      assert.equal(page.links.length, 0);
      assert.equal(page.registered.length, 0);
    }
  });

  it('retires a legacy landing worker, removes caches and detaches its old controller by reload', async () => {
    const page = browser('https://landing.example.invalid');
    let unregistered = false;
    const oldWorker = { scriptURL: 'https://landing.example.invalid/sw.js' };
    page.options.serviceWorker.controller = oldWorker;
    page.registrations.push({ active: oldWorker, unregister: async () => { unregistered = true; } });
    page.stores.set('supabase-api-cache', new Map());
    page.stores.set(precacheName(page.options.origin), new Map());
    await initializePwa(page.options);
    assert.equal(unregistered, true);
    assert.equal(page.reloaded, true);
    assert.equal(page.registered.length, 0);
    assert.equal(page.stores.size, 0);
  });

  it('does not unregister other service workers', async () => {
    const page = browser('https://landing.example.invalid');
    page.registrations.push({ active: { scriptURL: 'https://landing.example.invalid/other/sw.js' }, unregister: async () => { throw new Error('Unrelated worker'); } });
    await initializePwa(page.options);
    assert.equal(page.reloaded, false);
  });

  it('refreshes an already-controlled app after a worker update', async () => {
    const page = browser();
    page.options.serviceWorker.controller = { scriptURL: `${APP_ORIGIN}/sw.js` };
    await initializePwa(page.options);
    page.events.get('controllerchange')();
    assert.equal(page.reloaded, true);
  });
});

describe('Real Workbox worker with simulated browser/network', () => {
  it('installs only static resources and purges previous financial caches on activation', async () => {
    const worker = await workerHarness();
    const legacy = await worker.storage.open('supabase-api-cache');
    await legacy.put(`${APP_ORIGIN}/rest/v1/accounts`, new Response('private-old-balance'));
    await worker.dispatch('install');
    await worker.dispatch('activate');
    assert.equal(worker.claimed, true);
    assert.deepEqual(await worker.storage.keys(), [precacheName(APP_ORIGIN)]);
    const saved = [...worker.stores.values()].flatMap(store => [...store.keys()]);
    assert.ok(saved.some(url => url.includes('/offline.html')));
    assert.equal(saved.some(url => /index.html|rest\/v1|backend.example/.test(url)), false);
  });

  it('never caches Supabase, API, auth, storage or external-image responses and never replays them offline', async () => {
    const worker = await workerHarness();
    await worker.dispatch('install');
    const before = JSON.stringify([...worker.stores].map(([name, store]) => [name, [...store.keys()]]));
    const urls = ['/rest/v1/accounts', '/api/summary', '/auth/v1/user', 'https://backend.example.invalid/rest/v1/accounts', 'https://backend.example.invalid/storage/v1/private/photo.png', 'https://images.example.invalid/private.png'];
    for (const url of urls) {
      assert.equal(await (await worker.request(url)).text(), 'network-response');
      assert.equal(worker.networkRequests.at(-1).options.cache, 'no-store');
    }
    worker.offline(true);
    for (const url of urls) assert.equal((await worker.request(url)).type, 'error');
    const after = JSON.stringify([...worker.stores].map(([name, store]) => [name, [...store.keys()]]));
    assert.equal(after, before);
  });

  it('serves documents from network online and only the static fallback offline', async () => {
    const worker = await workerHarness();
    await worker.dispatch('install');
    assert.equal(await (await worker.request('/dashboard', { navigate: true })).text(), 'network-response');
    worker.offline(true);
    const response = await worker.request('/dashboard', { navigate: true });
    assert.match(await response.text(), /Sin conexión/);
    assert.equal((await worker.request('/rest/v1/accounts')).type, 'error');
  });

  it('ignores saved financial responses even before the legacy cache is deleted', async () => {
    const worker = await workerHarness();
    await worker.dispatch('install');
    const legacy = await worker.storage.open('supabase-api-cache');
    await legacy.put(`${APP_ORIGIN}/rest/v1/accounts`, new Response('old-private-balance'));
    worker.offline(true);
    assert.equal((await worker.request('/rest/v1/accounts')).type, 'error');
    assert.ok(worker.stores.has('supabase-api-cache'));
    await worker.dispatch('activate');
    assert.equal(worker.stores.has('supabase-api-cache'), false);
  });

  it('keeps writes network-only and never turns an offline payment into a success', async () => {
    const worker = await workerHarness();
    await worker.dispatch('install');
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      assert.equal(await (await worker.request('/rest/v1/transactions', { method })).text(), 'network-response');
    }
    worker.offline(true);
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      assert.equal((await worker.request('/rest/v1/transactions', { method })).type, 'error');
    }
  });

  it('keeps versioned static resources available offline without fetching private documents', async () => {
    const worker = await workerHarness();
    await worker.dispatch('install');
    worker.offline(true);
    assert.equal(await (await worker.request('/assets/app-test.js')).text(), 'network-response');
    assert.equal((await worker.request('/index.html')).type, 'error');
  });

  it('an updated worker on the landing does not precache and retires itself', async () => {
    const worker = await workerHarness('https://landing.example.invalid');
    await worker.storage.open('supabase-api-cache');
    await worker.dispatch('install');
    await worker.dispatch('activate');
    assert.equal(worker.retired, true);
    assert.equal(worker.networkRequests.length, 0);
    assert.equal(worker.stores.size, 0);
    worker.offline(true);
    assert.equal((await worker.request('/', { navigate: true })).type, 'error');
  });
});

describe('Production PWA artifacts', () => {
  it('build generates the custom worker and public manifest without unconditional registration', () => {
    const dist = resolve('dist');
    assert.ok(existsSync(resolve(dist, 'sw.js')), 'Run npm run build before npm test');
    const manifest = JSON.parse(readFileSync(resolve(dist, 'app.webmanifest'), 'utf8'));
    assert.equal(manifest.name, 'Kyo Vantage');
    assert.equal(manifest.display, 'standalone');
    assert.equal(manifest.id, '/');
    assert.equal(manifest.start_url, '/dashboard');
    assert.ok(manifest.icons.length >= 2);
    const html = readFileSync(resolve(dist, 'index.html'), 'utf8');
    assert.doesNotMatch(html, /rel="manifest"|registerSW\.js/);
    const config = readFileSync(resolve('vite.config.ts'), 'utf8');
    assert.match(config, /strategies: 'injectManifest'/);
    const sw = readFileSync(resolve(dist, 'sw.js'), 'utf8');
    assert.doesNotMatch(sw, /NetworkFirst|StaleWhileRevalidate/);
    assert.doesNotMatch(sw, /url:\s*["']index\.html["']/);
  });
});
