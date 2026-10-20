import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH } from 'node:crypto';
import { registerPushHandlers, pushDestination } from '../src/pwa/push.ts';
import { assertVapidPublicKey } from '../src/modules/notifications/services/pushNotificationService.ts';

const origin = 'https://staging.example.invalid';
function worker(allowed = true, windows = []) {
  const handlers = new Map(); const notifications = []; const opened = [];
  registerPushHandlers({ location: { origin }, addEventListener: (type, handler) => handlers.set(type, handler), registration: { showNotification: async (title, options) => notifications.push({ title, options }) }, clients: { matchAll: async () => windows, openWindow: async url => opened.push(url) } }, allowed);
  return { notifications, opened, async dispatch(type, data) { const pending = []; handlers.get(type)({ ...data, waitUntil: promise => pending.push(promise) }); await Promise.all(pending); } };
}
test('a push displays a visible notification and malformed data falls back safely', async () => {
  const instance = worker();
  await instance.dispatch('push', { data: { json: () => ({ title: 'Prueba', body: 'Funciona', url: 'https://evil.invalid' }) } });
  assert.equal(instance.notifications[0].title, 'Prueba');
  assert.equal(instance.notifications[0].options.data.url, `${origin}/settings`);
  assert.equal(instance.notifications[0].options.icon, '/icons/pwa-192.png');
  await instance.dispatch('push', { data: { json: () => { throw new Error(); } } });
  assert.equal(instance.notifications[1].title, 'Kyo Vantage');
  const landing = worker(false); await landing.dispatch('push', {});
  assert.equal(landing.notifications.length, 0);
});
test('notification clicks focus an existing app window or open a safe local destination', async () => {
  const actions = []; let closed = false;
  const window = { url: `${origin}/dashboard`, navigate: async url => actions.push(url), focus: async () => actions.push('focus') };
  const instance = worker(true, [window]);
  await instance.dispatch('notificationclick', { notification: { close: () => { closed = true; }, data: { url: '/settings' } } });
  assert.equal(closed, true); assert.deepEqual(actions, [`${origin}/settings`, 'focus']); assert.equal(instance.opened.length, 0);
  const empty = worker();
  await empty.dispatch('notificationclick', { notification: { close() {}, data: { url: 'javascript:alert(1)' } } });
  assert.deepEqual(empty.opened, [`${origin}/settings`]);
  assert.equal(pushDestination('//external.invalid', origin), `${origin}/settings`);
});
test('subscription requires an uncompressed P-256 VAPID public key', () => {
  const key = createECDH('prime256v1'); key.generateKeys();
  assert.doesNotThrow(() => assertVapidPublicKey(key.getPublicKey().toString('base64url')));
  for (const value of ['', 'invalid', 'AAAA']) assert.throws(() => assertVapidPublicKey(value), /VAPID/);
});
