import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(
  readFileSync(new URL('../supabase/functions/daily-interest/index.ts', import.meta.url), 'utf8'),
  { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } },
).outputText.replace(/^import .*createClient.*;\r?\n/m, 'const createClient = globalThis.testCreateClient;\n')
  .replace('export async function', 'async function');

function fixture(overrides = {}) {
  let handler;
  const writes = [];
  const env = { CRON_SECRET: 'test-cron', SUPABASE_URL: 'https://example.invalid', SUPABASE_SERVICE_ROLE_KEY: 'test-server', ...overrides };
  const context = vm.createContext({ Request, Response, console,
    Deno: { env: { get: name => env[name] }, serve: fn => { handler = fn; } },
    testCreateClient: () => ({ from: () => ({
      select: () => ({ in: async () => ({ data: [{ id: 'statement', payment_due_date: '2020-01-01', total_due: 3000, amount_paid: 0, interest_amount: 10, minimum_payment: 100, credit_cards: { default_interest_rate: 3 } }], error: null }) }),
      update: values => ({ eq: async (_key, id) => { writes.push({ id, ...values }); return { error: null }; } }),
    }) }),
  });
  vm.runInContext(source, context);
  return { writes, invoke: token => handler(new Request('https://example.invalid', { headers: { authorization: `Bearer ${token}` } })) };
}

test('daily interest rejects missing cron configuration and unauthorized calls without writes', async () => {
  const unconfigured = fixture({ CRON_SECRET: undefined });
  assert.equal((await unconfigured.invoke('test-cron')).status, 500);
  assert.equal(unconfigured.writes.length, 0);
  const unauthorized = fixture();
  assert.equal((await unauthorized.invoke('wrong')).status, 401);
  assert.equal(unauthorized.writes.length, 0);
});

test('daily interest requires server credentials rather than a browser session fallback', async () => {
  const app = fixture({ SUPABASE_SERVICE_ROLE_KEY: undefined });
  assert.equal((await app.invoke('test-cron')).status, 500);
  assert.equal(app.writes.length, 0);
});

test('daily interest preserves the overdue calculation after migrating the runtime', async () => {
  const app = fixture();
  assert.equal((await app.invoke('test-cron')).status, 200);
  assert.equal(app.writes.length, 1);
  assert.equal(app.writes[0].interest_amount, 13);
  assert.equal(app.writes[0].total_due, 3003);
  assert.equal(app.writes[0].minimum_payment, 103);
  assert.ok(app.writes[0].days_late > 0);
});
