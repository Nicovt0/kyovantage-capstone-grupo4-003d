export function pushDestination(value: unknown, origin: string): string {
  try {
    const url = new URL(typeof value === 'string' ? value : '/settings', origin);
    return url.origin === origin && ['/settings', '/agenda', '/notifications'].includes(url.pathname) ? url.href : `${origin}/settings`;
  } catch { return `${origin}/settings`; }
}

/** No financial content or arbitrary URLs are fetched or persisted by push handlers. */
export function registerPushHandlers(worker: ServiceWorkerGlobalScope, allowed: boolean) {
  worker.addEventListener('push', event => {
    if (!allowed) return;
    let payload: Record<string, unknown> = {};
    try { payload = event.data?.json() || {}; } catch { /* Show a generic visible notification. */ }
    const title = typeof payload.title === 'string' ? payload.title.slice(0, 100) : 'Kyo Vantage';
    const body = typeof payload.body === 'string' ? payload.body.slice(0, 240) : 'Tienes una notificación de Kyo Vantage.';
    event.waitUntil(worker.registration.showNotification(title, {
      body, icon: '/icons/pwa-192.png', tag: 'kyo-push',
      data: { url: pushDestination(payload.url, worker.location.origin) },
    }));
  });
  worker.addEventListener('notificationclick', event => {
    event.notification.close();
    if (!allowed) return;
    const destination = pushDestination(event.notification.data?.url, worker.location.origin);
    event.waitUntil((async () => {
      const windows = await worker.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin !== worker.location.origin || !('navigate' in client)) continue;
        const window = client as WindowClient;
        await window.navigate(destination);
        await window.focus();
        return;
      }
      await worker.clients.openWindow(destination);
    })());
  });
}
