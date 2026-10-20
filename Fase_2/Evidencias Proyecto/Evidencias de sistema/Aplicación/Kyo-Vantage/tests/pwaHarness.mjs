import vm from 'node:vm';
import { resolve } from 'node:path';
import { build } from 'vite';

export const APP_ORIGIN = 'https://app.example.invalid';
export const entries = [
  { url: 'offline.html', revision: 'offline-test' },
  { url: 'app.webmanifest', revision: 'manifest-test' },
  { url: 'icons/pwa-192.png', revision: 'icon-test' },
  { url: 'assets/app-test.js', revision: null },
  // Defend against a future build accidentally adding dynamic resources.
  { url: 'index.html', revision: 'private-document' },
  { url: 'rest/v1/accounts', revision: 'financial-response' },
  { url: 'https://backend.example.invalid/storage/v1/private/photo.png', revision: 'private-image' },
];

let bundlePromise;
async function workerBundle() {
  bundlePromise ??= build({
    configFile: false,
    logLevel: 'silent',
    publicDir: false,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'import.meta.env.VITE_APP_URL': JSON.stringify(APP_ORIGIN),
      'self.__WB_MANIFEST': JSON.stringify(entries),
    },
    build: {
      write: false,
      minify: false,
      lib: { entry: resolve('src/pwa/sw.ts'), formats: ['iife'], name: 'KyoWorker' },
    },
  }).then(result => (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk').code);
  return bundlePromise;
}

export function memoryCaches(origin = APP_ORIGIN) {
  const stores = new Map();
  const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
  const storage = {
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    open: async name => {
      if (!stores.has(name)) stores.set(name, new Map());
      const data = stores.get(name);
      return {
        match: async request => data.get(key(request))?.clone(),
        put: async (request, response) => { data.set(key(request), response.clone()); },
        keys: async () => [...data.keys()].map(url => new Request(url)),
        delete: async request => data.delete(key(request)),
      };
    },
    match: async (request, options = {}) => {
      for (const [name, data] of stores) {
        if (options.cacheName && options.cacheName !== name) continue;
        if (data.has(key(request))) return data.get(key(request)).clone();
      }
      return undefined;
    },
  };
  return { storage, stores };
}

export async function workerHarness(origin = APP_ORIGIN) {
  const caches = memoryCaches(origin);
  const listeners = new Map();
  const networkRequests = [];
  let offline = false;
  let retired = false;
  let claimed = false;
  class ExtendableEvent {
    constructor(type) { this.type = type; this.pending = []; }
    waitUntil(promise) { this.pending.push(promise); }
    async settle() {
      let completed = 0;
      while (completed < this.pending.length) {
        const next = this.pending.slice(completed);
        completed = this.pending.length;
        await Promise.all(next);
      }
    }
  }
  class FetchEvent extends ExtendableEvent {
    constructor(request) { super('fetch'); this.request = request; }
    respondWith(promise) { this.response = promise; }
  }
  const context = vm.createContext({
    console, URL, Request, Response, Headers, setTimeout, clearTimeout,
    ExtendableEvent, FetchEvent,
    location: new URL(`${origin}/sw.js`),
    registration: { scope: `${origin}/`, unregister: async () => { retired = true; return true; } },
    clients: { claim: async () => { claimed = true; } },
    caches: caches.storage,
    skipWaiting: async () => {},
    addEventListener: (name, callback) => {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(callback);
    },
    fetch: async (request, options) => {
      const url = typeof request === 'string' ? request : request.url;
      networkRequests.push({ url, options });
      if (offline) throw new TypeError('Network disconnected');
      return new Response(url.includes('/offline.html') ? 'Sin conexión — vuelve a conectarte' : 'network-response');
    },
  });
  context.self = context;
  vm.runInContext(await workerBundle(), context);
  return {
    ...caches,
    networkRequests,
    get retired() { return retired; },
    get claimed() { return claimed; },
    offline: value => { offline = value; },
    dispatch: async type => {
      const event = new ExtendableEvent(type);
      for (const callback of listeners.get(type) ?? []) callback(event);
      await event.settle();
    },
    request: async (url, { navigate = false, method = 'GET' } = {}) => {
      const request = new Request(new URL(url, origin), { method });
      if (navigate) Object.defineProperty(request, 'mode', { value: 'navigate' });
      const event = new FetchEvent(request);
      for (const callback of listeners.get('fetch') ?? []) callback(event);
      const response = await event.response;
      await event.settle();
      return response;
    },
  };
}
