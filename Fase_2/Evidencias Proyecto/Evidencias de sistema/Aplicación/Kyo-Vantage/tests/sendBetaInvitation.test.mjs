import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const file = new URL('../supabase/functions/send-beta-invitation/index.ts', import.meta.url);
const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  .replace(/^import .*createClient.*;\r?\n/m, 'const createClient = globalThis.testCreateClient;\n');
const id = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
function harness(options = {}) {
  let handler;
  const calls = [];
  const env = { SUPABASE_URL: 'https://example.invalid', SUPABASE_ANON_KEY: 'anonymous-test', SUPABASE_SERVICE_ROLE_KEY: 'server-test', APP_URL: 'http://localhost:3000', ...options.env };
  const context = vm.createContext({ Request, Response, URL, AbortSignal, crypto, console,
    Deno: { env: { get: name => env[name] }, serve: fn => { handler = fn; } },
    testCreateClient: (_url, key) => ({
      auth: { getUser: async () => ({ data: { user: options.noUser ? null : { app_metadata: { role: options.role ?? 'admin' } } }, error: null }) },
      rpc: async (name, args) => { calls.push({ name, args, key }); return name === 'claim_beta_dispatch'
        ? { data: [{ email: 'approved@example.invalid', code: 'KYO-TEST', invitation_id: id }], error: null }
        : { data: true, error: null }; },
    }),
    fetch: async (url, options) => { calls.push({ name: 'fetch', url, options }); return new Response('{}', { status: 200 }); },
  });
  vm.runInContext(source, context);
  return { calls, invoke: (body = { waitlist_id: id }, headers = {}) => handler(new Request('https://example.invalid/functions/v1/send-beta-invitation', { method: 'POST', headers: { Authorization: 'Bearer test-token', Origin: 'http://localhost:3000', 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })) };
}

test('email remains disabled and persists an explicit retryable error', async () => {
  const fixture = harness();
  const response = await fixture.invoke();
  assert.equal(response.status, 503);
  assert.equal(fixture.calls.some(call => call.name === 'fetch'), false);
  const finish = fixture.calls.find(call => call.name === 'finish_beta_dispatch');
  assert.match(finish.args.p_error, /deshabilitado/);
  assert.equal(finish.key, 'server-test');
});

test('ordinary user cannot approve mail dispatch', async () => {
  const fixture = harness({ role: 'user' });
  const response = await fixture.invoke();
  assert.equal(response.status, 403);
  assert.equal(fixture.calls.length, 0);
});

test('server invitation controls recipient and retry idempotency', async () => {
  const fixture = harness({ env: { ENABLE_INVITATION_EMAIL: 'true', RESEND_API_KEY: 'test-api', INVITATION_FROM: 'test@example.invalid' } });
  const response = await fixture.invoke({ waitlist_id: id, email: 'injected@example.invalid', code: 'INJECTED' });
  assert.equal(response.status, 200);
  const send = fixture.calls.find(call => call.name === 'fetch');
  const payload = JSON.parse(send.options.body);
  assert.deepEqual(payload.to, ['approved@example.invalid']);
  assert.match(payload.text, /KYO-TEST/);
  assert.doesNotMatch(payload.text, /INJECTED/);
  assert.equal(send.options.headers['Idempotency-Key'], `beta-invitation-${id}`);
  assert.equal(fixture.calls.find(call => call.name === 'finish_beta_dispatch').args.p_error, null);
});

test('foreign origin and invalid sessions never reach dispatch', async () => {
  const originFixture = harness();
  assert.equal((await originFixture.invoke(undefined, { Origin: 'https://foreign.invalid' })).status, 403);
  assert.equal(originFixture.calls.length, 0);
  const authFixture = harness({ noUser: true });
  assert.equal((await authFixture.invoke()).status, 401);
  assert.equal(authFixture.calls.length, 0);
});
