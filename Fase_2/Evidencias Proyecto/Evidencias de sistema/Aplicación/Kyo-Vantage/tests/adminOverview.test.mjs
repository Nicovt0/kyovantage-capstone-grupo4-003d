import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(path, globals) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^import .*;\r?$/gm, '');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, ...globals });
  return exports;
}
function client(result) {
  const calls = [];
  return { calls, from(table) {
    const request = { table, filters: [] }; calls.push(request);
    return { select(columns, options) { request.columns = columns; request.options = options; return this; }, eq(...args) { request.filters.push(args); return this; }, or(value) { request.or = value; return this; }, ilike(...args) { request.ilike = args; return this; }, order(...args) { request.order = args; return this; }, limit(value) { request.limit = value; return this; }, range(...args) { request.range = args; return this; }, then(resolve, reject) { return Promise.resolve(result(request)).then(resolve, reject); } };
  } };
}
test('admin overview uses exact counts and bounded recent lists from existing staging tables', async () => {
  const apiClient = client(request => ({ data: request.options?.head ? null : [], count: request.table === 'profiles' ? 7 : request.filters.some(([field, value]) => field === 'is_used' && value) ? 3 : 0, error: null }));
  const api = load('../src/features/admin/api/adminOverviewRepository.ts', { createClient: () => apiClient });
  const data = await api.getAdminOverview();
  assert.equal(data.users, 7); assert.equal(data.pendingRequests, 0); assert.equal(data.availableCodes, 0); assert.equal(data.usedCodes, 3);
  assert.equal(apiClient.calls.filter(call => call.options?.head).length, 7);
  assert.ok(apiClient.calls.filter(call => !call.options?.head).every(call => call.limit === 5));
  assert.ok(apiClient.calls.some(call => call.table === 'waitlist' && call.filters.some(([field, value]) => field === 'status' && value === 'pending')));
  assert.ok(apiClient.calls.some(call => call.table === 'beta_invitations' && call.or === 'is_used.is.null,is_used.eq.false'));
  assert.equal(apiClient.calls.some(call => ['transactions', 'accounts'].includes(call.table)), false);
});
test('admin overview reports failed and unconfirmed counts rather than inventing figures', async () => {
  for (const failure of [{ error: { message: 'permission denied' }, count: null }, { error: null, count: null }]) {
    const apiClient = client(() => ({ data: [], ...failure }));
    const api = load('../src/features/admin/api/adminOverviewRepository.ts', { createClient: () => apiClient });
    await assert.rejects(api.getAdminOverview(), /permission denied|No se confirmó/);
  }
});
test('real diagnostics preserve zero and empty activity without falling back to demo fixtures', async () => {
  const apiClient = client(() => ({ data: [], count: 0, error: null }));
  const api = load('../src/features/admin/api/adminMetricsRepository.ts', { createClient: () => apiClient, USE_MOCKS: false, performance: { now: () => 1 } });
  const stats = await api.getPlatformStats();
  for (const key of ['totalUsers', 'activeUsers', 'totalCommitments', 'projectedMonthlyCommitments', 'totalAccounts', 'totalManagedBalance']) assert.equal(stats[key], 0);
  assert.equal((await api.getRecentActivityLogs()).length, 0);
});
test('real diagnostics surface backend failures and use only existing commitment fields', async () => {
  const apiClient = client(request => ({ data: [], count: 0, error: request.table === 'recurring_templates' ? { message: 'denied' } : null }));
  const api = load('../src/features/admin/api/adminMetricsRepository.ts', { createClient: () => apiClient, USE_MOCKS: false, performance: { now: () => 1 } });
  await assert.rejects(api.getPlatformStats(), /denied/);
  const select = apiClient.calls.find(call => call.table === 'recurring_templates').columns;
  assert.equal(select.split(',').includes('amount'), false);
  const failed = load('../src/features/admin/api/adminMetricsRepository.ts', { createClient: () => client(() => ({ data: null, error: { message: 'offline' } })), USE_MOCKS: false });
  await assert.rejects(failed.getRecentActivityLogs(), /offline/);
  const truncated = load('../src/features/admin/api/adminMetricsRepository.ts', { createClient: () => client(() => ({ data: [], count: 5001, error: null })), USE_MOCKS: false, performance: { now: () => 1 } });
  await assert.rejects(truncated.getPlatformStats(), /limitó las filas/);
});
test('invitation browsing applies server pagination, status and escaped search', async () => {
  const apiClient = client(() => ({ data: [], count: 0, error: null }));
  const api = load('../src/features/admin/api/invitations.ts', { createClient: () => apiClient });
  const data = await api.getBetaInvitationPage({ page: 1, status: 'available', search: 'KYO_TEST%' });
  assert.equal(data.total, 0);
  const request = apiClient.calls[0];
  assert.equal(request.range.join(','), '25,49');
  assert.equal(request.or, 'is_used.is.null,is_used.eq.false');
  assert.equal(request.ilike[0], 'code');
  assert.equal(request.ilike[1], '%KYO\\_TEST\\%%');
});
