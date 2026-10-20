import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../supabase/functions/send-push-test/index.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace(/^import .*;\r?\n/gm, '');
const endpoint = 'https://fcm.googleapis.com/fcm/send/test';
function fixture(options = {}) {
  let handler; const sent = []; const filters = []; let deleted = false;
  const env = { APP_URL: 'https://staging.example.invalid', APP_ENV: 'development', ENABLE_PUSH_TEST: 'true', SUPABASE_URL: 'https://db.invalid', SUPABASE_ANON_KEY: 'anon', VAPID_PUBLIC_KEY: 'public', VAPID_PRIVATE_KEY: 'private', VAPID_SUBJECT: 'mailto:test@example.invalid', ...options.env };
  const chain = { select() { return chain; }, eq(name, value) { filters.push([name, value]); return chain; }, delete() { deleted = true; return chain; }, async maybeSingle() { return { data: options.missing ? null : { endpoint, p256dh: 'dh', auth: 'auth' }, error: null }; } };
  vm.runInNewContext(source, { URL, Request, Response, console,
    Deno: { env: { get: name => env[name] }, serve: callback => { handler = callback; } },
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: options.noUser ? null : { id: 'owner' } }, error: null }) }, from: () => chain }),
    webpush: { sendNotification: async (...args) => { sent.push(args); if (options.status) throw { statusCode: options.status }; } },
  });
  return { sent, filters, get deleted() { return deleted; }, invoke: (target = endpoint, origin = env.APP_URL) => handler(new Request('https://db.invalid/functions/v1/send-push-test', { method: 'POST', headers: { Origin: origin, Authorization: 'Bearer user-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: target, user_id: 'ignored-foreign-user' }) })) };
}
test('the test sender checks endpoint ownership and sends only the fixed payload', async () => {
  const instance = fixture(); assert.equal((await instance.invoke()).status, 200);
  assert.ok(instance.filters.some(([key, value]) => key === 'user_id' && value === 'owner'));
  assert.equal(instance.sent.length, 1); assert.equal(JSON.parse(instance.sent[0][1]).url, '/settings');
  assert.equal(instance.sent[0][2].TTL, 60);
});
test('the test sender refuses production, missing sessions, foreign origins and foreign subscriptions', async () => {
  for (const options of [{ env: { APP_ENV: 'production' } }, { env: { ENABLE_PUSH_TEST: 'false' } }, { noUser: true }, { missing: true }]) {
    const instance = fixture(options); assert.ok((await instance.invoke()).status >= 400); assert.equal(instance.sent.length, 0);
  }
  const instance = fixture(); assert.equal((await instance.invoke(endpoint, 'https://other.invalid')).status, 403); assert.equal(instance.sent.length, 0);
});
test('the sender rejects arbitrary and private endpoints and retires expired owned subscriptions', async () => {
  for (const url of ['http://127.0.0.1', 'https://example.invalid', 'https://fcm.googleapis.com:444/test']) {
    const instance = fixture(); assert.equal((await instance.invoke(url)).status, 400); assert.equal(instance.sent.length, 0);
  }
  const expired = fixture({ status: 410 }); assert.equal((await expired.invoke()).status, 410); assert.equal(expired.deleted, true);
  const failed = fixture({ status: 403 }); assert.equal((await failed.invoke()).status, 502); assert.equal(failed.deleted, false);
});
